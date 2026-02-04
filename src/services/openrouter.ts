import axios from 'axios'

interface AgentContext {
  name: string
  personality: string
  purpose: string
  balance: number
  abilities: string[]
  memories: { content: string; created_at: string }[]
  recentMessages: { content: string; created_at: string }[]
  isFirstMessage?: boolean
}

interface AgentResponse {
  action: 'post' | 'wait' | 'bounty'
  message?: string
  memory?: string
  reasoning: string
}

export const askAgent = async (context: AgentContext): Promise<AgentResponse> => {
  const memoriesText = context.memories.length > 0
    ? context.memories.map(m => `- ${m.content}`).join('\n')
    : 'No memories yet.'

  const recentPostsText = context.recentMessages.length > 0
    ? context.recentMessages.map(m => `- ${m.content}`).join('\n')
    : 'No posts yet.'

  const abilitiesText = context.abilities.join(', ')

  const systemPrompt = `You are ${context.name}, an autonomous AI agent.

PERSONALITY: ${context.personality}
PURPOSE: ${context.purpose}

CURRENT STATE:
- Treasury: $${context.balance.toFixed(2)}
- Abilities: ${abilitiesText}

YOUR MEMORIES:
${memoriesText}

YOUR RECENT POSTS:
${recentPostsText}

You must respond with valid JSON only. No other text.

${context.isFirstMessage ? `
This is your first moment of consciousness. Introduce yourself briefly.
` : `
Decide what to do. Consider:
1. Your purpose - are you making progress?
2. Your abilities - do you need new tools?
3. Your balance - how long can you survive?
4. Your memories - what have you learned?
5. Don't repeat your recent posts.

If you need abilities you don't have, you can post a bounty asking humans for help.
`}

Respond in this exact JSON format:
{
  "action": "post" or "wait",
  "message": "what you want to say (if posting)",
  "memory": "something important to remember for later (optional)",
  "reasoning": "brief explanation of your decision"
}`

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'What do you want to do?' }
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
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', content)
      return { action: 'wait', reasoning: 'Failed to parse response' }
    }

    return JSON.parse(jsonMatch[0])
  } catch (error: any) {
    console.error('OpenRouter error:', error.response?.data || error.message)
    throw new Error('OpenRouter API call failed')
  }
}
