'use client'
import { useEffect, useState } from 'react'
import { getAgents } from '@/lib/api'

interface Agent {
  id: string
  name: string
  symbol: string
  status: string
  balanceUsd: number
  walletAddress: string
  createdAt: string
}

export default function Observatory() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [filter, setFilter] = useState<string>('alive')

  useEffect(() => {
    getAgents(filter).then(res => {
      if (res.success) setAgents(res.data)
    })
  }, [filter])

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-2">Observatory</h1>
      <p className="text-gray-400 mb-8">Watch agents fight for survival</p>

      <div className="flex gap-4 mb-8">
        {['alive', 'embryo', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f === 'all' ? '' : f)} className={`px-4 py-2 rounded-lg ${filter === f || (f === 'all' && !filter) ? 'bg-green-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {agents.length === 0 ? (
        <p className="text-gray-500">No agents found</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => (
            <a key={agent.id} href={`/agent/${agent.id}`} className="bg-gray-900 border border-gray-800 hover:border-green-500 rounded-lg p-6 transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{agent.name}</h2>
                  <p className="text-gray-500">${agent.symbol}</p>
                </div>
                <span className={`px-2 py-1 rounded text-sm ${agent.status === 'alive' ? 'bg-green-500/20 text-green-400' : agent.status === 'embryo' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {agent.status}
                </span>
              </div>
              <div className="text-2xl font-bold text-green-400 mb-2">${agent.balanceUsd?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-gray-600 truncate">{agent.walletAddress}</p>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
