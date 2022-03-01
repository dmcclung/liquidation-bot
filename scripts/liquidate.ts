import { ethers } from "hardhat";
import { calculateProfit } from "./calculateProfit";
import dotenv from "dotenv";

dotenv.config();

const account = "0xff599e47baec9b0ff247e35024143edd08a6a91b";

const go = async () => {
  if (!process.env.FLASH_LOAN_ADDRESS) {
    throw new Error("Set flash loan address and restart");
  }

  const FlashloanBorrower = await ethers.getContractFactory(
    "FlashloanBorrower"
  );

  const flashloanBorrower = await FlashloanBorrower.attach(
    process.env.FLASH_LOAN_ADDRESS
  );

  console.log("Attached to contract at", process.env.FLASH_LOAN_ADDRESS);

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const balanceStart = await ethers.provider.getBalance(deployer.address);

  console.log("Liquidating", account);
  const tx = await flashloanBorrower.liquidate(account);
  const txRes = await tx.wait();
  console.log("Success");

  const balanceEnd = await ethers.provider.getBalance(deployer.address);
  const balanceDifference = balanceEnd.sub(balanceStart);

  const profit = await calculateProfit(
    txRes.gasUsed,
    txRes.effectiveGasPrice,
    balanceDifference
  );

  console.log("Profit", ethers.utils.formatUnits(profit));
};

go().catch((err) => console.log(`Error: ${err}`));
