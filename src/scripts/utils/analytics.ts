/*
 * Analytics events for Google Tag Manager, which sends them on to GA4.
 * Everything goes through window.dataLayer; without GTM on the page (no PUBLIC_GTM_ID) the
 * events just collect there unused. Bookings themselves are tracked by the Dineplan widget,
 * which fires its own events into the same GTM container.
 */

type Params = Record<string, string | number | undefined>;

declare global {
    interface Window {
        dataLayer: Record<string, unknown>[];
    }
}

export const track = (event: string, params: Params = {}): void => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
};

/**
 * A page view. Swup changes pages without a reload, so GA4's own page view only covers the
 * first page: this runs on the first load and after every page change.
 */
export const trackPageView = (): void => {
    track('page_view_virtual', {
        page_path: window.location.pathname,
        page_title: document.title,
        page_location: window.location.href
    });
};

const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok'];

// Which event a link is, from where it goes; null for links that aren't tracked
const classify = ($link: HTMLAnchorElement): { event: string; params?: Params } | null => {
    const href = $link.getAttribute('href') ?? '';

    if (href.startsWith('tel:')) return { event: 'call_click' };
    if (href.startsWith('mailto:')) return { event: 'email_click' };

    let url: URL;
    try {
        url = new URL($link.href);
    } catch {
        return null;
    }

    if (url.hostname === 'wa.me') return { event: 'whatsapp_click' };
    if (url.hostname.startsWith('maps.') || url.pathname.startsWith('/maps')) {
        return { event: 'directions_click' };
    }

    const network = SOCIAL_NETWORKS.find((name) => url.hostname.includes(name));
    if (network) return { event: 'social_click', params: { network } };

    if (url.origin === window.location.origin && url.pathname.replace(/\/$/, '') === '/book') {
        return { event: 'book_click' };
    }

    return null;
};

/**
 * One listener for every tracked link on every page: booking links, phone, WhatsApp, email,
 * directions and socials. `link_location` comes from the closest [data-track-area], so the
 * report can show which part of the page led to a booking.
 */
export const watchClicks = (): void => {
    document.addEventListener(
        'click',
        (e) => {
            const $link = (e.target as Element | null)?.closest?.('a[href]');
            if (!($link instanceof HTMLAnchorElement)) return;

            const match = classify($link);
            if (!match) return;

            const area = $link.closest<HTMLElement>('[data-track-area]')?.dataset.trackArea;

            track(match.event, {
                link_location: area ?? window.location.pathname,
                link_text: $link.textContent?.trim().slice(0, 100) || undefined,
                ...match.params
            });
        },
        // Capture: Swup handles internal link clicks before they would bubble up
        { capture: true }
    );
};
