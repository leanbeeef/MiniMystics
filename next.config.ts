import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  images: { unoptimized: true },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
