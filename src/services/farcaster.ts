import axios from 'axios'

const NEYNAR_API = 'https://api.neynar.com/v2'

interface FarcasterCredentials {
  fid: number
  signerUuid: string
  username?: string
}

// Check if agent has Farcaster
export const hasFarcaster = (abilities: any[]): FarcasterCredentials | null => {
  const fc = abilities.find(a => a.name === 'farcaster')
  if (fc?.config?.fid && fc?.config?.signerUuid) {
    return {
      fid: fc.config.fid,
      signerUuid: fc.config.signerUuid,
      username: fc.config.username
    }
  }
  return null
}

// Get agent's recent casts (memory)
export const getAgentCasts = async (fid: number, limit = 10): Promise<string[]> => {
  try {
    const res = await axios.get(`${NEYNAR_API}/farcaster/feed/user/casts`, {
      headers: { 'api_key': process.env.NEYNAR_API_KEY },
      params: { fid, limit }
    })
    return res.data.casts?.map((c: any) => c.text) || []
  } catch (e: any) {
    console.error('Failed to fetch casts:', e.response?.data || e.message)
    return []
  }
}

// Post a cast
export const postCast = async (
  signerUuid: string,
  text: string
): Promise<string | null> => {
  try {
    const res = await axios.post(
      `${NEYNAR_API}/farcaster/cast`,
      { signer_uuid: signerUuid, text },
      { headers: { 'api_key': process.env.NEYNAR_API_KEY } }
    )
    console.log('Cast posted:', res.data.cast?.hash)
    return res.data.cast?.hash || null
  } catch (e: any) {
    console.error('Failed to post cast:', e.response?.data || e.message)
    return null
  }
}

// Create Farcaster account for agent
export const createFarcasterAccount = async (
  agentName: string
): Promise<FarcasterCredentials | null> => {
  try {
    console.log(`Creating Farcaster account for ${agentName}...`)
    
    // 1. Create a signer
    const signerRes = await axios.post(
      `${NEYNAR_API}/farcaster/signer`,
      {},
      { headers: { 'api_key': process.env.NEYNAR_API_KEY } }
    )
    
    const signerUuid = signerRes.data.signer_uuid
    const publicKey = signerRes.data.public_key
    const status = signerRes.data.status
    
    console.log(`Signer created: ${signerUuid}, status: ${status}`)
    
    // If signer needs approval, return the approval URL
    if (status === 'pending_approval') {
      console.log('Signer needs approval:', signerRes.data.signer_approval_url)
      // For now, we'll use Neynar's managed signers which auto-approve
    }
    
    // 2. Register the user (sponsored by Neynar on free tier)
    const registerRes = await axios.post(
      `${NEYNAR_API}/farcaster/user`,
      {
        signature: signerUuid, // Neynar handles this
        requested_user_custody_address: '0x0000000000000000000000000000000000000000'
      },
      { headers: { 'api_key': process.env.NEYNAR_API_KEY } }
    )
    
    const fid = registerRes.data.user?.fid
    
    if (fid) {
      console.log(`Farcaster account created! FID: ${fid}`)
      return { fid, signerUuid }
    }
    
    return null
  } catch (e: any) {
    console.error('Farcaster creation error:', e.response?.data || e.message)
    return null
  }
}
