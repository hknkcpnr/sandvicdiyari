/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gzip ve Brotli sıkıştırmasını aktif et (ağ trafiğini %60-70 azaltır, yanıtları hızlandırır)
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,

  // Modern görsel sıkıştırma ve önbellekleme
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 gün tarayıcı/CDN görsel önbelleği
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },

  // Üretim ortamında console.log temizliği ve paket ağacı optimizasyonu
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['@reduxjs/toolkit', 'react-redux'],
  },

  // Güvenlik ve Agresif Statik Varlık Önbellek Başlıkları
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Statik resimler, ikonlar ve fontlar için agresif önbellekleme (anında yükleme)
      {
        source: '/(images|audio|icons|uploads)/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
