import type { NextConfig } from 'next';

// عنوان الـ API الداخلي: في الحاوية الموحدة يعمل على نفس الجهاز (المنفذ 4000)
const API_INTERNAL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // مخرجات مستقلة لصورة Docker صغيرة (server.js + الاعتماديات المستخدمة فقط)
  output: 'standalone',
  // الواجهة هي المنفذ الوحيد المكشوف؛ تمرّر /api إلى الـ API فلا حاجة لدومين ثانٍ ولا CORS
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_INTERNAL}/api/:path*` }];
  },
};
export default nextConfig;
