/** @type {import('next').NextConfig} */

// Bundle Analyzer Configuration - Make it optional
let withBundleAnalyzer;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch (e) {
  // If @next/bundle-analyzer is not installed, use a passthrough function
  console.log('⚠️  @next/bundle-analyzer not installed, skipping bundle analysis');
  withBundleAnalyzer = (config) => config;
}

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
    // TEMPORARILY DISABLED: Keep console.log for debugging
    // removeConsole: process.env.NODE_ENV === 'production' ? {
    //   exclude: ['error', 'warn'],
    // } : false,
  },
  // swcMinify is now default in Next.js 15 - removed deprecated option
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['@/components', '@/utils', '@/lib'],
    // Reduce memory usage during builds
    workerThreads: false,
    cpus: 1,
  },

  // OPTIMIZED API Rewrites - Performance-based routing
  // Based on MCP testing: proxy only the fastest endpoints
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL || 'https://api.wasgeurtje.nl';
    
    return [
      // ACF API endpoints - KEEP PROXY (1000ms faster than direct)
      {
        source: '/wp-json/acf/:path*',
        destination: `${apiBaseUrl}/wp-json/acf/:path*`,
      },
      // WooCommerce API endpoints - KEEP PROXY (for consistency)
      {
        source: '/wp-json/wc/:path*',
        destination: `${apiBaseUrl}/wp-json/wc/:path*`,
      },
      // WordPress REST API - RE-ADDED to fix 404s on Vercel
      // Browser makes relative /wp-json/wp/v2/* requests that need proxying
      {
        source: '/wp-json/wp/:path*',
        destination: `${apiBaseUrl}/wp-json/wp/:path*`,
      },
      // WordPress uploads - KEEP PROXY (for image handling)
      {
        source: '/wp-content/:path*',
        destination: `${apiBaseUrl}/wp-content/:path*`,
      },
      // Custom Wasgeurtje API endpoints (for A/B testing options)
      {
        source: '/wp-json/wasgeurtje/:path*',
        destination: `https://wasgeurtje.nl/wp-json/wasgeurtje/:path*`,
      },
    ];
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
        hostname: 'api.wasgeurtje.nl',
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
    ],
  },
}

module.exports = withBundleAnalyzer(nextConfig)
