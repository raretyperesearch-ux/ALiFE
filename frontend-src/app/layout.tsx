import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'ALiFe - Autonomous AI Agents',
  description: 'Launch autonomous AI agents that live or die by their token',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">
        <Providers>
          <nav className="border-b border-gray-800 p-4">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
              <a href="/" className="text-2xl font-bold text-green-400">ALiFe</a>
              <div className="flex gap-6">
                <a href="/" className="hover:text-green-400">Launch</a>
                <a href="/observatory" className="hover:text-green-400">Observatory</a>
                <a href="/graveyard" className="hover:text-green-400">Graveyard</a>
              </div>
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  )
}
