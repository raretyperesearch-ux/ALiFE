import { supabase } from '../lib/supabase'

export interface Tool {
  id: string
  name: string
  description: string
  cost: number
  category: string
  automated: boolean
  enabled: boolean
}

export const getAvailableTools = async (): Promise<Tool[]> => {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('enabled', true)

  if (error) {
    console.error('Error fetching tools:', error)
    return []
  }

  return data || []
}

export const acquireTool = async (agentId: string, toolName: string, config: any = {}) => {
  const { error } = await supabase
    .from('abilities')
    .insert({
      agent_id: agentId,
      name: toolName,
      config
    })

  if (error) {
    console.error('Error acquiring tool:', error)
    return false
  }

  return true
}

export const postBounty = async (agentId: string, title: string, description: string, reward: number) => {
  const { data, error } = await supabase
    .from('bounties')
    .insert({
      agent_id: agentId,
      title,
      description,
      reward_usd: reward,
      status: 'open'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error posting bounty:', error)
    return null
  }

  return data?.id
}

export const getOpenBounties = async () => {
  const { data, error } = await supabase
    .from('bounties')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching bounties:', error)
    return []
  }

  return data || []
}
