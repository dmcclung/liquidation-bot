import * as dotenv from "dotenv"

import { HardhatUserConfig } from "hardhat/config"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-waffle"
import "@typechain/hardhat"
import "hardhat-gas-reporter"
import "solidity-coverage"

dotenv.config()

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 43114,
      gasPrice: 225000000000,
      forking: {
        url: "https://api.avax.network/ext/bc/C/rpc",
        blockNumber: 6668174
      },
    },
  },
}

export default config
