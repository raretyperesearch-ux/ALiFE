import { createPublicClient, http, formatEther } from 'viem'
import { base } from 'viem/chains'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
})

export const generateWallet = () => {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return {
    address: account.address,
    privateKey,
  }
}

export const getBalance = async (address: string): Promise<bigint> => {
  return client.getBalance({ address: address as `0x${string}` })
}

export const getEthPrice = async (): Promise<number> => {
  const sources = [
    async () => {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      if (!res.ok) throw new Error('CoinGecko failed')
      const data = await res.json()
      return data.ethereum.usd
    },
    async () => {
      const res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD')
      if (!res.ok) throw new Error('CryptoCompare failed')
      const data = await res.json()
      return data.USD
    },
    async () => {
      const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot')
      if (!res.ok) throw new Error('Coinbase failed')
      const data = await res.json()
      return parseFloat(data.data.amount)
    }
  ]

  for (const source of sources) {
    try {
      const price = await source()
      if (price && price > 0) return price
    } catch (e) {
      continue
    }
  }

  console.warn('All ETH price APIs failed, using fallback price')
  return 2500
}

export const getBalanceUsd = async (address: string): Promise<number> => {
  const balance = await getBalance(address)
  const ethPrice = await getEthPrice()
  const ethBalance = parseFloat(formatEther(balance))
  return ethBalance * ethPrice
}
