import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import fetch from "cross-fetch";
import dotenv from "dotenv";

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
}

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
    accounts = accounts.filter((account) => {
      return (
        account.totalCollateralValueInUSD >=
        account.totalBorrowValueInUSD.div(2)
      );
    });

    console.log("%s accounts with sufficient collateral", accounts.length);

    accounts.forEach(async (account: Account) => {
      console.log(account.totalBorrowValueInUSD);
      console.log(account.totalCollateralValueInUSD);
      // If profitable, execute liquidate on address
      const revenue = account.totalBorrowValueInUSD.div(2).mul(110).div(100);
      console.log(ethers.utils.formatUnits(revenue));

      // Subtract gas fees and swap / flash loan fees
      const gasPrice = await ethers.provider.getGasPrice();
      const gasCost = gasPrice.mul("300000");

      const fees = revenue.mul(68).div(10000);

      const profit = revenue.sub(fees).sub(gasCost);

      if (profit.gt(0)) {
        const tx = await flashloanBorrower.liquidate(account.id);
        await tx.wait();
      }
    });

    console.log("Finished iteration, waiting");
    await sleep(10000);
  }
};

go().catch((err) => console.log(`Error: ${err}`));
