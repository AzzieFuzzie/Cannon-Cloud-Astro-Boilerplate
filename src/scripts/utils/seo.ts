import type { Seo } from '@data/seo';

/**
 * The astro-seo props for a page: its own SEO, falling back to the defaults.
 * `url` is the page's absolute URL, used as its canonical unless the page sets one;
 * images are made absolute too, since social sites need a full URL.
 */
export const getSeo = (
    seo: Seo,
    defaultSeo: Seo,
    pageTitle: string | null = null,
    url: URL | null = null
) => {
    const title = seo?.title || pageTitle || defaultSeo.title;
    const description = seo?.description || defaultSeo.description;
    const canonical = seo?.advanced?.canonical || defaultSeo.advanced?.canonical || url?.href;
    const robots = seo?.advanced?.robots || defaultSeo.advanced?.robots || [];
    const absolute = (path?: string) => (path && url ? new URL(path, url).href : path);

    return {
        title,
        description,
        canonical,
        openGraph: {
            basic: {
                type: 'website',
                title:
                    seo?.social?.facebook?.title ||
                    defaultSeo.social?.facebook?.title ||
                    title ||
                    '',
                image:
                    absolute(
                        seo?.social?.facebook?.image?.url || defaultSeo.social?.facebook?.image?.url
                    ) || '',
                url: canonical
            },
            optional: {
                description:
                    seo?.social?.facebook?.description ||
                    defaultSeo.social?.facebook?.description ||
                    description,
                siteName: defaultSeo.title
            }
        },
        twitter: {
            card: 'summary_large_image' as const,
            creator: seo?.social?.twitter?.creator || defaultSeo.social?.twitter?.creator,
            image: absolute(
                seo?.social?.twitter?.image?.url || defaultSeo.social?.twitter?.image?.url
            ),
            title: seo?.social?.twitter?.title || defaultSeo.social?.twitter?.title || title,
            description:
                seo?.social?.twitter?.description ||
                defaultSeo.social?.twitter?.description ||
                description
        },
        // astro-seo writes the robots tag from these two
        noindex: robots.includes('noindex'),
        nofollow: robots.includes('nofollow')
    };
};
