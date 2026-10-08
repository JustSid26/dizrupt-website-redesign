import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export", // static HTML in out/, served by Caddy on the VPS
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
