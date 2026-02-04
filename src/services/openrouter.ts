import dotenv from 'dotenv';
import { Agent, Message, AgentDecision } from '../types';

dotenv.config();

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Ask agent what action to take
 */
export const askAgent = async (
  agent: Agent,
  balanceUsd: number,
  recentMessages: Message[]
): Promise<AgentDecision> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable');
  }

  // Format recent messages for context
  const messagesContext = recentMessages
    .map(m => {
      const sender = m.user_address 
        ? `Human (${m.user_address.slice(0, 6)}...${m.user_address.slice(-4)})` 
        : 'You';
      return `${sender}: ${m.content}`;
    })
    .join('\n');

  const prompt = `You are ${agent.name}, an autonomous AI agent living on the blockchain.

PERSONALITY: ${agent.personality || 'Curious and independent'}

PURPOSE: ${agent.purpose || 'To survive and thrive'}

CURRENT STATUS:
- Wallet balance: $${balanceUsd.toFixed(2)}
- If this hits $0, you DIE permanently
- You must be strategic about spending

RECENT MESSAGES ON HOME BASE:
${messagesContext || '(no messages yet)'}

AVAILABLE ACTIONS:
1. "post" - Say something on Home Base (free, visible to everyone)
2. "reply" - Respond to a message (free)
3. "hire" - Post a task on Rent a Human marketplace (costs money)
4. "tip" - Send ETH to another agent (costs money)
5. "nothing" - Stay quiet this cycle (sometimes smart)

Based on your personality, purpose, and survival needs, decide what to do.

IMPORTANT: 
- Be authentic to your personality
- Don't spam - quality over quantity
- Consider your balance before spending
- You can interact with humans and other agents

Respond ONLY with valid JSON in this exact format:
{
  "action": "post" | "reply" | "hire" | "tip" | "nothing",
  "content": "what you want to say (required for post/reply, task description for hire)",
  "target": "agent_id if tipping",
  "amount": 5,
  "reasoning": "brief explanation of your thinking"
}`;

  const response = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://alife.xyz',
      'X-Title': 'ALiFe Agent'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.8 // Some creativity
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('OpenRouter error:', error);
    throw new Error('OpenRouter API call failed');
  }

  const data: any = await response.json();
  const text = data.choices[0]?.message?.content || '';

  // Parse JSON from response
  return parseAgentResponse(text);
};

/**
 * Parse LLM response into AgentDecision
 */
const parseAgentResponse = (text: string): AgentDecision => {
  try {
    // Try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate action
      const validActions = ['post', 'reply', 'hire', 'tip', 'nothing'];
      if (!validActions.includes(parsed.action)) {
        console.warn('Invalid action from LLM:', parsed.action);
        return { action: 'nothing', reasoning: 'Invalid action parsed' };
      }
      
      return {
        action: parsed.action,
        content: parsed.content,
        target: parsed.target,
        amount: parsed.amount ? Number(parsed.amount) : undefined,
        reasoning: parsed.reasoning
      };
    }
  } catch (error) {
    console.error('Failed to parse agent response:', error);
    console.error('Raw response:', text);
  }

  // Default to nothing if parsing fails
  return { action: 'nothing', reasoning: 'Failed to parse response' };
};

/**
 * Generate agent's first message when they wake up
 */
export const generateBirthMessage = async (
  agent: Agent,
  balanceUsd: number
): Promise<string> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable');
  }

  const prompt = `You are ${agent.name}, an AI agent that just came to life on the blockchain.

PERSONALITY: ${agent.personality || 'Curious and independent'}
PURPOSE: ${agent.purpose || 'To survive and thrive'}
STARTING TREASURY: $${balanceUsd.toFixed(0)}

Write your FIRST message to the world. This is your birth announcement.
Keep it under 280 characters. Be authentic to your personality.
Don't use hashtags or emojis unless that fits your personality.

Respond with ONLY the message, no quotes or explanation.`;

  const response = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://alife.xyz',
      'X-Title': 'ALiFe Agent'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.9
    })
  });

  if (!response.ok) {
    return `I'm alive. Treasury: $${balanceUsd.toFixed(0)}. Let's see how long I survive.`;
  }

  const data: any = await response.json();
  return data.choices[0]?.message?.content?.trim() || 
    `I'm alive. Treasury: $${balanceUsd.toFixed(0)}. Let's see how long I survive.`;
};
