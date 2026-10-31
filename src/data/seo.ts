import { getImage } from 'astro:assets';
import eventsImage from '@images/home/events.jpg';

interface SocialSeo {
    title?: string;
    description?: string;
    image?: {
        url: string;
    };
    creator?: string;
}

export interface Seo {
    title?: string;
    description?: string;
    social?: {
        facebook?: SocialSeo;
        twitter?: SocialSeo;
    };
    advanced?: {
        robots?: string[];
        canonical?: string;
    };
}

const TITLE = 'Pigalle by Villamoura';
const DESCRIPTION =
    'Portuguese and Mediterranean-inspired cuisine with a South African twist, at Michelangelo Towers, Sandton. Book a table at Pigalle by Villamoura.';

let defaultSeo: Seo | null = null;

/**
 * The site-wide SEO. Made on first use, not at import: a top-level await on getImage
 * stalls the static build.
 */
export const getDefaultSeo = async (): Promise<Seo> => {
    if (defaultSeo) return defaultSeo;

    // The share image: the size Facebook, WhatsApp and X show in full
    const metaImage = await getImage({
        src: eventsImage,
        width: 1200,
        height: 630,
        fit: 'cover',
        format: 'jpg'
    });

    defaultSeo = {
        title: TITLE,
        description: DESCRIPTION,
        social: {
            facebook: {
                title: TITLE,
                image: {
                    url: metaImage.src
                },
                description: DESCRIPTION
            },
            twitter: {
                title: TITLE,
                image: {
                    url: metaImage.src
                },
                description: DESCRIPTION
            }
        },
        advanced: {
            robots: ['index', 'follow']
        }
    };

    return defaultSeo;
};
