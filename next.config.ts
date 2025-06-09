// next.config.ts
import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // your existing settings…
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // add this webpack override:
  webpack(config) {
    // ensure we don’t clobber any other aliases:
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // redirect the old import to the new file path
      'private-next-instrumentation-client': require.resolve(
        'next/dist/lib/require-instrumentation-client.js'
      ),
    }
    return config
  },
}

export default nextConfig
