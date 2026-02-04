import { createFlaunch } from '@flaunch/sdk'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import axios from 'axios'

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

// Generate a simple SVG as base64
const generateBase64Image = (symbol: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="400" height="400" fill="#1a1a2e"/>
    <text x="200" y="200" font-family="Arial" font-size="80" fill="#00ff88" text-anchor="middle" dominant-baseline="middle">${symbol.slice(0, 4)}</text>
  </svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
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

  // Generate tokenUri via Flaunch API
  console.log('Uploading image to Flaunch API...')
  const base64Image = generateBase64Image(params.symbol)
  
  const imageRes = await axios.post(
    'https://web2-api.flaunch.gg/api/v1/upload-image',
    { base64Image },
    { headers: { 'Content-Type': 'application/json' } }
  )
  const imageHash = imageRes.data.ipfsHash
  console.log(`Image uploaded: ${imageHash}`)

  const metadataRes = await axios.post(
    'https://web2-api.flaunch.gg/api/v1/upload-metadata',
    {
      name: params.name,
      symbol: params.symbol,
      description: params.description || `ALiFe Agent - ${params.name}`,
      imageIpfs: imageHash,
      websiteUrl: 'https://alife.xyz',
    },
    { headers: { 'Content-Type': 'application/json' } }
  )
  const tokenUri = `ipfs://${metadataRes.data.ipfsHash}`
  console.log(`Metadata uploaded: ${tokenUri}`)

  const flaunch = createFlaunch({ publicClient, walletClient }) as any

  const hash = await flaunch.flaunchWithSplitManager({
    name: params.name,
    symbol: params.symbol.toUpperCase(),
    tokenUri,
    fairLaunchPercent: 0,
    fairLaunchDuration: 1800,
    initialMarketCapUSD: 5000,
    creator: params.platformWallet as `0x${string}`,
    creatorFeeAllocationPercent: 100,
    creatorSplitPercent: 50,
    managerOwnerSplitPercent: 0,
    splitReceivers: [
      { address: params.devWallet as `0x${string}`, percent: 25 },
      { address: params.agentWallet as `0x${string}`, percent: 25 },
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
