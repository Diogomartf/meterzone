import type { APIRoute } from 'astro';

const robotsTxt = (sitemapURL: URL) => `User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  // Prefer a stable root sitemap.xml (copy of sitemap-0 from build) for GSC.
  const sitemapURL = new URL('sitemap.xml', site);
  return new Response(robotsTxt(sitemapURL), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
