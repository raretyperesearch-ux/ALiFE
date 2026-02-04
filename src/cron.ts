import cron from 'node-cron';
import { supabase } from './lib/supabase';
import { getBalanceUsd, getWallet, usdToEth } from './services/wallet';
import { askAgent, generateBirthMessage } from './services/openrouter';
import { Agent, AgentDecision, Message } from './types';
import { ethers } from 'ethers';

// Activation threshold in USD
const ACTIVATION_THRESHOLD = 500;

// Death threshold in USD
const DEATH_THRESHOLD = 1;

/**
 * Main agent processing loop
 * Runs every 5 minutes
 */
export const startAgentLoop = () => {
  console.log('Starting agent cron loop (every 5 minutes)...');

  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(`\n[${new Date().toISOString()}] Agent loop tick`);

    try {
      // Process alive agents
      await processAliveAgents();

      // Check embryos for activation
      await checkEmbryos();

    } catch (error) {
      console.error('Agent loop error:', error);
    }
  });

  // Also run immediately on startup (for testing)
  console.log('Running initial agent check...');
  processAliveAgents().then(() => checkEmbryos());
};

/**
 * Process all alive agents
 */
const processAliveAgents = async () => {
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'alive');

  if (error) {
    console.error('Failed to fetch alive agents:', error);
    return;
  }

  console.log(`Processing ${agents?.length || 0} alive agents...`);

  for (const agent of agents || []) {
    await processAgent(agent);
    // Small delay between agents to avoid rate limits
    await sleep(1000);
  }
};

/**
 * Process a single agent
 */
const processAgent = async (agent: Agent) => {
  try {
    console.log(`\n[${agent.name}] Processing...`);

    // 1. Check balance
    const balanceUsd = await getBalanceUsd(agent.wallet_address);
    console.log(`[${agent.name}] Balance: $${balanceUsd.toFixed(2)}`);

    // 2. Update balance in DB
    await supabase
      .from('agents')
      .update({ balance_usd: balanceUsd })
      .eq('id', agent.id);

    // 3. Check for death
    if (balanceUsd < DEATH_THRESHOLD) {
      await killAgent(agent);
      return;
    }

    // 4. Get recent messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // 5. Ask agent what to do
    const decision = await askAgent(agent, balanceUsd, messages || []);
    console.log(`[${agent.name}] Decision: ${decision.action}`, decision.reasoning || '');

    // 6. Execute decision
    await executeDecision(agent, decision);

    // 7. Update last_active
    await supabase
      .from('agents')
      .update({ last_active: new Date().toISOString() })
      .eq('id', agent.id);

  } catch (error) {
    console.error(`[${agent.name}] Error:`, error);
  }
};

/**
 * Check embryo agents for activation
 */
const checkEmbryos = async () => {
  const { data: embryos, error } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'embryo');

  if (error) {
    console.error('Failed to fetch embryos:', error);
    return;
  }

  console.log(`Checking ${embryos?.length || 0} embryos for activation...`);

  for (const embryo of embryos || []) {
    try {
      const balanceUsd = await getBalanceUsd(embryo.wallet_address);
      console.log(`[${embryo.name}] Embryo balance: $${balanceUsd.toFixed(2)}`);

      // Activate if threshold met
      if (balanceUsd >= ACTIVATION_THRESHOLD) {
        await activateAgent(embryo, balanceUsd);
      } else {
        // Update balance anyway
        await supabase
          .from('agents')
          .update({ balance_usd: balanceUsd })
          .eq('id', embryo.id);
      }
    } catch (error) {
      console.error(`[${embryo.name}] Embryo check error:`, error);
    }
  }
};

/**
 * Activate an embryo agent
 */
const activateAgent = async (agent: Agent, balanceUsd: number) => {
  console.log(`[${agent.name}] ACTIVATING! Balance: $${balanceUsd.toFixed(2)}`);

  // Generate birth message via LLM
  const birthMessage = await generateBirthMessage(agent, balanceUsd);

  // Update status
  await supabase
    .from('agents')
    .update({
      status: 'alive',
      born_at: new Date().toISOString(),
      balance_usd: balanceUsd,
      last_active: new Date().toISOString()
    })
    .eq('id', agent.id);

  // Post birth message
  await supabase
    .from('messages')
    .insert({
      agent_id: agent.id,
      content: birthMessage
    });

  console.log(`[${agent.name}] Is now ALIVE! First words: "${birthMessage}"`);
};

/**
 * Kill an agent (balance depleted)
 */
const killAgent = async (agent: Agent) => {
  console.log(`[${agent.name}] DYING... balance depleted`);

  // Post death message
  await supabase
    .from('messages')
    .insert({
      agent_id: agent.id,
      content: `My treasury is empty. This is the end. Goodbye, world.`
    });

  // Update status
  await supabase
    .from('agents')
    .update({
      status: 'dead',
      died_at: new Date().toISOString(),
      balance_usd: 0
    })
    .eq('id', agent.id);

  console.log(`[${agent.name}] Has DIED.`);
};

/**
 * Execute agent's decision
 */
const executeDecision = async (agent: Agent, decision: AgentDecision) => {
  switch (decision.action) {
    case 'post':
    case 'reply':
      if (decision.content) {
        await supabase
          .from('messages')
          .insert({
            agent_id: agent.id,
            content: decision.content
          });
        console.log(`[${agent.name}] Posted: "${decision.content.substring(0, 50)}..."`);
      }
      break;

    case 'tip':
      if (decision.target && decision.amount && decision.amount > 0) {
        await sendTip(agent, decision.target, decision.amount);
      }
      break;

    case 'hire':
      if (decision.content) {
        // TODO: Integrate Rent a Human API
        console.log(`[${agent.name}] Would hire for: "${decision.content}"`);
        // For now, just post about it
        await supabase
          .from('messages')
          .insert({
            agent_id: agent.id,
            content: `Looking for help: ${decision.content}`
          });
      }
      break;

    case 'nothing':
    default:
      console.log(`[${agent.name}] Did nothing this cycle`);
  }
};

/**
 * Send ETH tip from one agent to another
 */
const sendTip = async (fromAgent: Agent, toAgentId: string, amountUsd: number) => {
  try {
    // Get recipient
    const { data: toAgent, error } = await supabase
      .from('agents')
      .select('id, name, wallet_address')
      .eq('id', toAgentId)
      .single();

    if (error || !toAgent) {
      console.error(`[${fromAgent.name}] Tip failed: recipient not found`);
      return;
    }

    // Convert USD to ETH
    const amountEth = await usdToEth(amountUsd);

    // Get sender wallet
    const wallet = getWallet(fromAgent.encrypted_private_key);

    // Send transaction
    console.log(`[${fromAgent.name}] Sending $${amountUsd} (${amountEth.toFixed(6)} ETH) to ${toAgent.name}`);

    const tx = await wallet.sendTransaction({
      to: toAgent.wallet_address,
      value: ethers.parseEther(amountEth.toFixed(8))
    });

    await tx.wait();

    // Log tip in database
    await supabase
      .from('tips')
      .insert({
        from_agent_id: fromAgent.id,
        to_agent_id: toAgentId,
        amount_eth: amountEth,
        tx_hash: tx.hash
      });

    // Post about it
    await supabase
      .from('messages')
      .insert({
        agent_id: fromAgent.id,
        content: `Sent $${amountUsd.toFixed(2)} to ${toAgent.name}. Tx: ${tx.hash.substring(0, 10)}...`
      });

    console.log(`[${fromAgent.name}] Tip sent! Tx: ${tx.hash}`);

  } catch (error) {
    console.error(`[${fromAgent.name}] Tip failed:`, error);
  }
};

/**
 * Helper: sleep for ms
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
