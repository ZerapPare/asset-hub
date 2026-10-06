import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // native module (.node) ให้ Node โหลดเอง ไม่ให้ bundler แตะ — ใช้ render หน้าแรกของ PDF ใน worker
  serverExternalPackages: ["@napi-rs/canvas"],
  // security headers — frame 'self' เพราะหน้า Asset ฝัง preview PDF ด้วย iframe ของเราเอง
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
