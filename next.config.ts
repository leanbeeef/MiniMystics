import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
