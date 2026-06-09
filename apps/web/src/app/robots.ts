import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/admin', '/dashboard/super-admin', '/checkout', '/cart'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
