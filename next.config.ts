import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const privateHeaders = [
      {key:"Cache-Control",value:"private, no-store, max-age=0"},
      {key:"X-Robots-Tag",value:"noindex, nofollow"},
    ];
    return [
      {source:"/admin/:path*",headers:privateHeaders},
      {source:"/api/admin/:path*",headers:privateHeaders},
    ];
  },
};

export default nextConfig;
