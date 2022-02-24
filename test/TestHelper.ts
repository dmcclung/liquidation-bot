import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import joetrollerAbi from "../external/Joetroller.json";
import joelensAbi from "../external/JoeLens.json";
import oracleAbi from "../external/PriceOracle.json";

import {
  admin,
  javax,
  oracle,
  joelens as joelensAddress,
  joetroller as joetrollerAddress,
} from "./Addresses";

export const logAccountLimits = async (account: string) => {
  const accountLimits = await getAccountLimits(account);

  console.log(
    "TotalCollateralValueUSD: %s, TotalBorrowValueUSD: %s, HealthFactor: %s",
    ethers.utils.formatEther(accountLimits.totalCollateralValueUSD),
    ethers.utils.formatEther(accountLimits.totalBorrowValueUSD),
    ethers.utils.formatEther(accountLimits.healthFactor)
  );
};

export const getAccountLimits = async (account: string) => {
  const joelens = await ethers.getContractAt(joelensAbi, joelensAddress);

  const accountLimits = await joelens.callStatic.getAccountLimits(
    joetrollerAddress,
    account
  );

  return accountLimits;
};

export const logCollateralFactor = async (jToken: string) => {
  const joetroller = await ethers.getContractAt(
    joetrollerAbi,
    joetrollerAddress
  );
  const market = await joetroller.markets(jToken);
  console.log(
    "collateralFactor:",
    ethers.utils.formatEther(market.collateralFactorMantissa)
  );
};

export const setCollateralFactor = async (
  jToken: string,
  collateralFactor: string
) => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [admin],
  });

  const adminSigner = await ethers.getSigner(admin);
  const adminJoetroller = await ethers.getContractAt(
    joetrollerAbi,
    joetrollerAddress,
    adminSigner
  );

  const tx = await adminJoetroller._setCollateralFactor(
    jToken,
    ethers.utils.parseEther(collateralFactor)
  );
  await tx.wait();
};

export const calculateProfit = async (
  borrower: string,
  gasUsed: BigNumber,
  gasPrice: BigNumber
) => {
  const { totalBorrowValueUSD } = await getAccountLimits(borrower);

  const repayed = totalBorrowValueUSD.div(2);

  const revenue = totalBorrowValueUSD.div(2).mul(110).div(100).sub(repayed);

  // Subtract gas fees and swap / flash loan fees
  const avaxPriceUSD = await getAvaxPrice();
  const gasCostUSD = gasPrice.div(avaxPriceUSD).mul(gasUsed);

  // Two swaps for 30 bips each and an 8 bips flash loan
  const fees = revenue.mul(68).div(10000);

  const profit = revenue.sub(fees).sub(gasCostUSD);
  return profit;
};

export const getAvaxPrice = async () => {
  const priceOracle = await ethers.getContractAt(oracleAbi, oracle);
  const price = await priceOracle.getUnderlyingPrice(javax);
  return price;
};
