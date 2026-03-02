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
  webpack: (config, { isServer }) => {
    // Handle undici and other node-specific modules
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

    // Add rule to transpile undici and firebase with babel
    config.module.rules.unshift({
      test: /\.(js|mjs)$/,
      include: [
        /node_modules[\\/]undici/,
        /node_modules[\\/]@firebase/,
        /node_modules[\\/]firebase/,
      ],
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['next/babel'],
          cacheDirectory: true,
        },
      },
    });

    // Support for native node modules
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
