//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC3156.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "hardhat/console.sol";

import "./joe-core/IWAVAX.sol";
import "./joe-core/IJoeRouter02.sol";
import "./joe-lending/PriceOracle.sol";
import "./joe-lending/JErc20Interface.sol";
import "./joe-lending/JoeLensInterface.sol";
import "./joe-lending/JoetrollerInterface.sol";

import "./DebugLend.sol";

contract FlashloanBorrower is IERC3156FlashBorrower, Ownable {
    using SafeMath for uint256;

    PriceOracle private oracle;
    IJoeRouter02 private router;
    JoeLensInterface private joelens;
    JoetrollerInterface private joetroller;

    event LiquidateSuccess();

    struct Tokens {
        uint256 totalCollateralUSD;
        uint256 totalBorrowUSD;
        address borrowToken;
        uint256 borrowAmount;
        uint256 borrowValueUSD;
        address flashLoanToken;
        address collateralToken;
        uint256 collateralValueUSD;
    }

    constructor(address _oracle, address _router, address _joelens, address _joetroller) {
        oracle = PriceOracle(_oracle);
        router = IJoeRouter02(_router);
        joelens = JoeLensInterface(_joelens);
        joetroller = JoetrollerInterface(_joetroller);
    }

    receive() external payable {
        console.log("Received AVAX", msg.value);
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

        console.log("Flash token", flashLoanToken);
        console.log("Borrow token", borrowToken);
        console.log("Collateral token", collateralToken);
        console.log("Borrow amount", borrowAmount);
        console.log("Flash amount", flashLoanAmount);

        address[] memory path = new address[](2);
        path[0] = flashLoanToken;
        path[1] = JErc20Interface(borrowToken).underlying();

        uint256[] memory amounts = router.swapExactTokensForTokens(
            flashLoanAmount, 
            borrowAmount, 
            path, 
            address(this), 
            block.timestamp
        );

        console.log("Borrow token output from flash swap", amounts[1]);

        ERC20(JErc20Interface(borrowToken).underlying()).approve(borrowToken, borrowAmount);

        JErc20Interface(borrowToken).liquidateBorrow(borrower, borrowAmount, collateralToken);

        console.log("After liquidate, balance of borrow token", ERC20(borrowToken).balanceOf(address(this)));

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

        console.log("Spent balance", spentBalance);

        // Approve the flash loan lender to take back what is owed
        ERC20(flashLoanToken).approve(msg.sender, flashLoanAmount + fee);

        console.log("Flash amount + fee", flashLoanAmount + fee);

        // Remaining balance of redeemed tokens
        swapRemainingToAVAX(JErc20Interface(collateralToken).underlying());
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

        console.log("Redeemed swapped", swappedAmounts[0]);
        console.log("Flash token amount", swappedAmounts[1]);

        return swappedAmounts[0];
    }

    function swapRemainingToAVAX(address underlying) internal {
        uint256 remainingBalance = ERC20(underlying).balanceOf(address(this));
        if (underlying == router.WAVAX()) {
            IWAVAX(underlying).withdraw(remainingBalance);
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

    function liquidate(address borrower) external onlyOwner {
        console.log("Liquidate called");

        Tokens memory tokens;

        address[] memory jTokens = joetroller.getAssetsIn(borrower);
        JTokenBalances[] memory jTokenBalances = joelens.jTokenBalancesAll(jTokens, borrower);
        for (uint i = 0; i < jTokenBalances.length; i++) {
            JTokenBalances memory jTokenBalance = jTokenBalances[i];
            
            // Check collateral
            if (jTokenBalance.collateralEnabled) {
                if (jTokenBalance.balanceOfUnderlyingCurrent > 0) {
                    tokens.totalCollateralUSD += jTokenBalance.collateralValueUSD;
                    if (tokens.collateralToken == address(0) || 
                        jTokenBalance.collateralValueUSD > tokens.collateralValueUSD) {
                        tokens.collateralToken = jTokenBalance.jToken;
                        tokens.collateralValueUSD = jTokenBalance.collateralValueUSD;
                    }
                }
            }

            // Check borrow
            if (jTokenBalance.borrowValueUSD > 0) {
                tokens.totalBorrowUSD += jTokenBalance.borrowValueUSD;
                if (tokens.borrowToken == address(0) ||
                    jTokenBalance.borrowValueUSD > tokens.borrowValueUSD) {
                    tokens.borrowToken = jTokenBalance.jToken;
                    tokens.borrowValueUSD = jTokenBalance.borrowValueUSD;
                    tokens.borrowAmount = jTokenBalance.borrowBalanceCurrent / 2;
                }
            }
        }

        require(tokens.collateralValueUSD >= (tokens.borrowValueUSD / 2), "Not enough collateral");

        tokens.flashLoanToken = getFlashLoanToken(tokens.borrowToken, tokens.collateralToken);

        initiate(
            borrower, 
            tokens.borrowToken, 
            tokens.borrowAmount, 
            tokens.collateralToken, 
            tokens.flashLoanToken
        );

        emit LiquidateSuccess();

        console.log("Done");
    }

    function getFlashLoanToken(address borrowToken, address collateralToken) internal view returns (address jToken) {
        // return a token that is not the borrowToken
        address[] memory jTokens = joetroller.getAllMarkets();
        for (uint i = 0; i < jTokens.length; i++) {
            if (borrowToken != jTokens[i] && collateralToken != jTokens[i]) {
                return jTokens[i];
            }
        }
    }

    function initiate(
        address borrower,
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken,
        address flashLoanToken
    ) internal {
        console.log("Initiate called");

        require(borrowToken != flashLoanToken, "Change flash loan lender");

        uint256 flashLoanTokenPrice = oracle.getUnderlyingPrice(flashLoanToken);
        uint256 borrowTokenPrice = oracle.getUnderlyingPrice(borrowToken);

        require(borrowTokenPrice > 0, "No borrow token price");
        require(flashLoanTokenPrice > 0, "No flash loan token price");

        uint256 flashLoanAmount = borrowAmount.mul(borrowTokenPrice) / flashLoanTokenPrice;
        flashLoanAmount = flashLoanAmount + (flashLoanAmount.mul(60) / 10000);

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

        Address.sendValue(payable(msg.sender), address(this).balance);
    }

    function withdraw(address asset) external onlyOwner {
        if (asset == address(0)) {
            Address.sendValue(payable(msg.sender), address(this).balance);
        } else {
            uint256 balance = IERC20(asset).balanceOf(address(this));
            IERC20(asset).transfer(msg.sender, balance);
        }
    }
}
