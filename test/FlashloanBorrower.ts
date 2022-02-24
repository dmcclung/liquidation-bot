import { expect } from "chai";
import { ethers } from "hardhat";
import { setCollateralFactor, calculateProfit } from "./TestHelper";
import {
  javax,
  oracle,
  joeRouter,
  joelens as joelensAddress,
  joetroller as joetrollerAddress,
} from "./Addresses";

describe("FlashloanBorrower", () => {
  it("should liquidate an unhealthy account", async () => {
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

    // TODO: Calculate profit with balance of Avax - gas expended, pass in price of gas
    /* await expect(flashloanBorrower.liquidate(borrower)).to.emit(
      flashloanBorrower,
      "LiquidateSuccess"
    ); */

    const tx = await flashloanBorrower.liquidate(borrower);
    const txRes = await tx.wait();

    const gasUsed = txRes.gasUsed;
    const gasPrice = txRes.effectiveGasPrice;

    const balanceEnd = await ethers.provider.getBalance(deployer.address);

    const balanceDelta = balanceEnd.sub(balanceStart);
    console.log("Balance Delta", ethers.utils.formatUnits(balanceDelta));

    const profit = await calculateProfit(borrower, gasUsed, gasPrice);
    console.log("Profit USD", ethers.utils.formatUnits(profit));
  });
});
