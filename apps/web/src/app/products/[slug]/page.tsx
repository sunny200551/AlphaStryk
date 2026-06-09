import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

async function getProductData(slug: string) {
  try {
    const res = await fetch(`${API_URL}/products/detail/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (err) {
    console.error('Failed to fetch product data:', err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await getProductData(resolvedParams.slug);

  if (!data || !data.product) {
    return {
      title: 'Product Not Found',
    };
  }

  const product = data.product;
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `${baseUrl}/products/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} | AlphaStryk`,
      description: product.description,
      url: `${baseUrl}/products/${product.slug}`,
      images: [
        {
          url: product.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | AlphaStryk`,
      description: product.description,
      images: [product.images[0] || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'],
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const data = await getProductData(slug);

  if (!data || !data.product) {
    notFound();
  }

  const product = data.product;
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images,
    description: product.description,
    offers: {
      '@type': 'Offer',
      price: product.basePrice,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Products',
        item: `${baseUrl}/products`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `${baseUrl}/products/${product.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ProductDetailClient slug={slug} initialData={data} />
    </>
  );
}
