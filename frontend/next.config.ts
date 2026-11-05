import type { NextConfig } from 'next';

// عنوان الـ API الداخلي: في الحاوية الموحدة يعمل على نفس الجهاز (المنفذ 4000)
const API_INTERNAL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // مخرجات مستقلة لصورة Docker صغيرة (server.js + الاعتماديات المستخدمة فقط)
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }];
  },
  // الواجهة هي المنفذ الوحيد المكشوف؛ تمرّر /api إلى الـ API فلا حاجة لدومين ثانٍ ولا CORS
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_INTERNAL}/api/:path*` }];
  },
};
export default nextConfig;
