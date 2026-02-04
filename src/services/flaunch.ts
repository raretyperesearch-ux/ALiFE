import { createFlaunch } from '@flaunch/sdk'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

interface FlaunchDeployParams {
  name: string
  symbol: string
  description?: string
  platformWallet: string
  devWallet: string
  agentWallet: string
}

interface FlaunchDeployResult {
  tokenAddress: string
  txHash: string
}

export const deployToken = async (params: FlaunchDeployParams): Promise<FlaunchDeployResult> => {
  const privateKey = process.env.PLATFORM_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('Missing PLATFORM_PRIVATE_KEY environment variable')
  }

  console.log(`Deploying token ${params.symbol} via Flaunch...`)
  console.log(`Fee split: 50% platform, 25% dev, 25% agent`)

  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  })

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  })

  const flaunch = createFlaunch({ publicClient, walletClient }) as any

  const hash = await flaunch.flaunchIPFSWithSplitManager({
    name: params.name,
    symbol: params.symbol.toUpperCase(),
    metadata: {
      image: `https://placehold.co/400x400/1a1a2e/00ff88/png?text=${params.symbol.slice(0, 4)}`,
      description: params.description || `ALiFe Agent - ${params.name}`,
      websiteUrl: 'https://alife.xyz',
    },
    fairLaunchPercent: 0,
    fairLaunchDuration: 30 * 60,
    initialMarketCapUSD: 5000,
    creator: params.platformWallet as `0x${string}`,
    creatorFeeAllocationPercent: 100,
    creatorSplitPercent: 50,
    splitReceivers: [
      { address: params.devWallet as `0x${string}`, percent: 50 },
      { address: params.agentWallet as `0x${string}`, percent: 50 },
    ],
  })

  console.log(`Flaunch tx: ${hash}`)

  const poolData = await flaunch.getPoolCreatedFromTx(hash)
  
  if (!poolData) {
    throw new Error('Failed to get token address from tx')
  }

  console.log(`Token deployed: ${poolData.memecoin}`)

  return {
    tokenAddress: poolData.memecoin,
    txHash: hash,
  }
}
