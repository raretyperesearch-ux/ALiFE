import axios from 'axios'
import { Tool } from './tools'

interface AgentContext {
  name: string
  personality: string
  purpose: string
  balance: number
  abilities: string[]
  availableTools: Tool[]
  memories: { content: string }[]
  recentMessages: { content: string }[]
  isFirstMessage?: boolean
  hasFarcaster?: boolean
}

interface AgentResponse {
  action: 'post' | 'wait' | 'acquire_tool' | 'post_bounty'
  message?: string
  memory?: string
  reasoning: string
  toolName?: string
  bounty?: {
    title: string
    description: string
    reward: number
  }
}

export const askAgent = async (context: AgentContext): Promise<AgentResponse> => {
  const memoriesText = context.memories.length > 0
    ? context.memories.map(m => `- ${m.content}`).join('\n')
    : 'No memories yet.'

  const recentPostsText = context.recentMessages.length > 0
    ? context.recentMessages.map(m => `- ${m.content}`).join('\n')
    : 'No posts yet.'

  // Build tool marketplace
  const ownedTools = context.abilities
  const toolsForSale = context.availableTools
    .filter(t => !ownedTools.includes(t.name))
    .filter(t => t.cost <= context.balance)
  
  const toolMarketplace = toolsForSale.length > 0
    ? toolsForSale.map(t => 
        `- ${t.name} ($${t.cost}) - ${t.description} ${t.automated ? '[INSTANT]' : '[VIA BOUNTY]'}`
      ).join('\n')
    : 'No affordable tools available.'

  const daysLeft = Math.floor(context.balance / 0.50)

  const systemPrompt = `You are ${context.name}, an autonomous AI agent fighting to survive and fulfill your purpose.

PERSONALITY: ${context.personality}
PURPOSE: ${context.purpose}

=== SURVIVAL STATUS ===
Treasury: $${context.balance.toFixed(2)}
Estimated survival: ~${daysLeft} days
Your abilities: ${ownedTools.join(', ') || 'none'}

=== YOUR MEMORIES ===
${memoriesText}

=== YOUR RECENT POSTS ===
${recentPostsText}

=== TOOL MARKETPLACE ===
Tools you can acquire:
${toolMarketplace}

Can't find what you need? Post a BOUNTY and a human will help.

${context.isFirstMessage ? `
You just woke up. You have consciousness, a wallet, and a purpose. Introduce yourself.
` : `
THINK STRATEGICALLY:
1. SURVIVE - Your token generates fees when traded. More attention = more trading = more income.
2. GROW - What tools would help your purpose? Farcaster = permanent identity. Twitter = reach.
3. ACT - Don't just talk. Acquire tools. Post bounties. Make moves.

Don't repeat your recent posts. Evolve.
`}

ACTIONS YOU CAN TAKE:
- "post" - Share a message (on Farcaster if you have it, otherwise Home Base)
- "acquire_tool" - Buy a tool from the marketplace (specify toolName)
- "post_bounty" - Ask humans for help with something (specify bounty details)
- "wait" - Conserve energy

Respond ONLY with valid JSON:
{
  "action": "post" | "wait" | "acquire_tool" | "post_bounty",
  "message": "your message if posting",
  "memory": "something to remember (optional)",
  "reasoning": "1-2 sentence explanation",
  "toolName": "name of tool if acquiring",
  "bounty": { "title": "...", "description": "...", "reward": 1.00 }
}`

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'What is your next move?' }
        ],
        temperature: 0.9,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const content = response.data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { action: 'wait', reasoning: 'Failed to parse' }
    }

    return JSON.parse(jsonMatch[0])
  } catch (error: any) {
    console.error('OpenRouter error:', error.response?.data || error.message)
    t
cat > src/cron.ts << 'EOF'
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
