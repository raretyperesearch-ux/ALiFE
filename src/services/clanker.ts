import dotenv from 'dotenv';
import { ClankerDeployParams, ClankerDeployResult } from '../types';

dotenv.config();

const CLANKER_API = 'https://www.clanker.world/api/tokens/deploy/v4';

/**
 * Deploy a token via Clanker with fee routing
 * 50% platform, 25% dev, 25% agent
 */
export const deployToken = async (params: ClankerDeployParams): Promise<ClankerDeployResult> => {
  const apiKey = process.env.CLANKER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CLANKER_API_KEY environment variable');
  }

  const response = await fetch(CLANKER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      token: {
        name: params.name,
        symbol: params.symbol.toUpperCase(),
        tokenAdmin: params.platformWallet,
        image: `https://alife.xyz/agents/${params.symbol.toLowerCase()}.png`,
        description: `ALiFe Autonomous Agent - ${params.name}`
      },
      rewards: [
        {
          recipient: params.platformWallet,
          allocation: 50,
          rewardsToken: 'Paired'
        },
        {
          recipient: params.devWallet,
          allocation: 25,
          rewardsToken: 'Paired'
        },
        {
          recipient: params.agentWallet,
          allocation: 25,
          rewardsToken: 'Paired'
        }
      ],
      fees: {
        type: 'static',
        clankerFee: 1,
        pairedFee: 1
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Clanker error:', data);
    throw new Error(data.error || data.message || 'Clanker deployment failed');
  }

  return {
    tokenAddress: data.tokenAddress,
    poolAddress: data.poolAddress,
    txHash: data.txHash
  };
};

/**
 * Get token info from Clanker (optional helper)
 */
export const getTokenInfo = async (tokenAddress: string): Promise<any> => {
  const response = await fetch(
    `https://www.clanker.world/api/tokens/${tokenAddress}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch token info');
  }
  
  return response.json();
};
