//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC3156.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

import "./joe-core/IWAVAX.sol";
import "./joe-core/IJoeRouter02.sol";
import "./joe-lending/PriceOracle.sol";
import "./joe-lending/JErc20Interface.sol";
import "./joe-lending/JoetrollerInterface.sol";

import "./DebugLend.sol";

contract FlashloanBorrower is IERC3156FlashBorrower, Ownable {
    using SafeMath for uint256;

    PriceOracle private oracle;
    IJoeRouter02 private router;
    JoetrollerInterface private joetroller;

    constructor() {
        oracle = PriceOracle(0xe34309613B061545d42c4160ec4d64240b114482);
        router = IJoeRouter02(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
        joetroller = JoetrollerInterface(0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC);
    }

    receive() external payable {
        console.log("Received", msg.value);
    }

    function onFlashLoan(
        address initiator,
        address flashLoanToken,
        uint256 flashLoanAmount,
        uint256 fee,
        bytes calldata data
    ) external override returns (bytes32) {
        console.log("onFlashLoan called");

        // Make sure this came from a jToken
        require(joetroller.isMarketListed(msg.sender), "Did this come from a jToken?");

        // Require the initiator be the owner of the contract
        require(initiator == owner(), "Unknown initiator");

        // Get initiator variables
        (address borrower, 
         address borrowToken, 
         uint256 borrowAmount,
         address collateralToken) = abi.decode(data, (address, address, uint256, address));

        // Perform flash loan:
        // a. Borrow borrowed token to repay borrow position.
        // b. Redeem underlying seized tokens
        // c. Swap underlying seized tokens for AVAX using Trader Joe router
        
        // Swap flash loan token for borrow token and liquidate
        swapLiquidateBorrow(
            flashLoanToken, 
            flashLoanAmount, 
            fee,
            borrower, 
            borrowToken, 
            borrowAmount, 
            collateralToken
        );

        return keccak256("ERC3156FlashBorrowerInterface.onFlashLoan");
    }

    function redeemCollateral(address collateralToken, address underlying) internal returns (uint256) {
        uint256 collateralSeized = ERC20(collateralToken).balanceOf(address(this));
        JErc20Interface(collateralToken).redeem(collateralSeized);

        uint256 redeemedBalance = ERC20(underlying).balanceOf(address(this));
        return redeemedBalance;
    }

    function swapLiquidateBorrow(
        address flashLoanToken,
        uint256 flashLoanAmount,
        uint256 fee,
        address borrower,
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken
    ) internal {
        ERC20(flashLoanToken).approve(address(router), flashLoanAmount);

        address[] memory path = new address[](2);
        path[0] = flashLoanToken;
        path[1] = JErc20Interface(borrowToken).underlying();

        router.swapExactTokensForTokens(
            flashLoanAmount, 
            borrowAmount, 
            path, 
            address(this), 
            block.timestamp
        );

        ERC20(JErc20Interface(borrowToken).underlying()).approve(borrowToken, borrowAmount);

        JErc20Interface(borrowToken).liquidateBorrow(borrower, borrowAmount, collateralToken);

        // Redeem and then swap to flash loan token to repay the flash loan
        uint256 redeemedBalance = redeemCollateral(
            collateralToken, 
            JErc20Interface(collateralToken).underlying()
        );

        uint256 spentBalance = swapRedeemedToFlashToken(
            flashLoanAmount, 
            fee, 
            redeemedBalance, 
            JErc20Interface(collateralToken).underlying(), 
            flashLoanToken
        );

        // Approve the flash loan lender to take back what is owed
        ERC20(flashLoanToken).approve(msg.sender, flashLoanAmount + fee);

        // Remaining balance of redeemed tokens
        swapRemainingToAVAX(
            JErc20Interface(collateralToken).underlying(),
            redeemedBalance - spentBalance
        );
    }

    function swapRedeemedToFlashToken(
        uint256 flashLoanAmount,
        uint256 fee,
        uint256 redeemedBalance,
        address underlying,
        address flashLoanToken
    ) internal returns (uint256) {
        ERC20(underlying).approve(address(router), redeemedBalance);

        uint256 flashAmountPlusFee = flashLoanAmount + fee;

        address[] memory path = new address[](2);
        path[0] = underlying;
        path[1] = flashLoanToken;

        // Swap redeemed tokens for flash loan amount plus fee
        uint256[] memory swappedAmounts = router.swapTokensForExactTokens(
            flashAmountPlusFee,
            redeemedBalance, 
            path, 
            address(this), 
            block.timestamp
        );

        return swappedAmounts[1];
    }

    function swapRemainingToAVAX(
        address underlying,
        uint256 remainingBalance
    ) internal {
        if (underlying == router.WAVAX()) {
            IWAVAX(underlying).withdraw(
                ERC20(underlying).balanceOf(address(this))
            );
            return;
        }

        ERC20(underlying).approve(address(router), remainingBalance);

        // Swap remaining to AVAX
        uint256 redeemedPrice = oracle.getUnderlyingPrice(underlying);
        uint256 avaxPrice = oracle.getUnderlyingPrice(router.WAVAX());

        require(redeemedPrice > 0, "No redeemed price");
        require(avaxPrice > 0, "No avax price");

        uint256 avaxAmount = remainingBalance.mul(redeemedPrice) / avaxPrice;

        address[] memory path = new address[](2);
        path[0] = underlying;
        path[1] = router.WAVAX();

        router.swapExactTokensForAVAX(
            remainingBalance, 
            avaxAmount, 
            path,
            address(this), 
            block.timestamp
        );
    }

    function initiate(
        address borrower,
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken,
        address flashLoanToken
    ) external onlyOwner {
        console.log("Initiate called");

        require(borrowToken != flashLoanToken, "Change flash loan lender");

        uint256 flashLoanTokenPrice = oracle.getUnderlyingPrice(flashLoanToken);
        uint256 borrowTokenPrice = oracle.getUnderlyingPrice(borrowToken);

        require(borrowTokenPrice > 0, "No borrow token price");
        require(flashLoanTokenPrice > 0, "No flash loan token price");

        uint256 flashLoanAmount = borrowAmount.mul(borrowTokenPrice) / flashLoanTokenPrice;
        flashLoanAmount = flashLoanAmount + (flashLoanAmount.mul(30) / 10000);

        bytes memory data = abi.encode(
            borrower, 
            borrowToken, 
            borrowAmount,
            collateralToken);

        IERC3156FlashLender(flashLoanToken).flashLoan(
            this,
            msg.sender,
            flashLoanAmount,
            data
        );

        console.log("Done");
    }
}
