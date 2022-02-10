import { ethers } from "hardhat";
import joelensAbi from "../external/JoeLens.json";
import joetrollerAbi from "../external/Joetroller.json";

const main = async () => {
  await ethers.provider.send("hardhat_reset", [
    {
      forking: {
        jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
        blockNumber: 7513015,
      },
    },
  ]);

  const accountId = process.env.ACCOUNT_ID;
  const tokenId = "0xC22F01ddc8010Ee05574028528614634684EC29e";
  const joelensAddress = "0x997fbA28c75747417571c5F3fe50015AaC2BB073";
  const joetrollerAddress = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";

  const joelens = await ethers.getContractAt(joelensAbi, joelensAddress);
  const balances = await joelens.callStatic.jTokenBalances(tokenId, accountId);

  const keys = [
    "jTokenBalance",
    "balanceOfUnderlyingCurrent",
    "supplyValueUSD",
    "collateralValueUSD",
    "borrowBalanceCurrent",
    "borrowValueUSD",
    "underlyingTokenBalance",
    "underlyingTokenAllowance",
  ];

  keys.forEach((key) => {
    console.log(key, ethers.utils.formatEther(balances[key]));
  });

  console.log("collateralEnabled", balances.collateralEnabled);

  const joetroller = await ethers.getContractAt(
    joetrollerAbi,
    joetrollerAddress
  );
  const market = await joetroller.markets(tokenId);
  console.log(
    "collateralFactor:",
    ethers.utils.formatEther(market.collateralFactorMantissa)
  );
};

main().catch((err) => console.log(err));
