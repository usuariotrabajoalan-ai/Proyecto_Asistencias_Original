import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  
  allowedDevOrigins: ['10.10.10.19', '10.100.63.51', '10.100.58.242', '192.168.100.26', 'localhost', '127.0.0.1'],
  // config options here
};

export default nextConfig;


