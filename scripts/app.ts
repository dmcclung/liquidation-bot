import { ApolloClient, InMemoryCache, gql, HttpLink } from '@apollo/client'
import { ethers } from "ethers"
import fetch from 'cross-fetch'

const uri = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/lending'

const underwaterQuery = `
  {
    accounts(where: {health_gt: 0, health_lt: 1.006, totalBorrowValueInUSD_gt: 0}) {
      id
      health
      totalBorrowValueInUSD
      totalCollateralValueInUSD
    }
  }
`

const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface Account {
  id: string,
  health: string,
  totalBorrowValueInUSD: string,
  totalCollateralValueInUSD: string
}

const provider = new ethers.providers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');

const go = async() => {
  const client = new ApolloClient({
    link: new HttpLink({ uri, fetch }),
    cache: new InMemoryCache(),
  })

  const { data } = await client.query({
    query: gql(underwaterQuery)
  })

  const accounts = [...(data.accounts)]
  accounts.sort((a: Account, b: Account) => {
    if (a.health < b.health) {
      return -1
    } else if (a.health > b.health) {
      return 1
    } else {
      return 0
    }
  })

  console.log(accounts)
  const blockNumber = await provider.getBlockNumber()
  console.log(`Current block number ${blockNumber}`)
}

go().catch(err => console.log(`Error querying graph: ${err}`))
