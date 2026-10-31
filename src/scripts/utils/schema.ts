import site from '@data/site.json';

/*
 * schema.org data (JSON-LD) for search engines and AI assistants: the restaurant on every page,
 * the dishes and prices on the menu page. Built from the same data files the pages show.
 */

const NAME = 'Pigalle by Villamoura';

const DAYS: Record<string, string> = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday'
};
const DAY_ORDER = Object.keys(DAYS);

// "Mon-Thu" -> every day in the range
const toDays = (range: string): string[] => {
    const [from, to = from] = range.split('-').map((day) => day.trim());
    const start = DAY_ORDER.indexOf(from);
    const end = DAY_ORDER.indexOf(to);
    if (start < 0 || end < 0) return [];

    return DAY_ORDER.slice(start, end + 1).map((day) => DAYS[day]);
};

// "10:30pm" -> "22:30"; midnight closing is "24:00" rather than "00:00"
const toTime = (time: string, isClosing = false): string => {
    const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!match) return time;

    let hours = Number(match[1]) % 12;
    if (match[3].toLowerCase() === 'pm') hours += 12;
    if (isClosing && hours === 0 && match[2] === '00') return '24:00';

    return `${String(hours).padStart(2, '0')}:${match[2]}`;
};

export const getRestaurantSchema = (siteUrl: URL) => ({
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': new URL('/#restaurant', siteUrl).href,
    name: NAME,
    url: new URL('/', siteUrl).href,
    telephone: site.phone,
    email: site.email,
    address: {
        '@type': 'PostalAddress',
        streetAddress: 'UO9, Michelangelo Towers, Maude St',
        addressLocality: 'Sandton',
        addressRegion: 'Gauteng',
        postalCode: '2196',
        addressCountry: 'ZA'
    },
    hasMap: site.mapsUrl,
    servesCuisine: ['Portuguese', 'Mediterranean', 'Seafood', 'Halaal'],
    acceptsReservations: new URL('/book/', siteUrl).href,
    hasMenu: new URL('/menu/', siteUrl).href,
    openingHoursSpecification: site.hours.map(({ days, time }) => {
        const [opens, closes] = time.split('-');
        return {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: toDays(days),
            opens: toTime(opens),
            closes: toTime(closes, true)
        };
    })
});

interface MenuSchemaCategory {
    name: string;
    items: { name: string; description?: string; price: string }[];
}

export const getMenuSchema = (categories: MenuSchemaCategory[], siteUrl: URL) => ({
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: `${NAME} menu`,
    url: new URL('/menu/', siteUrl).href,
    inLanguage: 'en',
    hasMenuSection: categories.map((category) => ({
        '@type': 'MenuSection',
        name: category.name,
        hasMenuItem: category.items.map((item) => {
            // Prices are plain rand amounts ("325"); anything else is left out of the offer
            const price = item.price.replace(/[^\d.]/g, '');

            return {
                '@type': 'MenuItem',
                name: item.name,
                ...(item.description ? { description: item.description } : {}),
                ...(price ? { offers: { '@type': 'Offer', price, priceCurrency: 'ZAR' } } : {})
            };
        })
    }))
});
