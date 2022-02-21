//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./joe-lending/JoetrollerInterface.sol";
import "hardhat/console.sol";

library DebugLend {
    function liquidateDebug(
        address joetroller,
        address borrower,
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken
    ) internal {
        uint256 allowed = JoetrollerInterface(joetroller).liquidateBorrowAllowed(
            borrowToken,
            collateralToken,
            address(this),
            borrower,
            borrowAmount
        );
        
        console.log("Liquidate borrow allowed", allowed);
    }

    function calculateSeizeTokensDebug(
        address joetroller,
        address borrowToken,
        address collateralToken,
        uint256 borrowAmount
    ) internal view {
        (uint256 err, uint256 seizeTokensCalculated) = JoetrollerInterface(joetroller).liquidateCalculateSeizeTokens(
            borrowToken,
            collateralToken,
            borrowAmount
        );

        console.log("Error", err, "Seize tokens", seizeTokensCalculated);
    }

    function repayBorrowDebug(
        address joetroller,
        address borrowToken,
        address borrower,
        address liquidator,
        uint256 borrowAmount
    ) internal {
        uint256 repayAmount = JoetrollerInterface(joetroller).repayBorrowAllowed(
            borrowToken, 
            liquidator, 
            borrower, 
            borrowAmount
        );

        console.log("Repay borrow allowed", repayAmount);
    }

    function seizeDebug(
        address joetroller,
        address jTokenCollateral,
        address jTokenBorrowed,
        address borrower,
        address liquidator,
        uint256 seizeAmount
    ) internal {
        uint256 allowed = JoetrollerInterface(joetroller).seizeAllowed(
            jTokenCollateral, 
            jTokenBorrowed, 
            liquidator, 
            borrower, 
            seizeAmount
        );

        console.log("Seize allowed", allowed);
    }

}