import { ComponentElement } from '@locomotivemtl/component-manager';
import { Scroll } from '@scripts/classes/Scroll';
import { MOTION } from '@scripts/config';
import { whenReady } from '@scripts/stores/ready';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export class Menu extends HTMLElement {
    static CLASS_ACTIVE = 'is-active';
    // Opens from the left, like the image reveals on the other pages (Reveal.css -clip-x)
    static CLIP_HIDDEN = 'inset(0% 100% 0% 0%)';
    static CLIP_VISIBLE = 'inset(0% 0% 0% 0%)';
    // Hovering has to rest on an item this long (ms) before its image is shown
    static HOVER_DELAY = 100;
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
        this.$sections.forEach(($section) => {
            const $first = $section.querySelector<HTMLImageElement>('[data-menu="image"]');
            if (!$first) return;

            gsap.set($first, { clipPath: Menu.CLIP_VISIBLE, zIndex: 2 });
            this.shownImages.set($section, $first);
            this.wantedImages.set($section, $first);
        });

        this.bindEvents();

        // Once the page is revealed, fetch the open category's images so the first hover is instant
        this.cancelReady = whenReady(() => {
            const $active = this.$sections.find(($section) =>
                $section.classList.contains(Menu.CLASS_ACTIVE)
            );
            if ($active) this.preloadImages($active);
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

        if (!$next || $next === $prev) return;

        this.$tabs.forEach(($tab) => {
            const isActive = $tab.dataset.category === category;
            $tab.classList.toggle(Menu.CLASS_ACTIVE, isActive);
            $tab.setAttribute('aria-current', isActive ? 'true' : 'false');
            if (isActive) this.centerTab($tab);
        });

        gsap.killTweensOf(this.$sections);

        const swap = () => {
            if ($prev) {
                $prev.classList.remove(Menu.CLASS_ACTIVE);
                gsap.set($prev, { clearProps: 'opacity,visibility' });
            }

            $next.classList.add(Menu.CLASS_ACTIVE);
            this.resetScroll();
            this.preloadImages($next);

            gsap.fromTo(
                $next,
                { autoAlpha: 0 },
                {
                    autoAlpha: 1,
                    duration: this.prefersReducedMotion() ? 0 : MOTION.duration.fast,
                    ease: MOTION.ease.inOut,
                    clearProps: 'opacity,visibility'
                }
            );

            // The page height changed with the new category
            ScrollTrigger.refresh();
        };

        if ($prev && !this.prefersReducedMotion()) {
            gsap.to($prev, {
                autoAlpha: 0,
                duration: MOTION.duration.fast / 2,
                ease: MOTION.ease.inOut,
                onComplete: swap
            });
        } else {
            swap();
        }
    }

    /**
     * Start loading every image of a category (they are lazy until their category is opened)
     */
    private preloadImages($section: HTMLElement): void {
        $section.querySelectorAll<HTMLImageElement>('[data-menu="image"]').forEach(($image) => {
            $image.loading = 'eager';
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
