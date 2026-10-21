// Every image under src/assets/images, keyed by its project path (e.g. "/src/assets/images/home/1.png")
const images = import.meta.glob<{ default: ImageMetadata }>(
    '/src/assets/images/**/*.{png,jpg,jpeg,webp,avif,gif}',
    { eager: true }
);

/**
 * Turn an image path stored in a data file into an image Astro can optimise.
 * Paths outside src/assets/images (remote URLs, files in /public) are returned unchanged.
 */
export const resolveImage = (path: string): ImageMetadata | string => {
    const key = path.startsWith('/') ? path : `/${path}`;

    return images[key]?.default ?? path;
};
