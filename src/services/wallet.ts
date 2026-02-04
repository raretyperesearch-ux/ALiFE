import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { encrypt, decrypt } from '../lib/encryption';

dotenv.config();

// Provider for Base chain
const getProvider = () => {
  const rpcUrl = process.env.BASE_RPC_URL;
  if (!rpcUrl) {
    throw new Error('Missing BASE_RPC_URL environment variable');
  }
  return new ethers.JsonRpcProvider(rpcUrl);
};

// Cache ETH price for 60 seconds
let ethPriceCache: { price: number; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Generate a new random wallet
 * Returns address and encrypted private key
 */
export const generateWallet = (): { address: string; encryptedPrivateKey: string } => {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    encryptedPrivateKey: encrypt(wallet.privateKey)
  };
};

/**
 * Get wallet instance from encrypted private key
 */
export const getWallet = (encryptedPrivateKey: string): ethers.Wallet => {
  const privateKey = decrypt(encryptedPrivateKey);
  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
};

/**
 * Get ETH balance for an address
 */
export const getBalance = async (address: string): Promise<{ eth: string; wei: bigint }> => {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return {
    eth: ethers.formatEther(balance),
    wei: balance
  };
};

/**
 * Get current ETH price in USD (cached)
 */
export const getEthPrice = async (): Promise<number> => {
  const now = Date.now();
  
  // Return cached price if still valid
  if (ethPriceCache && now - ethPriceCache.timestamp < CACHE_TTL) {
    return ethPriceCache.price;
  }
  
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const data: any = await response.json();
    const price = data.ethereum.usd;
    
    // Update cache
    ethPriceCache = { price, timestamp: now };
    
    return price;
  } catch (error) {
    // If fetch fails, return cached price or throw
    if (ethPriceCache) {
      console.warn('Failed to fetch ETH price, using cached value');
      return ethPriceCache.price;
    }
    throw new Error('Failed to fetch ETH price');
  }
};

/**
 * Get balance in USD
 */
export const getBalanceUsd = async (address: string): Promise<number> => {
  const { eth } = await getBalance(address);
  const ethPrice = await getEthPrice();
  return parseFloat(eth) * ethPrice;
};

/**
 * Send ETH from one wallet to another
 */
export const sendEth = async (
  encryptedPrivateKey: string,
  toAddress: string,
  amountEth: number
): Promise<{ txHash: string }> => {
  const wallet = getWallet(encryptedPrivateKey);
  
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amountEth.toFixed(8))
  });
  
  await tx.wait();
  
  return { txHash: tx.hash };
};

/**
 * Convert USD to ETH
 */
export const usdToEth = async (usd: number): Promise<number> => {
  const ethPrice = await getEthPrice();
  return usd / ethPrice;
};
