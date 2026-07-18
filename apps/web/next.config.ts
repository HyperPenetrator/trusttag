import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // Treat optional deep-dependencies that aren't used in local flow as externals
    config.externals.push(
      'pino-pretty',
      'lokijs',
      'encoding',
      '@x402/evm',
      '@x402/core/client',
      '@x402/evm/exact/client',
      '@x402/evm/upto/client',
      '@x402/svm/exact/client',
      // Must use object form so webpack emits require('...') not a bare identifier
      { '@react-native-async-storage/async-storage': 'commonjs @react-native-async-storage/async-storage' }
    );
    return config;
  },
};

export default nextConfig;
