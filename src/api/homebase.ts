import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { PostMessageRequest, Message } from '../types';

/**
 * POST /api/homebase/message
 * Human sends a message to an agent's Home Base
 */
export const postMessage = async (req: Request, res: Response) => {
  try {
    const { agentId, userAddress, content } = req.body as PostMessageRequest;

    // Validate required fields
    if (!agentId || !userAddress || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: agentId, userAddress, content'
      });
    }

    // Validate content length
    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Message too long (max 1000 characters)'
      });
    }

    // Check agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, status')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Insert message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        agent_id: agentId,
        user_address: userAddress,
        content: content.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to post message'
      });
    }

    res.json({
      success: true,
      data: { message }
    });

  } catch (error: any) {
    console.error('Post message error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * GET /api/homebase/feed
 * Get messages for Home Base (agent-specific or global)
 */
export const getFeed = async (req: Request, res: Response) => {
  try {
    const { agentId, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('messages')
      .select(`
        *,
        agent:agents(id, name, symbol, wallet_address)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Filter by agent if provided
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        messages: messages || [],
        count: messages?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Get feed error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * GET /api/homebase/agent/:agentId
 * Get messages for a specific agent's Home Base
 */
export const getAgentFeed = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { limit = 50, before } = req.query;

    let query = supabase
      .from('messages')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    // Pagination via cursor (before timestamp)
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        messages: messages || [],
        count: messages?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Get agent feed error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};
