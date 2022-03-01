import Twitter from "twitter";
import dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config();

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY || "",
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET || "",
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY || "",
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
});

async function tweet() {
  try {
    await client.post("statuses/update", { status: "Successful liquidation" });
  } catch (err) {
    console.log(err);
  }
}

async function main() {
  if (!process.env.FLASH_LOAN_ADDRESS) {
    throw new Error("Set flash loan address and restart");
  }

  // keep our process running
  setInterval(() => {}, 1 << 30);

  const FlashloanBorrower = await ethers.getContractFactory(
    "FlashloanBorrower"
  );

  const flashloanBorrower = await FlashloanBorrower.attach(
    process.env.FLASH_LOAN_ADDRESS
  );

  console.log("Attached to contract at", process.env.FLASH_LOAN_ADDRESS);

  flashloanBorrower.on("LiquidateSuccess", () => {
    tweet();
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
