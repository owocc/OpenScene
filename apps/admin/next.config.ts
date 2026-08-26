import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: [
    "@openscene-ai/api-client",
    "@openscene-ai/core",
    "@openscene-ai/schema",
  ],
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
};

export default nextConfig;
