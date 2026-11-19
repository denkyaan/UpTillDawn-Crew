import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// Expose the lightweight SPA as an isolated, same-origin Main static mount.
// Never proxy or rewrite production traffic; the legacy Main routes remain intact.
const sameOriginModernMain = process.env.NEXT_PUBLIC_APP_URL === 'https://uptilldawn-main.uptilldawn.workers.dev'

const localSupabaseConnectSources = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http://127.0.0.1:') || process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http://localhost:')
  ? ' http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*'
  : ''

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.geoapify.com https://api.geoapify.com" + localSupabaseConnectSources,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob: https:",
  "upgrade-insecure-requests",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: process.env.NODE_ENV === 'development'
      ? { bodySizeLimit: '21mb', allowedOrigins: ['*.app.github.dev', 'localhost:3000'] }
      : { bodySizeLimit: '21mb' },
  },
  images: {
    // OpenNext/Cloudflare serves local application assets directly.
    unoptimized: true,
  },
  async rewrites() {
    if (!sameOriginModernMain) return []
    // Fall back to the SPA shell ONLY after Next/Cloudflare checks actual
    // /modern/assets/* files. Never intercept existing legacy Main pages.
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: '/modern', destination: '/modern/index.html' },
        { source: '/modern/:path*', destination: '/modern/index.html' },
      ],
    }
  },
  async headers() {
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // A stale service-worker script can keep an installed PWA on an old
        // application lifecycle even when the client explicitly calls update().
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        // Keep install metadata current across deployments as well.
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

export default nextConfig

if (process.env.NODE_ENV === 'development') initOpenNextCloudflareForDev()
