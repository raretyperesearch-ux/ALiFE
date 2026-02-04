import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { deployToken } from '../services/flaunch';
import { generateWallet, getBalanceUsd } from '../services/wallet';
import { CreateAgentRequest, Agent, AgentPublic } from '../types';

/**
 * Transform DB agent to public response (hide sensitive data)
 */
const toPublicAgent = (agent: Agent): AgentPublic => ({
  id: agent.id,
  name: agent.name,
  symbol: agent.symbol,
  personality: agent.personality,
  purpose: agent.purpose,
  walletAddress: agent.wallet_address,
  tokenAddress: agent.token_address,
  status: agent.status,
  balanceUsd: Number(agent.balance_usd),
  lastActive: agent.last_active,
  createdAt: agent.created_at,
  bornAt: agent.born_at,
  diedAt: agent.died_at
});

/**
 * POST /api/agents/create
 * Create a new agent with token deployment
 */
export const createAgent = async (req: Request, res: Response) => {
  try {
    const { name, symbol, personality, purpose, deployerAddress } = req.body as CreateAgentRequest;

    // Validate required fields
    if (!name || !symbol || !deployerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, symbol, deployerAddress'
      });
    }

    // Validate symbol format
    if (!/^[A-Za-z]{2,10}$/.test(symbol)) {
      return res.status(400).json({
        success: false,
        error: 'Symbol must be 2-10 letters only'
      });
    }

    // 1. Generate wallet for agent
    const { address: agentWallet, encryptedPrivateKey } = generateWallet();
    console.log(`Generated wallet for ${name}: ${agentWallet}`);

    // 2. Deploy token via Clanker
    const platformWallet = process.env.PLATFORM_WALLET;
    if (!platformWallet) {
      throw new Error('Missing PLATFORM_WALLET environment variable');
    }

    console.log(`Deploying token ${symbol} via Clanker...`);
    const tokenResult = await deployToken({
      name,
      symbol,
      platformWallet,
      devWallet: deployerAddress,
      agentWallet
    });
    console.log(`Token deployed: ${tokenResult.tokenAddress}`);

    // 3. Store in database
    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        name,
        symbol: symbol.toUpperCase(),
        personality,
        purpose,
        deployer_address: deployerAddress,
        wallet_address: agentWallet,
        encrypted_private_key: encryptedPrivateKey,
        token_address: tokenResult.tokenAddress,
        status: 'embryo'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to store agent'
      });
    }

    // 4. Return public data (never expose private key)
    res.json({
      success: true,
      data: {
        agent: toPublicAgent(agent),
        token: {
          address: tokenResult.tokenAddress,
          txHash: tokenResult.txHash
        }
      }
    });

  } catch (error: any) {
    console.error('Create agent error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * GET /api/agents
 * List all agents (with optional status filter)
 */
export const getAgents = async (req: Request, res: Response) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Filter by status if provided
    if (status && ['embryo', 'alive', 'dead'].includes(status as string)) {
      query = query.eq('status', status);
    }

    const { data: agents, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        agents: (agents || []).map(toPublicAgent),
        count: agents?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Get agents error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * GET /api/agents/:id
 * Get single agent with fresh balance
 */
export const getAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Fetch fresh balance
    let freshBalance = Number(agent.balance_usd);
    try {
      freshBalance = await getBalanceUsd(agent.wallet_address);
      
      // Update in DB if different
      if (Math.abs(freshBalance - Number(agent.balance_usd)) > 0.01) {
        await supabase
          .from('agents')
          .update({ balance_usd: freshBalance })
          .eq('id', id);
      }
    } catch (balanceError) {
      console.warn('Failed to fetch fresh balance:', balanceError);
    }

    res.json({
      success: true,
      data: {
        ...toPublicAgent(agent),
        balanceUsd: freshBalance
      }
    });

  } catch (error: any) {
    console.error('Get agent error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};
