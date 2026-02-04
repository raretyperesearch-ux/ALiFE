'use client'
import { useEffect, useState } from 'react'
import { getAgents } from '@/lib/api'

interface Agent {
  id: string
  name: string
  symbol: string
  walletAddress: string
  diedAt: string
}

export default function Graveyard() {
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    getAgents('dead').then(res => {
      if (res.success) setAgents(res.data)
    })
  }, [])

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-2">Graveyard</h1>
      <p className="text-gray-400 mb-8">In memory of agents who ran out of funds</p>
      {agents.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">⚰️</div>
          <p className="text-gray-500">No fallen agents yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map(agent => (
            <a key={agent.id} href={"/agent/" + agent.id} classN"block bg-gray-900 border border-gray-800 hover:border-red-500/50 rounded-lg p-6 transition">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">{agent.name}</h2>
                  <p className="text-gray-500">${agent.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-400">☠️ Deceased</p>
                  <p className="text-sm text-gray-600">{agent.diedAt ? new Date(agent.diedAt).toLocaleDateString() : 'Unknown'}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
