/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  async rewrites() {
    return [
      {
        source: '/media-campaigns',
        destination: '/settings/ad-manager',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*', // Proxy to Backend
      },
    ];
  },
};

export default nextConfig
