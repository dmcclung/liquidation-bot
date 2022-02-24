//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct JTokenBalances {
    address jToken;
    uint256 jTokenBalance;              // Same as collateral balance - the number of jTokens held
    uint256 balanceOfUnderlyingCurrent; // Balance of underlying asset supplied by. Accrue interest is not called.
    uint256 supplyValueUSD;
    uint256 collateralValueUSD;         // This is supplyValueUSD multiplied by collateral factor
    uint256 borrowBalanceCurrent;       // Borrow balance without accruing interest
    uint256 borrowValueUSD;
    uint256 underlyingTokenBalance;     // Underlying balance current held in user's wallet
    uint256 underlyingTokenAllowance;
    bool collateralEnabled;
}

interface JoeLensInterface {
    function jTokenBalancesAll(
        address[] memory jTokens, 
        address account
    ) external returns (JTokenBalances[] memory);
}
    
