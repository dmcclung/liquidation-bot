import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { ethers, network } from "hardhat";

import joelensAbi from "../external/JoeLens.json";
import joetrollerAbi from "../external/Joetroller.json";

const admin = "0x5D3e4C0FE11e0aE4c32F0FF74B4544C49538AC61";
const oracle = "0xe34309613B061545d42c4160ec4d64240b114482";
const borrower = "0xac5bcf653bd20ddc39f42128d4d50cb085c1e886";
const joeRouter = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";
const flashLoanToken = "0x929f5caB61DFEc79a5431a7734a68D714C4633fa";
const joelensAddress = "0x997fbA28c75747417571c5F3fe50015AaC2BB073";
const joetrollerAddress = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";

let joelens: Contract;
let joetroller: Contract;
let adminJoetroller: Contract;

interface JTokenBalance {
  balanceOfUnderlyingCurrent: BigNumber;
  borrowBalanceCurrent: BigNumber;
  collateralEnabled: boolean;
  borrowValueUSD: BigNumber;
  supplyValueUSD: BigNumber;
  jToken: string;
}

beforeEach(async () => {
  await ethers.provider.send("hardhat_reset", [
    {
      forking: {
        jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
        blockNumber: 6668174,
      },
    },
  ]);
});

before(async () => {
  joelens = await ethers.getContractAt(joelensAbi, joelensAddress);
  joetroller = await ethers.getContractAt(joetrollerAbi, joetrollerAddress);

  const adminSigner = await ethers.getSigner(admin);
  adminJoetroller = await ethers.getContractAt(
    joetrollerAbi,
    joetrollerAddress,
    adminSigner
  );
});

describe("FlashloanBorrower", () => {
  it("should liquidate an unhealthy account", async () => {
    logAccountLimits(borrower);

    // Iterate through `tokens` and find a borrow position to repay
    const markets = await joetroller.callStatic.getAssetsIn(borrower);

    const jTokenBalances: JTokenBalance[] =
      await joelens.callStatic.jTokenBalancesAll(markets, borrower);

    jTokenBalances.sort((a: JTokenBalance, b: JTokenBalance) => {
      if (a.borrowValueUSD.gt(b.borrowValueUSD)) {
        return -1;
      } else if (b.borrowValueUSD.gt(a.borrowValueUSD)) {
        return 1;
      } else {
        return 0;
      }
    });

    const borrowPosition = jTokenBalances[0];
    expect(borrowPosition.borrowValueUSD.gt(0)).to.be.true;

    console.log("jToken", borrowPosition.jToken);
    console.log(
      "Collateral balance",
      ethers.utils.formatUnits(borrowPosition.balanceOfUnderlyingCurrent)
    );
    console.log(
      "Borrow balance",
      ethers.utils.formatUnits(borrowPosition.borrowBalanceCurrent)
    );

    await logCollateralFactor(borrowPosition.jToken);

    await setCollateralFactor(borrowPosition.jToken, "0.55");

    await logCollateralFactor(borrowPosition.jToken);

    await logAccountLimits(borrower);

    // Iterate through `tokens` and find a supply position to seize. Seizable position must satisfy:
    // a. supplyBalanceUnderlying > 0
    // b. enterMarket == true (otherwise it’s not posted as collateral)
    // c. Must have enough supplyBalanceUnderlying to seize 50% of borrow value

    let seizablePosition;
    for (let i = 0; i < jTokenBalances.length; i++) {
      if (
        jTokenBalances[i].collateralEnabled &&
        jTokenBalances[i].balanceOfUnderlyingCurrent.gt(0)
      ) {
        if (
          jTokenBalances[i].supplyValueUSD.gte(
            jTokenBalances[i].borrowValueUSD.div(2)
          )
        ) {
          seizablePosition = jTokenBalances[i];
        }
      }
    }

    if (!seizablePosition) {
      throw new Error("Collateral not found");
    }

    const FlashloanBorrower = await ethers.getContractFactory(
      "FlashloanBorrower"
    );
    const flashloanBorrower = await FlashloanBorrower.deploy(
      oracle,
      joeRouter,
      joetrollerAddress
    );
    await flashloanBorrower.deployed();

    const maxRepayAmount = borrowPosition.borrowBalanceCurrent.div(2);

    await expect(
      flashloanBorrower.initiate(
        borrower,
        borrowPosition.jToken,
        maxRepayAmount,
        seizablePosition.jToken,
        flashLoanToken
      )
    ).to.emit(flashloanBorrower, "LiquidateSuccess");
  });
});

const logAccountLimits = async (account: string) => {
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

const logCollateralFactor = async (jToken: string) => {
  const market = await joetroller.markets(jToken);
  console.log(
    "collateralFactor:",
    ethers.utils.formatEther(market.collateralFactorMantissa)
  );
};

const setCollateralFactor = async (
  jToken: string,
  collateralFactor: string
) => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [admin],
  });

  const tx = await adminJoetroller._setCollateralFactor(
    jToken,
    ethers.utils.parseEther(collateralFactor)
  );
  await tx.wait();
};
