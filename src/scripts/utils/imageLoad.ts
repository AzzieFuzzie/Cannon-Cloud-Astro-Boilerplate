// Image reveals (<Reveal type="clip-x | clip-y">) only play once their image has loaded and decoded
const REVEAL_SELECTOR = '.c-reveal.-await-image';
const CLASS_LOADED = 'is-loaded';

/**
 * Mark a reveal as loaded once its image is ready to paint.
 * A downloaded image can still be undecoded, and decoding it on the frame it appears makes the
 * reveal stutter. decode() rejects for a broken image, which still gets marked.
 */
const markWhenDecoded = ($reveal: HTMLElement, $image: HTMLImageElement): void => {
    const mark = (): void => $reveal.classList.add(CLASS_LOADED);

    $image.decode().then(mark, mark);
};

type WaitForImagesOptions = {
    // Only wait for images that start within the first screen
    firstScreenOnly?: boolean;
    // Give up waiting after this long (ms)
    timeout?: number;
};

/**
 * Mark the reveals whose image is already there, and start loading the others.
 * Run it whenever new page content is added.
 */
export const markLoadedReveals = (root: ParentNode = document): void => {
    root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(($reveal) => {
        const $image = $reveal.querySelector('img');

        if (!$image) {
            $reveal.classList.add(CLASS_LOADED);
            return;
        }

        if ($image.complete) {
            markWhenDecoded($reveal, $image);
            return;
        }

        // The reveal keeps the image clipped away until it has loaded, and a browser may never
        // lazy-load an image it considers hidden, so fetch it straight away
        $image.loading = 'eager';
    });
};

/**
 * Start loading lazy images about a screen before they scroll into view, and decode them.
 * Chrome looks well ahead by itself; Safari waits until an image is nearly on screen,
 * so it would appear blank for a moment. Run it whenever new page content is added.
 */
let nearbyObserver: IntersectionObserver | null = null;
let marqueeObserver: IntersectionObserver | null = null;

export const preloadNearbyImages = (root: ParentNode = document): void => {
    // Every time an image comes within a screen, not only the first: iOS Safari throws away the
    // decoded pixels of off-screen images, and one that arrives undecoded flashes blank (or, with
    // decoding="sync", stalls a frame) while it is decoded again
    nearbyObserver?.disconnect();
    nearbyObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(({ isIntersecting, target }) => {
                if (!isIntersecting) return;

                const $image = target as HTMLImageElement;
                if ($image.loading === 'lazy') $image.loading = 'eager';
                $image.decode().catch(() => {});
            });
        },
        { rootMargin: '100% 0px' }
    );

    // Marquee photos have their own observer below
    root.querySelectorAll<HTMLImageElement>('img:not(.c-marquee_image)').forEach(($image) => {
        nearbyObserver?.observe($image);
    });

    // A marquee's images slide in from the side, where the page clips them, so they never count
    // as near; decode them all whenever the marquee comes within a screen. Every time, not once:
    // iOS Safari throws away the decoded pixels of off-screen images, and a strip that arrives
    // undecoded on a quick scroll flickers while it is decoded again
    marqueeObserver?.disconnect();
    marqueeObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(({ isIntersecting, target }) => {
                if (!isIntersecting) return;

                target.querySelectorAll('img').forEach(($image) => {
                    $image.decode().catch(() => {});
                });
            });
        },
        { rootMargin: '100% 0px' }
    );

    root.querySelectorAll('.c-marquee').forEach(($marquee) => {
        marqueeObserver?.observe($marquee);
    });
};

/**
 * Mark a reveal as loaded when its image finishes (or fails).
 * `load` does not bubble, so one capture listener on the document covers every page.
 */
export const watchImageReveals = (): void => {
    const onImageSettled = (e: Event): void => {
        if (!(e.target instanceof HTMLImageElement)) return;

        const $reveal = e.target.closest<HTMLElement>(REVEAL_SELECTOR);
        if (!$reveal) return;

        // With several images inside (e.g. a carousel), the first one is the one on show
        const $first = $reveal.querySelector('img');

        if ($first?.complete) markWhenDecoded($reveal, $first);
    };

    document.addEventListener('load', onImageSettled, true);
    document.addEventListener('error', onImageSettled, true);

    markLoadedReveals();
    preloadNearbyImages();
};

/**
 * The images to wait for. Downloaded ones are included: a cached image can still be undecoded.
 * Images that are not rendered (e.g. inside display: none) are skipped, since a lazy one never loads.
 */
export const getImages = (
    root: ParentNode = document,
    firstScreenOnly: boolean = false
): HTMLImageElement[] => {
    return Array.from(root.querySelectorAll('img')).filter(($image) => {
        const rect = $image.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) return false;
        if (!firstScreenOnly) return true;

        return rect.top < window.innerHeight;
    });
};

/**
 * Resolves once an image has loaded and decoded, or failed
 */
export const waitForImage = ($image: HTMLImageElement): Promise<void> => {
    return new Promise((resolve) => {
        const done = (): void => resolve();

        // decode() rejects for a broken image, which must not hold anything up
        const decode = (): void => {
            $image.decode().then(done, done);
        };

        if ($image.complete) {
            decode();
            return;
        }

        const onSettled = (e: Event): void => {
            $image.removeEventListener('load', onSettled);
            $image.removeEventListener('error', onSettled);

            if (e.type === 'load') {
                decode();
            } else {
                done();
            }
        };

        $image.addEventListener('load', onSettled);
        $image.addEventListener('error', onSettled);
    });
};

/**
 * Resolves once the images have loaded and decoded, or when the timeout runs out
 */
export const waitForImages = (
    root: ParentNode = document,
    { firstScreenOnly = false, timeout = 1000 }: WaitForImagesOptions = {}
): Promise<void> => {
    const $images = getImages(root, firstScreenOnly);
    if (!$images.length) return Promise.resolve();

    return new Promise((resolve) => {
        const timer = window.setTimeout(resolve, timeout);

        Promise.all($images.map(waitForImage)).then(() => {
            window.clearTimeout(timer);
            resolve();
        });
    });
};

/**
 * Resolves once the videos in the first screen are showing moving picture, or when the timeout
 * runs out. Covers plain <video autoplay> elements and <mux-background-video> (its video lives
 * in a shadow root). A player marked `data-await-reveal` counts once it has `data-revealed`,
 * which it sets (with a `revealed` event) when it becomes visible; see HeroVideo.ts.
 */
export const waitForVideos = (
    root: ParentNode = document,
    { timeout = 1500 }: { timeout?: number } = {}
): Promise<void> => {
    const waits: Promise<void>[] = [];

    root.querySelectorAll<HTMLElement>('video[autoplay], mux-background-video').forEach(($el) => {
        if ($el.getBoundingClientRect().top >= window.innerHeight) return;

        if ($el.hasAttribute('data-await-reveal')) {
            if ($el.dataset.revealed === 'true') return;

            waits.push(
                new Promise((done) => {
                    $el.addEventListener('revealed', () => done(), { once: true });
                })
            );
            return;
        }

        const $video = $el instanceof HTMLVideoElement ? $el : (($el as any).video ?? null);
        if (!($video instanceof HTMLVideoElement)) return;

        const isPlaying = !$video.paused && $video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
        if (isPlaying) return;

        waits.push(
            new Promise((done) => {
                $video.addEventListener('playing', () => done(), { once: true });
                $video.addEventListener('error', () => done(), { once: true });
            })
        );
    });

    if (!waits.length) return Promise.resolve();

    return new Promise((resolve) => {
        const timer = window.setTimeout(resolve, timeout);

        Promise.all(waits).then(() => {
            window.clearTimeout(timer);
            resolve();
        });
    });
};
