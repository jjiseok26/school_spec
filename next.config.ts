import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "jszip", "xlsx"],
};

export default nextConfig;
