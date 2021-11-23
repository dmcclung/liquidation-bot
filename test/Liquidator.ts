import { expect } from "chai";
import { ethers } from "hardhat";

import joetrollerAbi from "../external/Joetroller.json"
import joelensAbi from "../external/JoeLens.json"
import priceOracleAbi from "../external/PriceOracle.json"

// const hre = require("hardhat")

//const { deployMockContract } = waffle

describe("Liquidator", () => {

  beforeEach(async () => {
    await ethers.provider.send(
      "hardhat_reset",
      [
        {
          forking: {
            jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
            blockNumber: 6668174,
          },
        },
      ],
    )
  })

  it("should liquidate an unhealthy account", async () => {
    const account = {
      id: '0xac5bcf653bd20ddc39f42128d4d50cb085c1e886',
      health: '1.003894048144048031',
      totalBorrowValueInUSD: '2168947.2243808703185106',
      totalCollateralValueInUSD: '2177393.209294508776977733'
    }

    const joetrollerAddress = '0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC'
    const joetroller = await ethers.getContractAt(joetrollerAbi, joetrollerAddress)
    expect(joetroller).to.be.not.undefined

    const joelensAddress = '0x997fbA28c75747417571c5F3fe50015AaC2BB073'
    const joelens = await ethers.getContractAt(joelensAbi, joelensAddress)
    expect(joetroller).to.be.not.undefined

    let accountLimits = await joelens.callStatic.getAccountLimits(joetrollerAddress, account.id)

    console.log('TotalCollateralValueUSD: %s, TotalBorrowValueUSD: %s, HealthFactor: %s',
                accountLimits.totalCollateralValueUSD,
                accountLimits.totalBorrowValueUSD,
                accountLimits.healthFactor)

    const priceOracleAddress = '0xe34309613B061545d42c4160ec4d64240b114482'
    const priceOracle = await ethers.getContractAt(priceOracleAbi, priceOracleAddress)
    const avaxPrice = await priceOracle.callStatic.getUnderlyingPrice('0xC22F01ddc8010Ee05574028528614634684EC29e')
    console.log(`Price of avax: ${avaxPrice}`)

    const mockPriceOracleBytecode = '0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063fc57d4df14602d575b600080fd5b605060048036036020811015604157600080fd5b50356001600160a01b03166062565b60408051918252519081900360200190f35b600073c22f01ddc8010ee05574028528614634684ec29e6001600160a01b038316141560965750671b455da60233e80060a2565b506804fc4598cedb5be8005b91905056fea265627a7a72315820c25c8c88d94234b6d7579c86a1c033cbc5229ab85b4d1727f3eaf0b6572a36c464736f6c63430005100032'
    await ethers.provider.send("hardhat_setCode", [
      priceOracleAddress,
      mockPriceOracleBytecode,
    ])

    const updatedAvaxPrice = await priceOracle.callStatic.getUnderlyingPrice('0xC22F01ddc8010Ee05574028528614634684EC29e')
    console.log(`Price of avax: ${updatedAvaxPrice}`)

    accountLimits = await joelens.callStatic.getAccountLimits(joetrollerAddress, account.id)

    console.log('TotalCollateralValueUSD: %s, TotalBorrowValueUSD: %s, HealthFactor: %s',
                accountLimits.totalCollateralValueUSD,
                accountLimits.totalBorrowValueUSD,
                accountLimits.healthFactor)

    // multiplication overflow
    // call PriceOracle and see if we can find out what the number looks like

    // call joetroller contract and force account into unhealthy status
    // assert that health measured by contract is bad
    // execute flash loan contract against account and seize collateral
    // assert outcome
    /*const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    await greeter.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");*/
  })
})
