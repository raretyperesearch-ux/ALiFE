import { ethers } from 'ethers'

const OPTIMISM_RPC = 'https://mainnet.optimism.io'
const ID_REGISTRY = '0x00000000Fc6c5F01Fc30151999387Bb99A9f489b'

const ID_REGISTRY_ABI = [
  'function register(address recovery) payable returns (uint256)',
  'function idOf(address owner) view returns (uint256)',
  'function price() view returns (uint256)'
]

export const createFarcasterAccount = async (privateKey: string): Promise<{ fid: number } | null> => {
  try {
    console.log('[Farcaster] Agent signing up on-chain...')
    
    const provider = new ethers.JsonRpcProvider(OPTIMISM_RPC)
    const wallet = new ethers.Wallet(privateKey, provider)
    
    console.log('[Farcaster] Wallet:', wallet.address)
    
    const idRegistry = new ethers.Contract(ID_REGISTRY, ID_REGISTRY_ABI, wallet)
    
    // Check if already registered
    const existingFid = await idRegistry.idOf(wallet.address)
    if (existingFid > 0n) {
      console.log('[Farcaster] Already has FID:', existingFid.toString())
      return { fid: Number(existingFid) }
    }
    
    // Get price
    const price = await idRegistry.price()
    console.log('[Farcaster] Registration price:', ethers.formatEther(price), 'ETH')
    
    // Check balance on Optimism
    const balance = await provider.getBalance(wallet.address)
    console.log('[Farcaster] Balance on Optimism:', ethers.formatEther(balance), 'ETH')
    
    const totalNeeded = price + ethers.parseEther('0.0005') // price + gas
    if (balance < totalNeeded) {
      console.log('[Farcaster] Need more ETH on Optimism. Have:', ethers.formatEther(balance), 'Need:', ethers.formatEther(totalNeeded))
      return null
    }
    
    // Register
    console.log('[Farcaster] Calling register()...')
    const tx = await idRegistry.register(wallet.address, { value: price, gasLimit: 200000 })
    console.log('[Farcaster] Tx:', tx.hash)
    
    await tx.wait()
    
    const fid = await idRegistry.idOf(wallet.address)
    console.log('[Farcaster] SUCCESS! FID:', fid.toString())
    
    return { fid: Number(fid) }
    
  } catch (error: any) {
    console.error('[Farcaster] Error:', error.message)
    return null
  }
}

export const hasFarcaster = (abilities: any[]): { fid: number } | null => {
  const fc = abilities.find(a => a.name === 'farcaster')
  if (fc?.config?.fid) {
    return { fid: fc.config.fid }
  }
  return null
}

export const getAgentCasts = async (fid: number, limit: number): Promise<string[]> => {
  return []
}

export const postCast = async (fid: number, text: string): Promise<boolean> => {
  // TODO: Hub submission
  console.log('[Farcaster] Would post:', text)
  return true
}
