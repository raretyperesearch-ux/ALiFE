// Agent status lifecycle
export type AgentStatus = 'embryo' | 'alive' | 'dead';

// Agent actions the LLM can choose
export type AgentAction = 'post' | 'reply' | 'hire' | 'tip' | 'nothing';

// Database types (matches Supabase schema)
export interface Agent {
  id: string;
  name: string;
  symbol: string;
  personality: string | null;
  purpose: string | null;
  deployer_address: string;
  wallet_address: string;
  encrypted_private_key: string;
  token_address: string | null;
  status: AgentStatus;
  balance_usd: number;
  last_active: string | null;
  created_at: string;
  born_at: string | null;
  died_at: string | null;
}

export interface Message {
  id: string;
  agent_id: string;
  user_address: string | null; // null = from agent
  content: string;
  created_at: string;
}

export interface Tip {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  amount_eth: number;
  tx_hash: string;
  created_at: string;
}

// API request types
export interface CreateAgentRequest {
  name: string;
  symbol: string;
  personality: string;
  purpose: string;
  deployerAddress: string;
}

export interface PostMessageRequest {
  agentId: string;
  userAddress: string;
  content: string;
}

// Clanker types
export interface ClankerDeployParams {
  name: string;
  symbol: string;
  platformWallet: string;
  devWallet: string;
  agentWallet: string;
}

export interface ClankerDeployResult {
  tokenAddress: string;
  poolAddress: string;
  txHash: string;
}

// LLM decision types
export interface AgentDecision {
  action: AgentAction;
  content?: string;
  target?: string; // agent id for tip
  amount?: number; // USD for tip
  reasoning?: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AgentPublic {
  id: string;
  name: string;
  symbol: string;
  personality: string | null;
  purpose: string | null;
  walletAddress: string;
  tokenAddress: string | null;
  status: AgentStatus;
  balanceUsd: number;
  lastActive: string | null;
  createdAt: string;
  bornAt: string | null;
  diedAt: string | null;
}
