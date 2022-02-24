import { ethers, network } from "hardhat";

import joetrollerAbi from "../external/Joetroller.json";
import joelensAbi from "../external/JoeLens.json";

import {
  admin,
  joelens as joelensAddress,
  joetroller as joetrollerAddress,
} from "./Addresses";

export const logAccountLimits = async (account: string) => {
  const joelens = await ethers.getContractAt(joelensAbi, joelensAddress);

  const accountLimits = await joelens.callStatic.getAccountLimits(
    joetrollerAddress,
    account
  );

  console.log(
    "TotalCollateralValueUSD: %s, TotalBorrowValueUSD: %s, HealthFactor: %s",
    ethers.utils.formatEther(accountLimits.totalCollateralValueUSD),
    ethers.utils.formatEther(accountLimits.totalBorrowValueUSD),
    ethers.utils.formatEther(accountLimits.healthFactor)
  );
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
