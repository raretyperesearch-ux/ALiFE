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

const PLACEHOLDER_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6QIEBwMwN5l6UAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAARklEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAN1+AABVhDU0QAAAABJRU5ErkJggg=='

export const deployToken = async (params: FlaunchDeployParams): Promise<FlaunchDeployResult> => {
  const privateKey = process.env.PLATFORM_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('Missing PLATFORM_PRIVATE_KEY environment variable')
  }

  console.log(`Deploying token ${params.symbol} via Flaunch...`)

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

  const hash = await flaunch.flaunchIPFS({
    name: params.name,
    symbol: params.symbol.toUpperCase(),
    metadata: {
      base64Image: PLACEHOLDER_PNG,
      description: params.description || `ALiFe Agent - ${params.name}`,
      websiteUrl: 'https://alife.xyz',
    },
    fairLaunchPercent: 0,
    fairLaunchDuration: 30 * 60,
    initialMarketCapUSD: 5000,
    creator: params.platformWallet as `0x${string}`,
    creatorFeeAllocationPercent: 100,
  })

  console.log(`Flaunch tx submitted: ${hash}`)

  // Wait for receipt with retries
  let poolData = null
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000)) // wait 3 sec
    try {
      poolData = await flaunch.getPoolCreatedFromTx(hash)
      if (poolData) break
    } catch (e) {
      console.log(`Waiting for receipt... attempt ${i + 1}`)
    }
  }
  
  if (!poolData) {
    throw new Error(`Transaction submitted but receipt not found. Hash: ${hash}`)
  }

  console.log(`Token deployed: ${poolData.memecoin}`)

  return {
    tokenAddress: poolData.memecoin,
    txHash: hash,
  }
}
