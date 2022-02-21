// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // Joetroller address
  const joetroller = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";

  // We get the contract to deploy
  const FlashloanBorrower = await ethers.getContractFactory(
    "FlashloanBorrower"
  );
  const flashloanBorrower = await FlashloanBorrower.deploy(joetroller);

  await flashloanBorrower.deployed();

  console.log("FlashloanBorrower deployed to", flashloanBorrower.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
