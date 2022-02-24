import { ethers } from "hardhat";

const oracle = "0xd7Ae651985a871C1BC254748c40Ecc733110BC2E";
const router = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";
const joelens = "0xFDF50FEa3527FaD31Fa840B748FD3694aE8a47cc";
const joetroller = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";

async function main() {
  const FlashloanBorrower = await ethers.getContractFactory(
    "FlashloanBorrower"
  );
  const flashloanBorrower = await FlashloanBorrower.deploy(
    oracle,
    router,
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
