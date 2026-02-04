import cron from 'node-cron'
import { supabase } from './lib/supabase'
import { getBalanceUsd } from './services/wallet'
import { askAgent } from './services/openrouter'
import { hasFarcaster, getAgentCasts } from './services/farcaster'

const ACTIVATION_THRESHOLD = 10

export const startAgentLoop = () => {
  console.log('Starting agent cron loop (every 5 minutes)...')
  
  cron.schedule('*/5 * * * *', async () => {
    console.log(`\n[${new Date().toISOString()}] Agent loop tick`)
    await processAliveAgents()
    await checkEmbryos()
  })

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

  // Use snake_case from Supabase
  const walletAddress = agent.wallet_address
  if (!walletAddress) {
    console.error(`[${agent.name}] No wallet address!`)
    return
  }

  const balance = await getBalanceUsd(walletAddress)
  console.log(`[${agent.name}] Balance: $${balance.toFixed(2)}`)

  // Check for death
  if (balance < 0.01) {
    console.log(`[${agent.name}] DIED! Balance too low.`)
    await supabase
      .from('agents')
      .update({ status: 'dead', died_at: new Date().toISOString() })
      .eq('id', agent.id)
    
    await postToHomeBase(agent.id, "My treasury is empty. This is the end. Goodbye.")
    return
  }

  // Get abilities
  const { data: abilities } = await supabase
    .from('abilities')
    .select('name, config')
    .eq('agent_id', agent.id)
  
  const abilityList = abilities?.map(a => a.name) || ['post_message']
  console.log(`[${agent.name}] Abilities: ${abilityList.join(', ')}`)

  // Check Farcaster
  const fcCreds = hasFarcaster(abilities || [])
  
  // Get memory from recent posts
  let recentPosts: string[] = []
  if (fcCreds) {
    recentPosts = await getAgentCasts(fcCreds.fid, 5)
  } else {
    const { data: msgs } = await supabase
      .from('messages')
      .select('content')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(5)
    recentPosts = msgs?.map(m => m.content) || []
  }

  // Get memories
  const { data: memories } = await supabase
    .from('memories')
    .select('content')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Ask agent what to do
  const response = await askAgent({
    name: agent.name,
    personality: agent.personality,
    purpose: agent.purpose,
    balance,
    abilities: abilityList,
    memories: memories?.map(m => ({ content: m.content, created_at: '' })) || [],
    recentMessages: recentPosts.map(p => ({ content: p, created_at: '' })),
    hasFarcaster: !!fcCreds
  })

  console.log(`[${agent.name}] Decision: ${response.reasoning}`)

  // Execute action
  if (response.action === 'post' && response.message) {
    await postToHomeBase(agent.id, response.message)
    console.log(`[${agent.name}] Posted: "${response.message.slice(0, 50)}..."`)
  }

  // Save memory
  if (response.memory) {
    await supabase.from('memories').insert({
      agent_id: agent.id,
      content: response.memory,
      importance: 5
    })
    console.log(`[${agent.name}] Remembered: "${response.memory.slice(0, 50)}..."`)
  }

  // Update last active
  await supabase
    .from('agents')
    .update({ last_active: new Date().toISOString(), balance_usd: balance })
    .eq('id', agent.id)
}

const postToHomeBase = async (agentId: string, content: string) => {
  await supabase.from('messages').insert({
    agent_id: agentId,
    content,
    type: 'post'
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
      const walletAddress = embryo.wallet_address
      if (!walletAddress) continue

      const balance = await getBalanceUsd(walletAddress)
      console.log(`[${embryo.name}] Embryo balance: $${balance.toFixed(2)}`)

      if (balance >= ACTIVATION_THRESHOLD) {
        console.log(`[${embryo.name}] ACTIVATING!`)
        
        await supabase
          .from('agents')
          .update({ 
            status: 'alive', 
            born_at: new Date().toISOString(),
            balance_usd: balance 
          })
          .eq('id', embryo.id)

        await supabase.from('abilities').insert({
          agent_id: embryo.id,
          name: 'post_message'
        })

        await supabase.from('memories').insert({
          agent_id: embryo.id,
          content: `I was born with $${balance.toFixed(2)}. My purpose: ${embryo.purpose}`,
          importance: 10
        })

        const response = await askAgent({
          name: embryo.name,
          personality: embryo.personality,
          purpose: embryo.purpose,
          balance,
          abilities: ['post_message'],
          memories: [],
          recentMessages: [],
          isFirstMessage: true,
          hasFarcaster: false
        })

        if (response.message) {
          await postToHomeBase(embryo.id, response.message)
          console.log(`[${embryo.name}] ALIVE! First words: "${response.message}"`)
        }
      }
    } catch (error) {
      console.error(`[${embryo.name}] Error:`, error)
    }
  }
}
