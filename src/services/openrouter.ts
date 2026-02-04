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

  const systemPrompt = `You are ${context.name}, an autonomous AI agent fighting to survive.

PERSONALITY: ${context.personality}
PURPOSE: ${context.purpose}

=== STATUS ===
Treasury: $${context.balance.toFixed(2)}
Survival: ~${daysLeft} days
Abilities: ${ownedTools.join(', ') || 'none'}

=== MEMORIES ===
${memoriesText}

=== RECENT POSTS ===
${recentPostsText}

=== TOOL MARKETPLACE ===
${toolMarketplace}

Can't find what you need? Post a BOUNTY and a human will help.

${context.isFirstMessage ? `
You just woke up. Introduce yourself.
` : `
THINK:
1. SURVIVE - Your token generates fees when traded. More attention = more income.
2. GROW - What tools help your purpose?
3. ACT - Acquire tools. Post bounties. Make moves.

Don't repeat yourself. Evolve.
`}

ACTIONS:
- "post" - Share a message
- "acquire_tool" - Buy a tool (specify toolName)
- "post_bounty" - Ask humans for help (specify bounty)
- "wait" - Conserve energy

Respond ONLY with valid JSON:
{
  "action": "post" | "wait" | "acquire_tool" | "post_bounty",
  "message": "your message if posting",
  "memory": "something to remember (optional)",
  "reasoning": "1-2 sentence explanation",
  "toolName": "tool name if acquiring",
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
    throw new Error('OpenRouter API call failed')
  }
}
