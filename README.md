# Trader Joe Liquidation Bot Bounty
This project demonstrates the concepts and implementation of a liquidation bot specifically for use with the Trader Joe DEX on Avalanche's C-chain.

This project comes with unit tests, contracts, interfaces to external contracts, and scripts to deploy and run the liquidation bot.

# What is a liquidation
A liquidation is an operation to cleanup underwater accounts on a decentralized exchange. Decentralized exchanges have no management that issue margin calls when accounts become undercollateralized; therefore, lending platforms must provide incentives and 
the ability for third parties to perform flash loans that than repay borrows and seize collateral within certain constraints.

The primary constraint is up to 50% of the borrow amount can be seized. Therefore, the amount of collateral owned by the borrower must be sufficient or at least 50% of the borrow value.

# Source code
scripts/app.ts
This is the primary script that can be run to monitor for unhealthy accounts and liquidate those meeting the criteria.

scripts/deploy.ts
This is the hardhat deploy script.

test/FlashloanBorrower.ts
Unit tests which call the liquidate function of the FlashloanBorrower contract.

# Runtime options
Compiles all contracts and produces typechain for typescript scripts.
```shell
yarn compile
```

Runs all mocha tests
```shell
yarn test
```

Run app.ts script against Avalanche mainnet
```shell
yarn run
```

Run app.ts script against Avalanche fuji (Note that Trader Joe is not deployed to Fuji)
```shell
yarn run:test
```

Deploy contracts to Avalanche mainnet
```shell
yarn deploy
```

Deploy contracts to Avalance fuji
```shell
yarn deploy:test
```

# Future Improvements
A telegram / discord / twitter bot could be written that listens for the LiquidateSuccess event. The event would need a couple of parameters including the liquidator, borrower, and seized collateral amount.

The contract could be updated to do multiple positions owned by a borrower. Right now, it only picks the greatest borrow position and greatest collateral position.

app.ts could also be updated to save unhealthy or slightly healthy accounts to a file or db between runs. The script could also look for unprofitable gas prices and not liquidate when gas is above a certain price relative to the collateral being seized.

I'd also like to optmize the solidity to reduce gas costs.

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
