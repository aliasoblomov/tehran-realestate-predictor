import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles deployment; no standalone output needed
  // Leaflet requires client-side only; handled via dynamic imports in components
  webpack: (config) => {
    // Leaflet uses window/document - exclude from SSR bundle
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;
