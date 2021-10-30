import { ApolloClient, InMemoryCache, gql } from '@apollo/client'
import React, { useEffect, useState } from 'react'
import ListGroup from 'react-bootstrap/ListGroup'

const APIURL = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/lending'

const underwaterQuery = `
  {
    accounts(where: {health_gt: 0, health_lt: 1, totalBorrowValueInUSD_gt: 0}) {
      id
      health
      totalBorrowValueInUSD
      totalCollateralValueInUSD
    }
  }
`

const client = new ApolloClient({
  uri: APIURL,
  cache: new InMemoryCache(),
})

export function App() {
  const [underwaterAccounts, setUnderwaterAccounts] = useState([])

  useEffect(() => {
    try {
      (async () => {
        const { data } = await client.query({
          query: gql(underwaterQuery)
        })
        console.log(`Underwater accounts: ${JSON.stringify(data.accounts)}`)

        if (data.accounts) {
          setUnderwaterAccounts(data.accounts)
        }
      })()
    } catch (err) {
      console.log(`Error querying graph: ${err}`)
    }
  })
  
  return (
    <>
      <h1>Liquidator Bot</h1>
      <h2>Underwater Accounts</h2>
      <ListGroup>
        {underwaterAccounts.map((account, index) => {
          <ListGroup.Item key={index}>{account}</ListGroup.Item>
        })}
      </ListGroup>
    </>
  )
}
