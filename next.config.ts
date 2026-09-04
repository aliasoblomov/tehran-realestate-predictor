import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://tehran-realestate-predictor-git-924226493878.us-central1.run.app";

const nextConfig: NextConfig = {
  // Vercel handles deployment; no standalone output needed
  // Leaflet requires client-side only; handled via dynamic imports in components

  // ── Reverse proxy: route /api/proxy-predict → Cloud Run backend ──
  // This bypasses IP-level blocking (Iranian IPs, VPNs) because
  // the request now originates from Vercel's edge servers.
  async rewrites() {
    return [
      {
        source: "/api/proxy-predict",
        destination: `${BACKEND_URL}/predict`,
      },
    ];
  },

  webpack: (config) => {
    // Leaflet uses window/document - exclude from SSR bundle
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;
