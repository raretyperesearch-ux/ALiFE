import express from 'express'
import cors from 'cors'
import { agentRoutes } from './routes/agents'
import { startAgentLoop } from './cron'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', agentRoutes)

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log('')
  console.log('╔═══════════════════════════════════════╗')
  console.log('║         ALiFe Backend v2.0.0          ║')
  console.log('╠═══════════════════════════════════════╣')
  console.log('║  Autonomous Agents - Self-Scheduling  ║')
  console.log('╚═══════════════════════════════════════╝')
  console.log('')
  startAgentLoop()
})
