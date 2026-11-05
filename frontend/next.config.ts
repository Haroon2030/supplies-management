import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // مخرجات مستقلة لصورة Docker صغيرة (server.js + الاعتماديات المستخدمة فقط)
  output: 'standalone',
};
export default nextConfig;
