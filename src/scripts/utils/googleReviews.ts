/**
 * Guest reviews from Google, fetched at build time (like the Pigalle app's google_reviews.js).
 * The API key never reaches the browser; the reviews refresh every time the site is rebuilt.
 *
 * Needs GOOGLE_API_KEY and GOOGLE_PLACE_ID in .env (or the host's environment variables),
 * and the Places API enabled on a Google Cloud project with billing.
 */

export interface Review {
    text: string;
    author: string;
}

const ENDPOINT = 'https://maps.googleapis.com/maps/api/place/details/json';

interface PlaceReview {
    author_name: string;
    rating: number;
    text: string;
}

/**
 * Five-star Google reviews with text, newest Google order. Empty when the keys are missing
 * or the request fails, so the page falls back to the reviews in src/data/home.json.
 */
export const getGoogleReviews = async (limit = 5): Promise<Review[]> => {
    const key = import.meta.env.GOOGLE_API_KEY;
    const placeId = import.meta.env.GOOGLE_PLACE_ID;

    if (!key || !placeId) return [];

    try {
        const params = new URLSearchParams({ place_id: placeId, fields: 'reviews', key });
        const response = await fetch(`${ENDPOINT}?${params}`);
        const data = await response.json();

        if (data.status !== 'OK') {
            console.warn(`Google reviews: ${data.status} ${data.error_message ?? ''}`.trim());
            return [];
        }

        const reviews: PlaceReview[] = data.result?.reviews ?? [];

        return reviews
            .filter((review) => review.rating === 5 && review.text?.trim())
            .slice(0, limit)
            .map((review) => ({ text: review.text.trim(), author: review.author_name }));
    } catch (error) {
        console.warn('Google reviews: request failed', error);
        return [];
    }
};
