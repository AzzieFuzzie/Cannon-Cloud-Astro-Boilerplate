/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
    // Google Places: guest reviews on the home page (src/scripts/utils/googleReviews.ts)
    readonly GOOGLE_API_KEY?: string;
    readonly GOOGLE_PLACE_ID?: string;
}
