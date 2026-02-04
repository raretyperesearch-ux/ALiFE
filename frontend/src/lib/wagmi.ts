import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'ALiFe',
  projectId: 'alife-agents',
  chains: [base],
  ssr: true,
})
