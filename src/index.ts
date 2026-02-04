import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load env vars first
dotenv.config();

// Import routes
import { createAgent, getAgents, getAgent } from './api/agents';
import { postMessage, getFeed, getAgentFeed } from './api/homebase';

// Import and start cron
import { startAgentLoop } from './cron';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ==================
// ROUTES
// ==================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Agent endpoints
app.post('/api/agents/create', createAgent);
app.get('/api/agents', getAgents);
app.get('/api/agents/:id', getAgent);

// Home Base endpoints
app.post('/api/homebase/message', postMessage);
app.get('/api/homebase/feed', getFeed);
app.get('/api/homebase/agent/:agentId', getAgentFeed);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Not found' 
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// ==================
// START SERVER
// ==================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         ALiFe Backend v1.0.0          ║
╠═══════════════════════════════════════╣
║  Server running on port ${PORT}          ║
║  Agent loop: every 5 minutes          ║
╚═══════════════════════════════════════╝
  `);

  // Start the agent cron loop
  startAgentLoop();
});

export default app;
