import { ComponentElement } from '@locomotivemtl/component-manager';
import { Scroll } from '@scripts/classes/Scroll';
import { MOTION } from '@scripts/config';
import { whenReady } from '@scripts/stores/ready';
import { track } from '@scripts/utils/analytics';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export class Menu extends HTMLElement {
    static CLASS_ACTIVE = 'is-active';
    // Opens from the left, like the image reveals on the other pages (Reveal.css -clip-x)
    static CLIP_HIDDEN = 'inset(0% 100% 0% 0%)';
    static CLIP_VISIBLE = 'inset(0% 0% 0% 0%)';
    // Hovering has to rest on an item this long (ms) before its image is shown
    static HOVER_DELAY = 100;
    // Longest a new category waits for its image before opening anyway (ms)
    static IMAGE_WAIT = 500;
    // A category button within this share of the row's width from either edge is scrolled to the middle
    static TAB_EDGE_MARGIN = 0.2;

    private $nav: HTMLElement | null = null;
    private $tabsList: HTMLElement | null = null;
    private $tabs: HTMLElement[] = [];
    private $sections: HTMLElement[] = [];
    private $hovered: HTMLElement | null = null;

    // Per section: the image on screen, and the image last asked for (it may still be loading)
    private shownImages = new Map<HTMLElement, HTMLImageElement>();
    private wantedImages = new Map<HTMLElement, HTMLImageElement>();
    private swapId = 0;
    private categoryId = 0;

    private hoverTimeout: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private cancelReady: (() => void) | null = null;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        this.$nav = this.querySelector('[data-menu="nav"]');
        this.$tabsList = this.querySelector('[data-menu="tabs"]');
        this.$tabs = Array.from(this.querySelectorAll('[data-menu="tab"]'));
        this.$sections = Array.from(this.querySelectorAll('[data-menu="section"]'));

        if (!this.$sections.length) return;

        // Each section starts on its first image
        this.$sections.forEach(($section) => this.resetImages($section));

        this.bindEvents();

        // Once the page is revealed, fetch the open category's images so the first hover is instant,
        // and every other category's own image, so a category opens on its image, not an empty frame
        this.cancelReady = whenReady(() => {
            this.$sections.forEach(($section) => {
                if ($section.classList.contains(Menu.CLASS_ACTIVE)) {
                    this.preloadImages($section);
                    return;
                }

                const $first = $section.querySelector<HTMLImageElement>('[data-menu="image"]');
                if ($first) $first.loading = 'eager';
            });
        });
    }

    disconnectedCallback() {
        this.unbindEvents();
        this.cancelReady?.();
        this.cancelReady = null;

        if (this.hoverTimeout) window.clearTimeout(this.hoverTimeout);

        gsap.killTweensOf(this.$sections);
        gsap.killTweensOf(this.querySelectorAll('[data-menu="image"]'));

        this.shownImages.clear();
        this.wantedImages.clear();
    }

    // =============================================================================
    // Events
    // =============================================================================
    private bindEvents(): void {
        this.addEventListener('click', this.onClick);
        this.addEventListener('mouseover', this.onMouseOver);

        // The image stack sticks right below the category buttons, whatever their height
        if (this.$nav) {
            this.resizeObserver = new ResizeObserver(() => {
                this.style.setProperty('--menu-nav-height', `${this.$nav!.offsetHeight}px`);
            });
            this.resizeObserver.observe(this.$nav);
        }
    }

    private unbindEvents(): void {
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('mouseover', this.onMouseOver);
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
    }

    // =============================================================================
    // Callbacks
    // =============================================================================
    private onClick = (e: Event): void => {
        const $target = e.target as HTMLElement;

        const $tab = $target.closest<HTMLElement>('[data-menu="tab"]');
        if ($tab) {
            this.showCategory($tab.dataset.category ?? '');
            return;
        }

        // Tap (or click) an item to show its image
        const $item = $target.closest<HTMLElement>('[data-menu="item"]');
        if ($item) this.showItemImage($item);
    };

    private onMouseOver = (e: Event): void => {
        if (!window.matchMedia('(hover: hover)').matches) return;

        const $item = (e.target as HTMLElement).closest<HTMLElement>('[data-menu="item"]');
        if ($item === this.$hovered) return;

        this.$hovered = $item;

        if (this.hoverTimeout) window.clearTimeout(this.hoverTimeout);
        if (!$item) return;

        this.hoverTimeout = window.setTimeout(() => this.showItemImage($item), Menu.HOVER_DELAY);
    };

    // =============================================================================
    // Methods
    // =============================================================================
    private prefersReducedMotion(): boolean {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Swap the visible category
     */
    private showCategory(category: string): void {
        const $next = this.$sections.find(($section) => $section.dataset.category === category);
        const $prev = this.$sections.find(($section) =>
            $section.classList.contains(Menu.CLASS_ACTIVE)
        );

        if (!$next) return;

        // The open category clicked again: back to its own image, as when it was opened
        if ($next === $prev) {
            const $first = $next.querySelector<HTMLImageElement>('[data-menu="image"]');
            if ($first) this.showImage($next, $first);
            return;
        }

        // Which dishes people look at (analytics.ts)
        track('menu_category_view', { category: $next.getAttribute('aria-label') ?? category });

        this.$tabs.forEach(($tab) => {
            const isActive = $tab.dataset.category === category;
            $tab.classList.toggle(Menu.CLASS_ACTIVE, isActive);
            $tab.setAttribute('aria-current', isActive ? 'true' : 'false');
            if (isActive) this.centerTab($tab);
        });

        gsap.killTweensOf(this.$sections);

        const id = ++this.categoryId;
        const reduced = this.prefersReducedMotion();

        // The category's own image starts loading now, while the old category fades out, and the new
        // one waits for it (up to a moment), so it never opens on an empty frame
        const $first = $next.querySelector<HTMLImageElement>('[data-menu="image"]');
        if ($first) $first.loading = 'eager';
        const imageReady = $first
            ? Promise.race([
                  $first.decode().catch(() => {}),
                  new Promise((resolve) => window.setTimeout(resolve, Menu.IMAGE_WAIT))
              ])
            : Promise.resolve();

        const fadedOut = new Promise<void>((resolve) => {
            if (!$prev || reduced) return resolve();

            gsap.to($prev, {
                autoAlpha: 0,
                duration: 0.3,
                ease: 'sine.inOut',
                onComplete: resolve
            });
        });

        Promise.all([fadedOut, imageReady]).then(() => {
            // Another category was clicked in the meantime
            if (id !== this.categoryId || !this.isConnected) return;

            if ($prev) {
                $prev.classList.remove(Menu.CLASS_ACTIVE);
                gsap.set($prev, { clearProps: 'opacity,visibility' });
            }

            // A category always opens on its own image, not the last item image shown in it
            this.resetImages($next);
            $next.classList.add(Menu.CLASS_ACTIVE);
            this.resetScroll();
            this.preloadImages($next);

            // Eases in and settles up a few pixels: gentler than a quick straight fade
            gsap.fromTo(
                $next,
                { autoAlpha: 0, y: 12 },
                {
                    autoAlpha: 1,
                    y: 0,
                    duration: reduced ? 0 : 0.6,
                    ease: 'power2.out',
                    clearProps: 'opacity,visibility,transform'
                }
            );

            // The page height changed with the new category
            ScrollTrigger.refresh();
        });
    }

    /**
     * Show a section's first image (the category's), at once, with the rest hidden under it
     */
    private resetImages($section: HTMLElement): void {
        const $images = Array.from(
            $section.querySelectorAll<HTMLImageElement>('[data-menu="image"]')
        );
        const $first = $images[0];
        if (!$first) return;

        gsap.killTweensOf($images);
        $images.forEach(($image) => {
            gsap.set($image, {
                clipPath: $image === $first ? Menu.CLIP_VISIBLE : Menu.CLIP_HIDDEN,
                zIndex: $image === $first ? 2 : 0
            });
        });

        // Cancels a swap still waiting for its image to load
        this.swapId++;
        this.shownImages.set($section, $first);
        this.wantedImages.set($section, $first);
    }

    /**
     * Start loading every image of a category (they are lazy until their category is opened)
     */
    private preloadImages($section: HTMLElement): void {
        // Decoded too: the image frame never leaves the screen, so the page's nearby-image observer
        // (imageLoad.ts) doesn't see these again, and a wipe onto undecoded pixels would flash
        $section.querySelectorAll<HTMLImageElement>('[data-menu="image"]').forEach(($image) => {
            $image.loading = 'eager';
            $image.decode().catch(() => {});
        });
    }

    /**
     * A new category always starts from its first item
     */
    private resetScroll(): void {
        const top = this.getBoundingClientRect().top + window.scrollY;

        if (window.scrollY > top) {
            Scroll.scrollTo(top, { immediate: true });
        }
    }

    /**
     * Bring the active button to the middle of the row when the row scrolls sideways,
     * but only when it sits near or past an edge: a button already comfortably in view stays put,
     * so a tap never causes a small, pointless nudge
     */
    private centerTab($tab: HTMLElement): void {
        const $list = this.$tabsList;
        if (!$list || $list.scrollWidth <= $list.clientWidth) return;

        const width = $list.clientWidth;
        const margin = width * Menu.TAB_EDGE_MARGIN;
        const start = $tab.offsetLeft - $list.scrollLeft;
        const end = start + $tab.offsetWidth;

        if (start >= margin && end <= width - margin) return;

        $list.scrollTo({
            left: $tab.offsetLeft - (width - $tab.offsetWidth) / 2,
            behavior: this.prefersReducedMotion() ? 'auto' : 'smooth'
        });
    }

    private showItemImage($item: HTMLElement): void {
        const $section = $item.closest<HTMLElement>('[data-menu="section"]');
        if (!$section) return;

        const $images = $section.querySelectorAll<HTMLImageElement>('[data-menu="image"]');
        const $image = $images[parseInt($item.dataset.image ?? '0', 10)];

        if ($image) this.showImage($section, $image);
    }

    /**
     * Wipe an image in over the current one, once it has fully loaded
     */
    private async showImage($section: HTMLElement, $image: HTMLImageElement): Promise<void> {
        if ($image === this.wantedImages.get($section)) return;
        this.wantedImages.set($section, $image);

        const id = ++this.swapId;

        // Never reveal a half-loaded image
        $image.loading = 'eager';
        try {
            await $image.decode();
        } catch {
            // A broken image still swaps in, showing its alt text
        }

        // A newer request came in while this one was loading
        if (id !== this.swapId || !this.isConnected) return;

        const $shown = this.shownImages.get($section);
        if ($image === $shown) return;

        $section.querySelectorAll<HTMLElement>('[data-menu="image"]').forEach(($other) => {
            gsap.set($other, { zIndex: $other === $shown ? 1 : 0 });
        });

        this.shownImages.set($section, $image);

        gsap.killTweensOf($image);

        if (this.prefersReducedMotion()) {
            gsap.set($image, { zIndex: 2, clipPath: Menu.CLIP_VISIBLE });
            return;
        }

        gsap.fromTo(
            $image,
            { zIndex: 2, clipPath: Menu.CLIP_HIDDEN },
            {
                clipPath: Menu.CLIP_VISIBLE,
                duration: MOTION.duration.base,
                ease: MOTION.ease.out
            }
        );
    }
}

// Register the custom element
customElements.define('c-menu', ComponentElement(Menu, 'Menu'));
