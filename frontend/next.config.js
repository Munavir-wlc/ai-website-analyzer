/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

module.exports = nextConfig;
