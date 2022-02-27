import { ethers } from "hardhat";
import { oracle, joeRouter, joelens, joetroller } from "./addresses";

async function main() {
  const FlashloanBorrower = await ethers.getContractFactory(
    "FlashloanBorrower"
  );

  const flashloanBorrower = await FlashloanBorrower.deploy(
    oracle,
    joeRouter,
    joelens,
    joetroller
  );

  await flashloanBorrower.deployed();

  console.log("FlashloanBorrower deployed to", flashloanBorrower.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
