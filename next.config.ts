import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/wms",
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/uploads/:path*" },
    ];
  },
};
export default nextConfig;
