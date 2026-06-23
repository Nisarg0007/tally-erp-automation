import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  output: "export",

  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      "https://tally-erp-backend.onrender.com",
  },
};

export default nextConfig;