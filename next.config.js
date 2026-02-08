/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Permet d'utiliser les API routes avec Vite
  experimental: {
    serverActions: true,
  },

  // Configuration pour Vercel
  env: {
    POSTGRES_URL: process.env.POSTGRES_URL,
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
    POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
  },
};

module.exports = nextConfig;
