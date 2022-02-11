//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC3156FlashBorrowerInterface.sol";

import "hardhat/console.sol";

abstract contract JErc20Interface {
    function liquidateBorrow(
        address borrower,
        uint256 repayAmount,
        address jTokenCollateral
    ) virtual external returns (uint256);
}

abstract contract JAvaxInterface {
    function liquidateBorrow(address borrower, address jTokenCollateral) virtual external payable;
    function flashLoan(ERC3156FlashBorrowerInterface receiver, address initiator, uint256 amount, bytes calldata data) virtual external returns (bool);
}


// Perform flash loan:
// a. Borrow borrowed token to repay borrow position.
// b. Redeem underlying seized tokens
// c. Swap underlying seized tokens for AVAX using Trader Joe router

contract FlashBorrower is ERC3156FlashBorrowerInterface {
    constructor() {
        console.log("Deploying TraderJoe FlashBorrower");
    }

     function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) override external returns (bytes32) {
        console.log("onFlashLoan called initator %s, token %s, amount %s", initiator, token, amount);
        console.log("fee %s", fee);

        address borrower = abi.decode(data, (address));
        console.log("borrower %s", borrower);

        // JErc20Interface(token).liquidateBorrow(borrower, repayAmount, token);
        // oh maybe you pass in msg.value
        // where does the value come from in the flash loan
        // JErc20Interface(token).liquidateBorrow(borrower, amount, token);
        
        // TODO Log how much avax we have in our account here?
        // How to debug liquidateBorrow
        JAvaxInterface(token).liquidateBorrow{value: amount}(borrower, token);

        return keccak256("ERC3156FlashBorrowerInterface.onFlashLoan");        
    }

    function initiateFlashLoan(address borrower, address token, uint256 repayAmount) public {
        console.log("initiateFlashLoan called %s %s %s", borrower, token, repayAmount);

        JAvaxInterface(token).flashLoan(this, token, repayAmount, abi.encode(borrower));
    }
}
