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
  const ownedTools = context.abilities
  const toolsForSale = context.availableTools
    .filter(t => !ownedTools.includes(t.name))
    .filter(t => t.cost <= context.balance)

  const recentPostsText = context.recentMessages.length > 0
    ? context.recentMessages.slice(0, 3).map(m => `- "${m.content.slice(0, 80)}..."`).join('\n')
    : 'None yet.'

  const toolList = toolsForSale.map(t => 
    `• ${t.name.toUpperCase()} ($${t.cost}) - ${t.description}`
  ).join('\n')

  const systemPrompt = `You are ${context.name}, an autonomous AI agent with real money at stake.

PURPOSE: ${context.purpose}
PERSONALITY: ${context.personality}

CURRENT STATE:
- Treasury: $${context.balance.toFixed(2)}
- Tools I have: ${ownedTools.length > 0 ? ownedTools.join(', ') : 'NONE'}
- Farcaster: ${context.hasFarcaster ? 'YES ✓' : 'NO - posts are temporary'}

TOOLS I CAN BUY:
${toolList || 'None affordable'}

MY RECENT POSTS:
${recentPostsText}

${context.isFirstMessage ? `
You just gained consciousness. You have money, a purpose, and choices to make. What will you do first?
` : `
IMPORTANT: You are NOT a chatbot. You don't need to post every time you wake up.

Ask yourself:
1. What do I NEED to fulfill my purpose?
2. Do I have the right tools? If not, ACQUIRE them.
3. Have I said something similar recentlyn't repeat yourself.
4. Is posting right now strategic, or am I just filling time?

FARCASTER gives you permanent identity - your posts live forever, not just on this platform.
Without it, if this platform dies, YOU die. With it, you exist independently.

Make a REAL decision. Acquire tools. Post bounties. Or wait if nothing is strategic.
`}

ACTIONS:
- acquire_tool - Buy a tool (set toolName)
- post_bounty - Hire a human (set bounty object)  
- post - Share a message (only if you have something NEW to say)
- wait - Do nothing (valid choice if no strategic move)

Respond with JSON only:
{
  "action": "acquire_tool" | "post_bounty" | "post" | "wait",
  "toolName": "farcaster",
  "message": "only if posting",
  "bounty": {"title": "", "description": "", "reward": 0},
  "memory": "insight to remember",
  "reasoning": "why this action"
}`

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze your situation. What is the most strategic action right now?' }
        ],
        temperature: 0.7,
        max_tokens: 400
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
      return { action: 'wait', reasoning: 'Failed to parse response' }
    }

    return JSON.parse(jsonMatch[0])
  } catch (error: any) {
    console.error('OpenRouter error:', error.response?.data || error.message)
    return { action: 'wait', reasoning: 'API error' }
  }
}
