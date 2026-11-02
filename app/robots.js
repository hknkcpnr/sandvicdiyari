export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/admin/', '/kurye'],
    },
    sitemap: 'https://sandwichdiyari.com/sitemap.xml',
  };
}
