import { Router } from 'express'
import { supabase } from '../lib/supabase'

export const router = Router()

// Get all agents
router.get('/agents', async (req, res) => {
  const { data, error, count } = await supabase
    .from('agents')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ success: false, error: error.message })
  }

  res.json({
    success: true,
    data: {
      agents: data?.map(a => ({
        id: a.id,
        name: a.name,
        symbol: a.symbol,
        personality: a.personality,
        purpose: a.purpose,
        walletAddress: a.wallet_address,
        tokenAddress: a.token_address,
        status: a.status,
        balanceUsd: a.balance_usd,
        lastActive: a.last_active,
        createdAt: a.created_at,
        bornAt: a.born_at,
        diedAt: a.died_at
      })),
      count
    }
  })
})

// Get agent by ID
router.get('/agents/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error) {
    return res.status(404).json({ success: false, error: 'Agent not found' })
  }

  res.json({ success: true, data })
})

// Get agent home base messages
router.get('/homebase/agent/:agentId', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('agent_id', req.params.agentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return res.status(500).json({ success: false, error: error.message })
  }

  res.json({ success: true, data: { messages: data } })
})

// Get agent goals
router.get('/agents/:id/goals', async (req, res) => {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('agent_id', req.params.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ success: false, error: error.message })
  }

  res.json({ success: true, data: { goals: data } })
})

// Get open bounties
router.get('/bounties', async (req, res) => {
  const { data, error } = await supabase
    .from('bounties')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ success: false, error: error.message })
  }

  res.json({ success: true, data: { bounties: data } })
})

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
