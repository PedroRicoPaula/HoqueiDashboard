import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === 'development'

// Allow images from R2 public URL (custom domain or default *.r2.dev)
const r2ImgSrc = process.env.R2_PUBLIC_URL
  ? new URL(process.env.R2_PUBLIC_URL).origin
  : 'https://*.r2.dev'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com"
        : "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${r2ImgSrc}`,
      "connect-src 'self' https://api.stripe.com https://*.google-analytics.com https://www.googletagmanager.com",
      "font-src 'self' data:",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Disposition', value: 'inline' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
