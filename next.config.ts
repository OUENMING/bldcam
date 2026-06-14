import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      // Add custom domain if using one for R2
      // {
      //   protocol: "https",
      //   hostname: "cdn.yourdomain.com",
      // },
    ],
  },
};

export default nextConfig;
