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

export const getAvaxPrice = async () => {
  const priceOracle = await ethers.getContractAt(oracleAbi, oracle);
  const price = await priceOracle.getUnderlyingPrice(javax);
  return price;
};

export const calculateProfit = async (
  txRes: any,
  tx: any,
  balanceDifference: BigNumber
): Promise<BigNumber> => {
  const gasUsed = txRes.gasUsed;
  const gasLimit = tx.gasLimit;
  const gasPrice = txRes.effectiveGasPrice;

  console.log("Gas used", gasUsed);
  console.log("Gas limit", gasLimit);
  console.log("Effective gas price", gasPrice);

  const transactionFee = gasUsed.mul(gasPrice);
  console.log("Transaction fee", transactionFee);

  const avaxPrice = await getAvaxPrice();
  console.log("AVAX Price USD", avaxPrice);

  const transactionFeeUSD = transactionFee
    .mul(avaxPrice)
    .div(BigNumber.from(10).pow(18));
  console.log(
    "Transaction fee USD",
    ethers.utils.formatUnits(transactionFeeUSD)
  );

  const balanceDeltaUSD = balanceDifference
    .mul(avaxPrice)
    .div(BigNumber.from(10).pow(18));

  console.log("Account change USD", ethers.utils.formatUnits(balanceDeltaUSD));
  return balanceDeltaUSD;
};
