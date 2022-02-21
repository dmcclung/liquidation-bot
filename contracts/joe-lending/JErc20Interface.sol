//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface JErc20Interface {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
    function repayBorrow(uint256 repayAmount) external returns (uint256);
    function repayBorrowBehalf(address borrower, uint256 repayAmount) external returns (uint256);
    function liquidateBorrow(
        address borrower,
        uint256 repayAmount,
        address jTokenCollateral
    ) external returns (uint256);
    function _addReserves(uint256 addAmount) external returns (uint256);
    function underlying() external view returns (address);
    function accrueInterest() external returns (uint256);
}