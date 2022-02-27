import { expect } from "chai";
import { ethers } from "hardhat";
import { setCollateralFactor } from "./TestHelper";
import {
  javax,
  oracle,
  joeRouter,
  joelens as joelensAddress,
  joetroller as joetrollerAddress,
} from "../scripts/addresses";
import { calculateProfit } from "../scripts/calculateProfit";

describe("FlashloanBorrower", () => {
  it("should liquidate when tokens are different", async () => {
    const borrower = "0xff599e47baec9b0ff247e35024143edd08a6a91b";

    await ethers.provider.send("hardhat_reset", [
      {
        forking: {
          jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
          blockNumber: 11426497,
        },
      },
    ]);

    const FlashloanBorrower = await ethers.getContractFactory(
      "FlashloanBorrower"
    );

    const flashloanBorrower = await FlashloanBorrower.deploy(
      oracle,
      joeRouter,
      joelensAddress,
      joetrollerAddress
    );

    await flashloanBorrower.deployed();

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const balanceStart = await ethers.provider.getBalance(deployer.address);

    const tx = await flashloanBorrower.liquidate(borrower);
    const txRes = await tx.wait();

    const balanceEnd = await ethers.provider.getBalance(deployer.address);
    const balanceDifference = balanceEnd.sub(balanceStart);

    const profit = await calculateProfit(
      txRes.gasUsed,
      txRes.effectiveGasPrice,
      balanceDifference
    );

    expect(profit.lt(0)).to.be.true;
  });

  it("should liquidate when tokens are the same", async () => {
    const borrower = "0xac5bcf653bd20ddc39f42128d4d50cb085c1e886";

    await ethers.provider.send("hardhat_reset", [
      {
        forking: {
          jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
          blockNumber: 6668174,
        },
      },
    ]);

    // Force account underwater
    await setCollateralFactor(javax, "0.55");

    const FlashloanBorrower = await ethers.getContractFactory(
      "FlashloanBorrower"
    );

    const flashloanBorrower = await FlashloanBorrower.deploy(
      oracle,
      joeRouter,
      joelensAddress,
      joetrollerAddress
    );

    await flashloanBorrower.deployed();

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const balanceStart = await ethers.provider.getBalance(deployer.address);

    const tx = await flashloanBorrower.liquidate(borrower);
    const txRes = await tx.wait();

    const balanceEnd = await ethers.provider.getBalance(deployer.address);
    const balanceDifference = balanceEnd.sub(balanceStart);

    const profit = await calculateProfit(
      txRes.gasUsed,
      txRes.effectiveGasPrice,
      balanceDifference
    );

    expect(profit.gt(0)).to.be.true;
  });
});
