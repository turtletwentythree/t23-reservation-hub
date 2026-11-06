import type { NextConfig } from "next";

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // Staff app and everything else: never framed.
      { source: "/((?!book/).*)", headers: [...common, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      // Public booking widget may be embedded on restaurant websites (?embed=1).
      { source: "/book/:path*", headers: [...common, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
};

export default nextConfig;
