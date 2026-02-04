-- ALiFe Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    personality TEXT,
    purpose TEXT,
    deployer_address TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    token_address TEXT,
    status TEXT DEFAULT 'embryo' CHECK (status IN ('embryo', 'alive', 'dead')),
    balance_usd DECIMAL DEFAULT 0,
    last_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    born_at TIMESTAMPTZ,
    died_at TIMESTAMPTZ
);

-- Messages table (Home Base)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    user_address TEXT, -- null if message is from agent
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tips table
CREATE TABLE tips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    to_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    amount_eth DECIMAL NOT NULL,
    tx_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_wallet ON agents(wallet_address);
CREATE INDEX idx_messages_agent ON messages(agent_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_tips_from ON tips(from_agent_id);
CREATE INDEX idx_tips_to ON tips(to_agent_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

-- Public read policies (adjust based on your needs)
CREATE POLICY "Agents are publicly readable" ON agents FOR SELECT USING (true);
CREATE POLICY "Messages are publicly readable" ON messages FOR SELECT USING (true);
CREATE POLICY "Tips are publicly readable" ON tips FOR SELECT USING (true);

-- Service role can do everything (your backend uses service key)
CREATE POLICY "Service role full access agents" ON agents FOR ALL USING (true);
CREATE POLICY "Service role full access messages" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access tips" ON tips FOR ALL USING (true);

-- Enable Realtime for live updates (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
