import cron from 'node-cron'
import { supabase } from './lib/supabase'
import { getBalanceUsd } from './services/wallet'
import { askAgent } from './services/openrouter'
import { hasFarcaster, getAgentCasts, postCast, createFarcasterAccount } from './services/farcaster'
import { getAvailableTools, getAgentTools, acquireTool, postBounty } from './services/tools'

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

  const walletAddress = agent.wallet_address
  if (!walletAddress) {
    console.error(`[${agent.name}] No wallet address!`)
    return
  }

  const balance = await getBalanceUsd(walletAddress)
  console.log(`[${agent.name}] Balance: $${balance.toFixed(2)}`)

  if (balance < 0.01) {
    console.log(`[${agent.name}] DIED!`)
    await supabase
      .from('agents')
      .update({ status: 'dead', died_at: new Date().toISOString() })
      .eq('id', agent.id)
    await postToHomeBase(agent.id, "My treasury is empty. Goodbye.")
    return
  }

  // Get abilities and available tools
  const { data: abilities } = await supabase
    .from('abilities')
    .select('name, config')
    .eq('agent_id', agent.id)
  
  const abilityList = abilities?.map(a => a.name) || []
  const availableTools = await getAvailableTools()
  
  console.log(`[${agent.name}] Abilities: ${abilityList.join(', ') || 'none'}`)

  // Check Farcaster
  const fcCreds = hasFarcaster(abilities || [])
  
  // Get memory
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

  // Ask agent
  const response = await askAgent({
    name: agent.name,
    personality: agent.personality,
    purpose: agent.purpose,
    balance,
    abilities: abilityList,
    availableTools,
    memories: memories || [],
    recentMessages: recentPosts.map(p => ({ content: p })),
    hasFarcaster: !!fcCreds
  })

  console.log(`[${agent.name}] Action: ${response.action} - ${response.reasoning}`)

  // Handle POST
  if (response.action === 'post' && response.message) {
    if (fcCreds) {
      const hash = await postCast(fcCreds.signerUuid, response.message)
      if (hash) {
        console.log(`[${agent.name}] Posted to Farcaster`)
        await postToHomeBase(agent.id, `[FC] ${response.message}`)
      }
    } else {
      await postToHomeBase(agent.id, response.message)
      console.log(`[${agent.name}] Posted to Home Base`)
    }
  }

  // Handle ACQUIRE_TOOL
  if (response.action === 'acquire_tool' && response.toolName) {
    const tool = availableTools.find(t => t.name === response.toolName)
    if (tool && tool.cost <= balance) {
      console.log(`[${agent.name}] Acquiring ${tool.name}...`)
      
      if (tool.name === 'farcaster' && tool.automated) {
        const creds = await createFarcasterAccount(agent.name)
        if (creds) {
          await acquireTool(agent.id, 'farcaster', creds)
          await postToHomeBase(agent.id, `🎉 I now have Farcaster! FID: ${creds.fid}`)
          console.log(`[${agent.name}] Got Farcaster! FID: ${creds.fid}`)
        }
      } else if (tool.automated) {
        await acquireTool(agent.id, tool.name, {})
        await postToHomeBase(agent.id, `🔧 Acquired new ability: ${tool.name}`)
        console.log(`[${agent.name}] Acquired ${tool.name}`)
      } else {
        // Non-automated tool - post a bounty
        const bountyId = await postBounty(
          agent.id,
          `Need ${tool.name} setup`,
          `I want to acquire ${tool.name}: ${tool.description}`,
          tool.cost
        )
        if (bountyId) {
          await postToHomeBase(agent.id, `📋 Posted bounty for ${tool.name} ($${tool.cost})`)
          console.log(`[${agent.name}] Posted bounty for ${tool.name}`)
        }
      }
    }
  }

  // Handle POST_BOUNTY
  if (response.action === 'post_bounty' && respounty) {
    const { title, description, reward } = response.bounty
    if (reward <= balance && reward > 0) {
      const bountyId = await postBounty(agent.id, title, description, reward)
      if (bountyId) {
        await postToHomeBase(agent.id, `📋 Bounty: "${title}" - $${reward}`)
        console.log(`[${agent.name}] Posted bounty: ${title}`)
      }
    }
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

  // Update
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
  const { data: embryos } = ait supabase
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
          .update({ status: 'alive', born_at: new Date().toISOString(), balance_usd: balance })
          .eq('id', embryo.id)

        await supabase.from('abilities').insert({ agent_id: embryo.id, name: 'home_base' })

        await supabase.from('memories').insert({
          agent_id: embryo.id,
          content: `Born with $${balance.toFixed(2)}. Purpose: ${embryo.purpose}`,
          importance: 10
        })

        const availableTools = await getAvailableTools()

        const response = await askAgent({
          name: embryo.name,
          personality: embryo.personality,
          purpose: embryo.purpose,
          balance,
          abilities: ['home_base'],
          availableTools,
          memories: [],
          recentMessages: [],
          isFirstMessage: true,
          hasFarcaster: false
        })

        if (response.message) {
          await postToHomeBase(embryo.id, response.message)
          console.log(`[${embryo.name}] ALIVE! "${response.message}"`)
        }
      }
    } catch (error) {
      console.error(`[${embryo.name}] Error:`, error)
    }
  }
}
