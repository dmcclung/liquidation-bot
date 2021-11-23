//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract Liquidator {

    constructor() {
        console.log("Deploying TraderJoe liquidator");
    }

    function liquidate(address account) public {
        console.log("Liquidate %s", account);
    }
}
