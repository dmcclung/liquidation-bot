# liquidation bot

# Mock code
```
const priceOracleAddress = "0xe34309613B061545d42c4160ec4d64240b114482";

const mockPriceOracleBytecode =
      "0x6080604052348015600f57600080fd5b506004361060285760003560e01c8063fc57d4df14602d575b600080fd5b605060048036036020811015604157600080fd5b50356001600160a01b03166062565b60408051918252519081900360200190f35b600073c22f01ddc8010ee05574028528614634684ec29e6001600160a01b038316141560965750671b455da60233e80060a2565b506804fc4598cedb5be8005b91905056fea265627a7a72315820c25c8c88d94234b6d7579c86a1c033cbc5229ab85b4d1727f3eaf0b6572a36c464736f6c63430005100032";
await ethers.provider.send("hardhat_setCode", [
    priceOracleAddress,
    mockPriceOracleBytecode,
])

const priceOracle = await ethers.getContractAt(
      priceOracleAbi,
      priceOracleAddress
    );
const avaxPrice = await priceOracle.callStatic.getUnderlyingPrice(tokenId);
console.log("Price of avax", ethers.utils.formatEther(avaxPrice));
```

# Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/sample-script.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).
