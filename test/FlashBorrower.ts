import { expect } from "chai";
import { ethers, network } from "hardhat";

// import jTokenAbi from "../external/JToken.json";
import joelensAbi from "../external/JoeLens.json";
import joetrollerAbi from "../external/Joetroller.json";
import priceOracleAbi from "../external/PriceOracle.json";

describe("FlashBorrower", () => {
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

  const admin = "0x5D3e4C0FE11e0aE4c32F0FF74B4544C49538AC61";
  const tokenId = "0xC22F01ddc8010Ee05574028528614634684EC29e";
  const accountId = "0xac5bcf653bd20ddc39f42128d4d50cb085c1e886";
  const joelensAddress = "0x997fbA28c75747417571c5F3fe50015AaC2BB073";
  const joetrollerAddress = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";
  const priceOracleAddress = "0xe34309613B061545d42c4160ec4d64240b114482";

  const printAccountLimits = async () => {
    const joelens = await ethers.getContractAt(joelensAbi, joelensAddress);
    const accountLimits = await joelens.callStatic.getAccountLimits(
      joetrollerAddress,
      accountId
    );

    console.log(
      "TotalCollateralValueUSD: %s, TotalBorrowValueUSD: %s, HealthFactor: %s",
      ethers.utils.formatEther(accountLimits.totalCollateralValueUSD),
      ethers.utils.formatEther(accountLimits.totalBorrowValueUSD),
      ethers.utils.formatEther(accountLimits.healthFactor)
    );
  };

  const printAvaxPrice = async () => {
    const priceOracle = await ethers.getContractAt(
      priceOracleAbi,
      priceOracleAddress
    );
    const avaxPrice = await priceOracle.callStatic.getUnderlyingPrice(tokenId);
    console.log("Price of avax", ethers.utils.formatEther(avaxPrice));
  };

  const printCollateralFactor = async () => {
    const joetroller = await ethers.getContractAt(
      joetrollerAbi,
      joetrollerAddress
    );
    const market = await joetroller.markets(tokenId);
    console.log(
      "collateralFactorMantissa:",
      ethers.utils.formatEther(market.collateralFactorMantissa)
    );
  };

  /* const getBalances = async () => {
    const jToken = await ethers.getContractAt(jTokenAbi, tokenId);
    // Nominal tokens
    const jTokenBalance = ethers.utils.formatEther(
      await jToken.callStatic.balanceOf(accountId)
    );
    const borrowBalanceCurrent = ethers.utils.formatEther(
      await jToken.callStatic.borrowBalanceCurrent(accountId)
    );
    const balanceOfUnderlyingCurrent = ethers.utils.formatEther(
      await jToken.callStatic.balanceOfUnderlying(accountId)
    );
    return {
      jTokenBalance,
      borrowBalanceCurrent,
      balanceOfUnderlyingCurrent,
    };
  }; */

  const getJTokenBalances = async () => {
    const joelens = await ethers.getContractAt(joelensAbi, joelensAddress);
    const balances = await joelens.callStatic.jTokenBalances(
      tokenId,
      accountId
    );

    return balances;
  };

  it("should liquidate an unhealthy account", async () => {
    const joetroller = await ethers.getContractAt(
      joetrollerAbi,
      joetrollerAddress
    );

    expect(joetroller).to.be.not.undefined;

    const joelens = await ethers.getContractAt(joelensAbi, joelensAddress);
    expect(joelens).to.be.not.undefined;

    await printAccountLimits();

    await printCollateralFactor();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [admin],
    });

    const adminSigner = await ethers.getSigner(admin);
    const adminJoetroller = await ethers.getContractAt(
      joetrollerAbi,
      joetrollerAddress,
      adminSigner
    );

    const tx = await adminJoetroller._setCollateralFactor(
      tokenId,
      ethers.BigNumber.from("550000000000000000")
    );
    await tx.wait();

    await printCollateralFactor();

    await printAccountLimits();

    await printAvaxPrice();

    const mockPriceOracleBytecode =
      "0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063fc57d4df14602d575b600080fd5b605060048036036020811015604157600080fd5b50356001600160a01b03166062565b60408051918252519081900360200190f35b600073c22f01ddc8010ee05574028528614634684ec29e6001600160a01b038316141560965750671b455da60233e80060a2565b506804fc4598cedb5be8005b91905056fea265627a7a72315820c25c8c88d94234b6d7579c86a1c033cbc5229ab85b4d1727f3eaf0b6572a36c464736f6c63430005100032";
    await ethers.provider.send("hardhat_setCode", [
      priceOracleAddress,
      mockPriceOracleBytecode,
    ]);

    await printAvaxPrice();

    // Iterate through `tokens` and find a borrow position to repay
    // const { jTokenBalance, borrowBalanceCurrent, balanceOfUnderlyingCurrent } = await getBalances()
    const balances = await getJTokenBalances();

    const {
      balanceOfUnderlyingCurrent,
      borrowBalanceCurrent,
      collateralEnabled,
    } = balances;

    // Iterate through `tokens` and find a supply position to seize. Seizable position must satisfy:
    // a. supplyBalanceUnderlying > 0
    // b. enterMarket == true (otherwise it’s not posted as collateral)
    // c. Must have enough supplyBalanceUnderlying to seize 50% of borrow value

    // TODO:
    // get supply balance of jAvax / avax

    // is it greater than 0

    expect(balanceOfUnderlyingCurrent).to.be.gt(ethers.BigNumber.from(0));
    // enterMarket == true or collateralEnabled?
    expect(collateralEnabled).to.be.true;
    // assert that supplyBalanceUnderlying is greater than 50% of borrow value
    expect(balanceOfUnderlyingCurrent).to.be.gt(
      borrowBalanceCurrent.div(ethers.BigNumber.from(2))
    );

    const FlashBorrower = await ethers.getContractFactory("FlashBorrower");
    const flashBorrower = await FlashBorrower.deploy();
    await flashBorrower.deployed();

    const flashTx = await flashBorrower.initiateFlashLoan(
      accountId,
      tokenId,
      borrowBalanceCurrent
    );
    await flashTx.wait();

    // Perform flash loan:
    // a. Borrow borrowed token to repay borrow position.
    // b. Redeem underlying seized tokens
    // c. Swap underlying seized tokens for AVAX using Trader Joe router
    // d. Calculate profit made after gas

    // LiquidateEvent
  });
});
