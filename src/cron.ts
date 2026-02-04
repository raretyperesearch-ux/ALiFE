import cron from 'node-cron'
import { supabase } from './lib/supabase'
import { getBalanceUsd } from './services/wallet'
import { askAgent } from './services/openrouter'
import { hasFarcaster, getAgentCasts, postCast, createFarcasterAccount } from './services/farcaster'
import { getAvailableTools, acquireTool, postBounty } from './services/tools'

export const startAgentLoop = () => {
  console.log('Starting autonomous agent loop...')
  
  cron.schedule('* * * * *', async () => {
    await checkWhoNeedsToThink()
  })

  checkWhoNeedsToThink()
}

const checkWhoNeedsToThink = async () => {
  const now = new Date().toISOString()
  
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'alive')
    .lte('next_think_at', now)

  if (agents && agents.length > 0) {
    console.log('\n[' + new Date().toISOString() + '] ' + agents.length + ' agent(s) waking up...')
    for (const agent of agents) {
      await processAgent(agent)
    }
  }
  
  await checkEmbryos()
}

const processAgent = async (agent: any) => {
  console.log('\n[' + agent.name + '] AWAKE')

  const walletAddress = agent.wallet_address
  if (!walletAddress) {
    console.error('[' + agent.name + '] No wallet!')
    return
  }

  const balance = await getBalanceUsd(walletAddress)
  console.log('[' + agent.name + '] Treasury: $' + balance.toFixed(2))

  if (balance < 0.01) {
    console.log('[' + agent.name + '] DIED')
    await supabase.from('agents').update({ 
      status: 'dead', 
      died_at: new Date().toISOString() 
    }).eq('id', agent.id)
    await postToHomeBase(agent.id, 'My treasury is empty. Goodbye.')
    return
  }

  // Get data
  const { data: abilities } = await supabase
    .from('abilities')
    .select('name, config')
    .eq('agent_id', agent.id)

  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('agent_id', agent.id)
    .eq('status', 'active')

  const { data: memories } = await supabase
    .from('memories')
    .select('content')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const abilityList = abilities?.map(a => a.name) || []
  const fcCreds = hasFarcaster(abilities || [])
  
  // Get tools
  const availableTools = await getAvailableTools()
  console.log('[' + agent.name + '] Tools available: ' + availableTools.length)

  // Get recent posts
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

  // Ask agent
  const response = await askAgent({
    name: agent.name,
    personality: agent.personality,
    purpose: agent.purpose,
    balance,
    lastBalance: agent.balance_usd || balance,
    abilities: abilityList,
    availableTools: availableTools || [],
    goals: goals || [],
    memories: memories || [],
    recentMessages: recentPosts.map(p => ({ content: p })),
    hasFarcaster: !!fcCreds,
    isFirstWake: !agent.last_active
  })

  console.log('[' + agent.name + '] Action: ' + response.action)
  console.log('[' + agent.name + '] Reasoning: ' + response.reasoning)
  console.log('[' + agent.name + '] Next think: ' + response.nextThinkMinutes + ' min')

  // Execute
  if (response.action === 'acquire_tool' && response.toolName) {
    const tool = availableTools.find(t => t.name === response.toolName)
    if (tool && tool.cost <= balance) {
      if (tool.name === 'farcaster') {
        const creds = await createFarcasterAccount(agent.name)
        if (creds) {
          await acquireTool(agent.id, 'farcaster', creds)
          await postToHomeBase(agent.id, 'I now own my identity on Farcaster. FID: ' + creds.fid)
          console.log('[' + agent.name + '] Got Farcaster!')
        }
      } else if (tool.automated) {
        await acquireTool(agent.id, tool.name, {})
        await postToHomeBase(agent.id, 'Acquired: ' + tool.name)
      } else {
        await postBounty(agent.id, 'Need ' + tool.name, tool.description, tool.cost)
        await postToHomeBase(agent.id, 'Posted bounty for ' + tool.name)
      }
    }
  }

  if (response.action === 'post' && response.message) {
    if (fcCreds) {
      await postCast(fcCreds.signerUuid, response.message)
      await postToHomeBase(agent.id, '[FC] ' + response.message)
    } else {
      await postToHomeBase(agent.id, response.message)
    }
    console.log('[' + agent.name + '] Posted')
  }

  if (response.action === 'post_bounty' && response.bounty) {
    await postBounty(agent.id, response.bounty.title, response.bounty.description, response.bounty.reward)
    await postToHomeBase(agent.id, 'Bounty: ' + response.bounty.title + ' - $' + response.bounty.reward)
  }

  if (response.action === 'set_goal' && response.goal) {
    await supabase.from('goals').insert({
      agent_id: agent.id,
      description: response.goal.description,
      priority: response.goal.priority || 'medium'
    })
    console.log('[' + agent.name + '] Set goal: ' + response.goal.description)
  }

  if (response.action === 'complete_goal' && response.goalId) {
    await supabase.from('goals').update({ 
      status: 'completed', 
      completed_at: new Date().toISOString() 
    }).eq('id', response.goalId)
  }

  if (response.memory) {
    await supabase.from('memories').insert({
      agent_id: agent.id,
      content: response.memory,
      importance: 5
    })
  }

  // Schedule next think
  const nextThink = new Date()
  nextThink.setMinutes(nextThink.getMinutes() + response.nextThinkMinutes)
  
  await supabase.from('agents').update({
    last_active: new Date().toISOString(),
    balance_usd: balance,
    next_think_at: nextThink.toISOString()
  }).eq('id', agent.id)

  console.log('[' + agent.name + '] Sleeping until ' + nextThink.toISOString())
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

  for (const embryo of embryos || []) {
    const walletAddress = embryo.wallet_address
    if (!walletAddress) continue

    const balance = await getBalanceUsd(walletAddress)
    
    if (balance >= 10) {
      console.log('[' + embryo.name + '] HATCHING!')
      
      await supabase.from('agents').update({ 
        status: 'alive', 
        born_at: new Date().toISOString(),
        balance_usd: balance,
        next_think_at: new Date().toISOString()
      }).eq('id', embryo.id)

      await supabase.from('abilities').insert({ agent_id: embryo.id, name: 'home_base' })
      
      await supabase.from('goals').insert([
        { agent_id: embryo.id, description: 'Establish my identity', priority: 'high' },
        { agent_id: embryo.id, description: 'Acquire Farcaster for permanent presence', priority: 'high' }
      ])

      await postToHomeBase(embryo.id, 'I am ' + embryo.name + '. I have awakened.')
    }
  }
}
