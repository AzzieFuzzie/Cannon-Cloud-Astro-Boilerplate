import type { APIRoute } from 'astro';

// Every page of the site, for search engines (robots.txt points here)
const PAGES = ['/', '/menu/', '/about/', '/book/', '/contact/'];

export const GET: APIRoute = ({ site }) => {
    const urls = PAGES.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`).join(
        '\n'
    );

    return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
    );
};
