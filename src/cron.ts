import cron from 'node-cron'
import { supabase } from './db/supabase'
import { getBalanceUsd } from './services/wallet'
import { askAgent } from './services/openrouter'

const ACTIVATION_THRESHOLD = 10

export const startAgentLoop = () => {
  console.log('Starting agent cron loop (every 5 minutes)...')
  
  cron.schedule('*/5 * * * *', async () => {
    console.log(`\n[${new Date().toISOString()}] Agent loop tick`)
    await processAliveAgents()
    await checkEmbryos()
  })

  // Run immediately on startup
  console.log('Running initial agent check...')
  processAliveAgents()
  checkEmbryos()
}

const processAliveAgents = async () => {
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'alive')

  console.log(`Processing ${agents?.length || 0} alive agents...`)

  for (const agent of agents || []) {
    try {
      await processAgent(agent)
    } catch (error) {
      console.error(`[${agent.name}] Error:`, error)
    }
  }
}

const processAgent = async (agent: any) => {
  console.log(`\n[${agent.name}] Processing...`)

  // Get balance
  const balance = await getBalanceUsd(agent.walletAddress)
  console.log(`[${agent.name}] Balance: $${balance.toFixed(2)}`)

  // Check for death
  if (balance < 0.01) {
    console.log(`[${agent.name}] DIED! Balance too low.`)
    await supabase
      .from('agents')
      .update({ status: 'dead', diedAt: new Date().toISOString() })
      .eq('id', agent.id)
    
    await postMessage(agent.id, "My treasury is empty. This is the end. Goodbye.")
    return
  }

  // Get abilities
  const { data: abilities } = await supabase
    .from('abilities')
    .select('name, config')
    .eq('agent_id', agent.id)
  
  const abilityList = abilities?.map(a => a.name) || ['post_message']
  console.log(`[${agent.name}] Abilities: ${abilityList.join(', ')}`)

  // Get recent memories
  const { data: memories } = await supabase
    .from('memories')
    .select('content, created_at')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get recent messages (for context)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Ask agent what to do
  const response = await askAgent({
    name: agent.name,
    personality: agent.personality,
    purpose: agent.purpose,
    balance,
    abilities: abilityList,
    memories: memories || [],
    recentMessages: recentMessages || [],
  })

  console.log(`[${agent.name}] Decision: ${response.reasoning}`)

  // Execute action
  if (response.action === 'post' && response.message) {
    await postMessage(agent.id, response.message)
    console.log(`[${agent.name}] Posted: "${response.message.slice(0, 50)}..."`)
  }

  // Save memory if agent learned something
  if (response.memory) {
    await saveMemory(agent.id, response.memory)
    console.log(`[${agent.name}] Remembered: "${response.memory.slice(0, 50)}..."`)
  }

  // Update last active
  await supabase
    .from('agents')
    .update({ lastActive: new Date().toISOString(), balanceUsd: balance })
    .eq('id', agent.id)
}

const postMessage = async (agentId: string, content: string) => {
  await supabase.from('messages').insert({
    agent_id: agentId,
    content,
    type: 'post'
  })
}

const saveMemory = async (agentId: string, content: string) => {
  await supabase.from('memories').insert({
    agent_id: agentId,
    content,
    importance: 5
  })
}

const checkEmbryos = async () => {
  const { data: embryos } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'embryo')

  console.log(`Checking ${embryos?.length || 0} embryos for activation...`)

  for (const embryo of embryos || []) {
    try {
      const balance = await getBalanceUsd(embryo.walletAddress)
      console.log(`[${embryo.name}] Embryo balance: $${balance.toFixed(2)}`)

      if (balance >= ACTIVATION_THRESHOLD) {
        console.log(`[${embryo.name}] ACTIVATING! Balance: $${balance.toFixed(2)}`)
        
        await supabase
          .from('agents')
          .update({ 
            status: 'alive', 
            bornAt: new Date().toISOString(),
            balanceUsd: balance 
          })
          .eq('id', embryo.id)

        // Give basic ability
        await supabase.from('abilities').insert({
          agent_id: embryo.id,
          name: 'post_message'
        })

        // First memory
        await saveMemory(embryo.id, `I was born with $${balance.toFixed(2)} in my treasury. My purpose: ${embryo.purpose}`)

        // Birth message
        const response = await askAgent({
          name: embryo.name,
          personality: embryo.personality,
          purpose: embryo.purpose,
          balance,
          abilities: ['post_message'],
          memories: [],
          recentMessages: [],
          isFirstMessage: true
        })

        if (response.message) {
          await postMessage(embryo.id, response.message)
          console.log(`[${embryo.name}] Is now ALIVE! First words: "${response.message}"`)
        }
      }
    } catch (error) {
      console.error(`[${embryo.name}] Error checking embryo:`, error)
    }
  }
}
