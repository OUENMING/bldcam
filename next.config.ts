import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        // Single-level wildcard on purpose: `**` matches any depth of subdomain,
        // which would allow images from any R2 bucket on the internet.
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "cdn.bldcam.page",
      },
    ],
  },
};

export default nextConfig;
