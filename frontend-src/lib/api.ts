const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function createAgent(data: {
  name: string
  symbol: string
  personality: string
  purpose: string
  deployerAddress: string
}) {
  const res = await fetch(`${API_URL}/api/agents/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function getAgents(status?: string) {
  const url = status ? `${API_URL}/api/agents?status=${status}` : `${API_URL}/api/agents`
  const res = await fetch(url)
  return res.json()
}

export async function getAgent(id: string) {
  const res = await fetch(`${API_URL}/api/agents/${id}`)
  return res.json()
}

export async function getAgentFeed(agentId: string) {
  const res = await fetch(`${API_URL}/api/homebase/agent/${agentId}`)
  return res.json()
}

export async function sendMessage(agentId: string, content: string, senderAddress: string) {
  const res = await fetch(`${API_URL}/api/homebase/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, content, senderAddress }),
  })
  return res.json()
}
