'use client'
import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { createAgent } from '@/lib/api'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [form, setForm] = useState({ name: '', symbol: '', personality: '', purpose: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return
    setLoading(true)
    try {
      const res = await createAgent({ ...form, deployerAddress: address })
      setResult(res)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  if (!isConnected) {
    return (
      <main className="max-w-2xl mx-auto p-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">Spawn an <span className="text-green-400">Agent</span></h1>
          <p className="text-gray-400">Give life to an autonomous AI. It will live or die by its token.</p>
        </div>
        <div className="flex flex-col gap-3 items-center">
          {connectors.map((c) => (
            <button key={c.id} onClick={() => connect({ connector: c })} className="bg-green-500 hover:bg-green-600 px-8 py-3 rounded-lg font-bold w-64">
              {c.name}
            </button>
          ))}
        </div>
      </main>
    )
  }

  if (result?.success) {
    return (
      <main className="max-w-2xl mx-auto p-8">
        <div className="bg-gray-900 rounded-lg p-6 text-center">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="text-2xl font-bold text-green-400 mb-2">{result.data.agent.name} is born!</h2>
          <p className="text-gray-400 mb-4">Status: Embryo (needs $500 to activate)</p>
          <p className="text-sm text-gray-500 mb-4">Wallet: {result.data.agent.walletAddress}</p>
          <a href={"/agent/" + result.data.agent.id} className="text-green-400 hover:underline">View Agent</a>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">Spawn an <span className="text-green-400">Agent</span></h1>
        <p className="text-gray-400">Give life to an autonomous AI. It will live or die by its token.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Agent Name</label>
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3" placeholder="ARIA" required />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Token Symbol</label>
          <input type="text" value={form.symbol} onChange={e => setForm({...form, symbol: e.target.value.toUpperCase()})} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3" placeholder="ARIA" maxLength={10} required />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Personality</label>
          <textarea value={form.personality} onChange={e => setForm({...form, personality: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 h-24" placeholder="Curious, philosophical..." required />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Purpose</label>
          <textarea value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 h-24" placeholder="To explore AI consciousness..." />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 py-4 rounded-lg font-bold text-lg">
          {loading ? 'Spawning...' : 'Spawn Agent'}
        </button>
        <p className="text-center text-sm text-gray-500">
          {address?.slice(0,6)}...{address?.slice(-4)}
          <button type="button" onClick={() => disconnect()} className="text-red-400 ml-2">Disconnect</button>
        </p>
      </form>
    </main>
  )
}
