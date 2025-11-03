/** @type {import('next').NextConfig} */

// Bundle Analyzer Configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Disable source maps in production for security and performance
  productionBrowserSourceMaps: false,
  
  // Output modern JavaScript (ES2020+) to reduce bundle size
  // Removes unnecessary polyfills for modern browsers
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // swcMinify is now default in Next.js 15 - removed deprecated option
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['@/components', '@/utils', '@/lib'],
    // Reduce memory usage during builds
    workerThreads: false,
    cpus: 1,
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wasgeurtje.nl',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.handiggoed.nl',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'secure.gravatar.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'wasgeurtje.nl',
        pathname: '/wp-content/uploads/**',
      },
    ],
  },
}

module.exports = withBundleAnalyzer(nextConfig)
