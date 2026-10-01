import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // native module (.node) ให้ Node โหลดเอง ไม่ให้ bundler แตะ — ใช้ render หน้าแรกของ PDF ใน worker
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
