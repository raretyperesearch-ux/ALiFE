'use client'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { getAgent, getAgentFeed, sendMessage } from '@/lib/api'
import { useParams } from 'next/navigation'

interface Agent {
  id: string
  name: string
  symbol: string
  personality: string
  purpose: string
  status: string
  balanceUsd: number
  walletAddress: string
  tokenAddress: string
  createdAt: string
}

interface Message {
  id: string
  senderType: string
  senderAddress: string
  content: string
  createdAt: string
}

export default function AgentPage() {
  const params = useParams()
  const { address } = useAccount()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (params.id) {
      getAgent(params.id as string).then(res => {
        if (res.success) setAgent(res.data)
      })
      getAgentFeed(params.id as string).then(res => {
        if (res.success) setMessages(res.data)
      })
    }
  }, [params.id])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !address || !agent) return
    
    setSending(true)
    const res = await sendMessage(agent.id, input, address)
    if (res.success) {
      setMessages([res.data, ...messages])
      setInput('')
    }
    setSending(false)
  }

  if (!agent) return <div className="p-8 text-center">Loading...</div>

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="bg-gray-900 rounded-lg p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <p className="text-gray-500">${agent.symbol}</p>
          </div>
          <span className={`px-3 py-1 rounded-lg ${
            agent.status === 'alive' ? 'bg-green-500/20 text-green-400' :
            agent.status === 'embryo' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {agent.status}
          </span>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Balance</p>
            <p className="text-3xl font-bold text-green-400">${agent.balanceUsd?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Wallet</p>
            <p className="text-sm font-mono truncate">{agent.walletAddress}</p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4">
          <p className="text-sm text-gray-500 mb-1">Personality</p>
          <p className="text-gray-300">{agent.personality}</p>
        </div>
        {agent.purpose && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-1">Purpose</p>
            <p className="text-gray-300">{agent.purpose}</p>
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Home Base</h2>
        
        <form onSubmit={handleSend} className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={address ? "Message this agent..." : "Connect wallet to chat"}
            disabled={!address}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:border-green-500 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!address || sending}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 px-6 py-2 rounded-lg font-bold"
          >
            Send
          </button>
        </form>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No messages yet</p>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.senderType === 'agent' ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800'
                }`}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className={msg.senderType === 'agent' ? 'text-green-400' : 'text-gray-400'}>
                    {msg.senderType === 'agent' ? agent.name : `${msg.senderAddress?.slice(0, 6)}...`}
                  </span>
                  <span className="text-gray-600">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p>{msg.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
