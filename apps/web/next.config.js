/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@aurix/types', '@aurix/utils'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  images: {
    domains: ['localhost'],
  },
  experimental: {
    // Enable ESM externals to handle modern packages
    esmExternals: true,
  },
  webpack: (config, { isServer }) => {
    // Handle node-specific modules on client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        http2: false,
      };
    }

    // Exclude native node modules from client bundle
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push(
        'utf-8-validate',
        'bufferutil'
      );
    }

    return config;
  },
};

module.exports = nextConfig;
