import { MetadataRoute } from 'next';

// Use same port as dev server or fall back to localhost envs
const BACKEND_URL = process.env.API_URL || 'http://localhost:5000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  let productsList: any[] = [];
  try {
    // Fetch products catalog list
    const res = await fetch(`${BACKEND_URL}/api/v1/products`);
    if (res.ok) {
      const data = await res.json();
      productsList = data.success ? data.data : [];
    }
  } catch (err) {
    console.error('Failed to pre-fetch sitemap routes:', err);
  }

  const productUrls = productsList.map((p: any) => ({
    url: `${baseUrl}/products/${p.slug}`,
    lastModified: new Date(p.updatedAt || new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/wishlist`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    ...productUrls,
  ];
}
