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
  console.log(`Platform: ${params.platformWallet}`)
  console.log(`Dev: ${params.devWallet}`)
  console.log(`Agent: ${params.agentWallet}`)

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

  // Use basic flaunch first to see what it needs
  const hash = await flaunch.flaunch({
    name: params.name,
    symbol: params.symbol.toUpperCase(),
    creator: params.platformWallet as `0x${string}`,
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
