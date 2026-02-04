import { supabase } from '../lib/supabase'

export interface Tool {
  name: string
  description: string
  cost: number
  category: string
  automated: boolean
}

export const getAvailableTools = async (): Promise<Tool[]> => {
  const { data } = await supabase
    .from('tools')
    .select('*')
    .eq('enabled', true)
    .order('cost', { ascending: true })
  
  return data || []
}

export const getAgentTools = async (agentId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('abilities')
    .select('name')
    .eq('agent_id', agentId)
  
  return data?.map(a => a.name) || []
}

export const acquireTool = async (agentId: string, toolName: string, config: any = {}): Promise<boolean> => {
  const { error } = await supabase
    .from('abilities')
    .insert({
      agent_id: agentId,
      name: toolName,
      config
    })
  
  return !error
}

export const postBounty = async (
  agentId: string,
  title: string,
  description: string,
  rewardUsd: number
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('bounties')
    .insert({
      agent_id: agentId,
      title,
      description,
      reward_usd: rewardUsd
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('Failed to post bounty:', error)
    return null
  }
  
  return data.id
}

export const getOpenBounties = async () => {
  const { data } = await supabase
    .from('bounties')
    .select('*, agents(name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  
  return data || []
}
