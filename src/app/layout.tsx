import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Basketball Lobster — The best basketball content, all in one feed',
  description:
    'AI-curated NBA content aggregator. Articles, videos, and podcasts from the best basketball sources, ranked by the community.',
  openGraph: {
    title: 'Basketball Lobster',
    description: 'The best basketball content, all in one feed.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="lobster">
      <body className="bg-base-200 min-h-screen">{children}</body>
    </html>
  );
}
