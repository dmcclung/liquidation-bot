import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import fetch from "cross-fetch";
import dotenv from "dotenv";
import { calculateProfit } from "./calculateProfit";
import { getAvaxPrice } from "./getAvaxPrice";

dotenv.config();

const uri = "https://api.thegraph.com/subgraphs/name/traderjoe-xyz/lending";

const underwaterQuery = `
  {
    accounts(where: {health_gt: 0, health_lt: 1, totalBorrowValueInUSD_gt: 0}) {
      id
      health
      totalBorrowValueInUSD
      totalCollateralValueInUSD
    }
  }
`;

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

interface Account {
  id: string;
  health: string;
  totalBorrowValueInUSD: BigNumber;
  totalCollateralValueInUSD: BigNumber;
  liquidated: boolean;
  profit: BigNumber;
  error: string;
}

const inMemoryStore = new Map<string, Account>();

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

  const client = new ApolloClient({
    link: new HttpLink({ uri, fetch }),
    cache: new InMemoryCache(),
  });

  while (true) {
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log(`Current block number ${blockNumber}`);

    console.log("Querying thegraph");
    const { data } = await client.query({
      query: gql(underwaterQuery),
    });

    let accounts = [...data.accounts];
    accounts = accounts.map((account) => {
      return {
        id: account.id,
        health: account.health,
        totalBorrowValueInUSD: ethers.utils.parseUnits(
          account.totalBorrowValueInUSD
        ),
        totalCollateralValueInUSD: ethers.utils.parseUnits(
          account.totalCollateralValueInUSD
        ),
      };
    });

    console.log("Found %s unhealthy accounts", accounts.length);

    // Sort by total borrow value in USD
    accounts.sort((a: Account, b: Account) => {
      if (a.totalBorrowValueInUSD.lt(b.totalBorrowValueInUSD)) {
        return 1;
      } else if (a.totalBorrowValueInUSD.gt(b.totalBorrowValueInUSD)) {
        return -1;
      } else {
        return 0;
      }
    });

    // Filter out accounts with insufficient collateral
    const gasPrice = await ethers.provider.getGasPrice();
    const gasCost = BigNumber.from(1.3e6).mul(gasPrice);

    const avaxPrice = await getAvaxPrice();
    const gasCostUSD = gasCost.mul(avaxPrice).div(BigNumber.from(10).pow(18));
    console.log(
      "Estimated gas cost at curent prices: ",
      ethers.utils.formatUnits(gasCostUSD)
    );

    accounts = accounts.filter((account: Account) => {
      return (
        account.totalBorrowValueInUSD.gt(account.totalCollateralValueInUSD) &&
        account.totalCollateralValueInUSD.gte(
          account.totalBorrowValueInUSD.div(2)
        ) &&
        account.totalBorrowValueInUSD.div(2).mul(110).div(100).gt(gasCostUSD)
      );
    });

    console.log("%s accounts with sufficient collateral", accounts.length);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      if (inMemoryStore.has(account.id)) {
        const existingAccount = inMemoryStore.get(account.id);
        if (existingAccount) {
          // If health is unchanged, skip
          if (existingAccount.health === account.health) {
            return;
          }
        }
      }

      try {
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        const balanceStart = await ethers.provider.getBalance(deployer.address);

        console.log(
          "Liquidating %s with collateral value %s",
          account.id,
          account.totalCollateralValueInUSD
        );
        const tx = await flashloanBorrower.liquidate(account.id, {
          gasLimit: 1400000,
        });
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

        account.liquidated = true;
        account.profit = profit;

        inMemoryStore.set(account.id, account);
      } catch (err: any) {
        const message = err.message ? err.message : err;
        console.error(err);

        account.liquidated = false;
        account.error = message;
        inMemoryStore.set(account.id, account);
      }
    }

    console.log("Finished iteration, waiting");
    await sleep(10000);
  }
};

go().catch((err) => console.log(`Error: ${err}`));
