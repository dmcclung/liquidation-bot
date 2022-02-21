//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface JoetrollerInterface {
    function closeFactorMantissa() external returns (uint256);

    function enterMarkets(address[] calldata jTokens) external returns (uint256[] memory);
    function exitMarket(address jToken) external returns (uint256);

    function mintAllowed(
        address jToken,
        address minter,
        uint256 mintAmount
    ) external returns (uint256);

    function mintVerify(
        address jToken,
        address minter,
        uint256 mintAmount,
        uint256 mintTokens
    ) external;

    function redeemAllowed(
        address jToken,
        address redeemer,
        uint256 redeemTokens
    ) external returns (uint256);

    function redeemVerify(
        address jToken,
        address redeemer,
        uint256 redeemAmount,
        uint256 redeemTokens
    ) external;

    function borrowAllowed(
        address jToken,
        address borrower,
        uint256 borrowAmount
    ) external returns (uint256);

    function borrowVerify(
        address jToken,
        address borrower,
        uint256 borrowAmount
    ) external;

    function repayBorrowAllowed(
        address jToken,
        address payer,
        address borrower,
        uint256 repayAmount
    ) external returns (uint256);

    function repayBorrowVerify(
        address jToken,
        address payer,
        address borrower,
        uint256 repayAmount,
        uint256 borrowerIndex
    ) external;

    function liquidateBorrowAllowed(
        address jTokenBorrowed,
        address jTokenCollateral,
        address liquidator,
        address borrower,
        uint256 repayAmount
    ) external returns (uint256);

    function liquidateBorrowVerify(
        address jTokenBorrowed,
        address jTokenCollateral,
        address liquidator,
        address borrower,
        uint256 repayAmount,
        uint256 seizeTokens
    ) external;

    function seizeAllowed(
        address jTokenCollateral,
        address jTokenBorrowed,
        address liquidator,
        address borrower,
        uint256 seizeTokens
    ) external returns (uint256);

    function seizeVerify(
        address jTokenCollateral,
        address jTokenBorrowed,
        address liquidator,
        address borrower,
        uint256 seizeTokens
    ) external;

    function transferAllowed(
        address jToken,
        address src,
        address dst,
        uint256 transferTokens
    ) external returns (uint256);

    function transferVerify(
        address jToken,
        address src,
        address dst,
        uint256 transferTokens
    ) external;

    function liquidateCalculateSeizeTokens(
        address jTokenBorrowed,
        address jTokenCollateral,
        uint256 repayAmount
    ) external view returns (uint256, uint256);

    function isMarketListed(
        address jTokenAddress
    ) external view returns (bool);
}

interface JoetrollerInterfaceExtension {
    function checkMembership(address account, address jToken) external view returns (bool);

    function flashloanAllowed(
        address jToken,
        address receiver,
        uint256 amount,
        bytes calldata params
    ) external view returns (bool);
}
