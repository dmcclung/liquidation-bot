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


contract FlashloanBorrower is IERC3156FlashBorrower, Ownable {
    using SafeMath for uint256;

    address private constant ROUTER = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;
    address private constant ORACLE = 0xe34309613B061545d42c4160ec4d64240b114482;
    address private constant CONTROLLER = 0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC;

    constructor() {
        console.log("Deployed", msg.sender);
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
        require(JoetrollerInterface(CONTROLLER).isMarketListed(msg.sender), "Did this come from a jToken?");

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
        ERC20(flashLoanToken).approve(ROUTER, flashLoanAmount);

        address[] memory path = new address[](2);
        path[0] = flashLoanToken;
        path[1] = JErc20Interface(borrowToken).underlying();

        IJoeRouter02(ROUTER).swapExactTokensForTokens(
            flashLoanAmount, 
            borrowAmount, 
            path, 
            address(this), 
            block.timestamp
        );

        // TODO: Debug amounts from swap and debug liquidateBorrow called, get error
        liquidateDebug(borrower, borrowToken, borrowAmount, collateralToken);

        // uint256 accrueDebug = JErc20Interface(collateralToken).accrueInterest();
        // uint256 repayBorrowDebug = JoetrollerInterface(CONTROLLER).repayBorrowAllowed(borrowToken, address(this), borrower, borrowAmount);
        // console.log("repay borrow debug", repayBorrowDebug);
        
        // console.log("Accrue debug", accrueDebug);

        calculateSeizeTokensDebug(borrowToken, collateralToken, borrowAmount);
        
        console.log("Clltrl Token", collateralToken);
        console.log("Borrow Token", borrowToken);
        console.log("Borrow Amnt ", borrowAmount);

        // TODO: Approve WAVAX transferIn 
        ERC20(JErc20Interface(borrowToken).underlying()).approve(borrowToken, borrowAmount);

        JErc20Interface(borrowToken).liquidateBorrow(borrower, borrowAmount, collateralToken);

        // Redeem and then swap to flash loan token to repay the flash loan
        uint256 redeemedBalance = redeemCollateral(
            collateralToken, 
            JErc20Interface(collateralToken).underlying()
        );

        console.log("Redeemed balance", redeemedBalance);

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
            borrowAmount, 
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
        ERC20(underlying).approve(ROUTER, redeemedBalance);

        uint256 flashAmountPlusFee = flashLoanAmount + fee;

        address[] memory path = new address[](2);
        path[0] = underlying;
        path[1] = flashLoanToken;

        // Swap redeemed tokens for flash loan amount plus fee
        uint256[] memory swappedAmounts = IJoeRouter02(ROUTER).swapTokensForExactTokens(
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
        uint256 borrowAmount, 
        uint256 remainingBalance
    ) internal {
        if (underlying == IJoeRouter02(ROUTER).WAVAX()) {
            IWAVAX(underlying).withdraw(
                ERC20(underlying).balanceOf(address(this))
            );
            return;
        }

        ERC20(underlying).approve(ROUTER, remainingBalance);
        console.log("Underlying approved");

        // Swap remaining to AVAX
        console.log("Underlying", underlying);
        uint256 redeemedPrice = PriceOracle(ORACLE).getUnderlyingPrice(underlying);
        console.log("Redeemed price", redeemedPrice);

        uint256 avaxPrice = PriceOracle(ORACLE).getUnderlyingPrice(IJoeRouter02(ROUTER).WAVAX());
        console.log("Avax price", avaxPrice);

        uint256 avaxAmount = borrowAmount.mul(avaxPrice) / redeemedPrice;

        console.log("AVAX Amount min", avaxAmount);
        console.log("Remaining balance", remainingBalance);
        console.log("Underlying", underlying);

        address[] memory path = new address[](2);
        path[0] = underlying;
        path[1] = IJoeRouter02(ROUTER).WAVAX();

        IJoeRouter02(ROUTER).swapExactTokensForAVAX(
            remainingBalance, 
            avaxAmount, 
            path,
            address(this), 
            block.timestamp
        );
    }

    function calculateSeizeTokensDebug(
        address borrowToken,
        address collateralToken,
        uint256 borrowAmount
    ) internal view {
        (uint256 err, uint256 seizeTokensCalculated) = JoetrollerInterface(CONTROLLER).liquidateCalculateSeizeTokens(
            borrowToken,
            collateralToken,
            borrowAmount
        );

        console.log("error", err, "seizeTokens", seizeTokensCalculated);
    }

    function seizeDebug(
        address jTokenCollateral,
        address jTokenBorrowed,
        address borrower,
        uint256 seizeAmount
    ) internal {
        uint256 allowed = JoetrollerInterface(CONTROLLER).seizeAllowed(
            jTokenCollateral, 
            jTokenBorrowed, 
            address(this), 
            borrower, 
            seizeAmount
        );

        console.log("Seize allowed %s", allowed);
    }

    function liquidateDebug(
        address borrower,
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken
    ) internal {
        uint256 allowed = JoetrollerInterface(CONTROLLER).liquidateBorrowAllowed(
            borrowToken,
            collateralToken,
            address(this),
            borrower,
            borrowAmount
        );
        
        console.log("Liquidate borrow allowed %s", allowed);
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

        uint256 flashLoanTokenPrice = PriceOracle(ORACLE).getUnderlyingPrice(flashLoanToken);
        uint256 borrowTokenPrice = PriceOracle(ORACLE).getUnderlyingPrice(borrowToken);

        require(borrowTokenPrice > 0, "No borrow token price");
        require(flashLoanTokenPrice > 0, "No flash loan token price");

        uint256 flashLoanAmount = borrowAmount.mul(borrowTokenPrice) / flashLoanTokenPrice;
        flashLoanAmount = flashLoanAmount + (flashLoanAmount.mul(30) / 10000);



        seizeDebug(collateralToken, borrowToken, borrower, borrowAmount);

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
    }
}
