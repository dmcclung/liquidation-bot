//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface PriceOracle {
    function getUnderlyingPrice(address jToken) external view returns (uint256);
}