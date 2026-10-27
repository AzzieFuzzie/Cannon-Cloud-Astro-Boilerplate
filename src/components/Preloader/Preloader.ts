import { ComponentElement } from '@locomotivemtl/component-manager';
import { MOTION } from '@scripts/config';
import { $ready } from '@scripts/stores/ready';
import { getImages, waitForImage } from '@scripts/utils/imageLoad';
import gsap from 'gsap';

export class Preloader extends HTMLElement {
    // Never hold the page longer than this (ms)
    static TIMEOUT = 4000;
    // Counting from 0 to 100 takes at least this long (s), however fast the page loads
    static COUNT_DURATION = 1.2;
    // How long before the curtain is fully up the page's reveal animations are released (s).
    // Released earlier, they play (and mostly finish) behind the curtain. Released here, the curtain
    // is almost at rest, so the long frame of restyling the page doesn't show as a jump either.
    static READY_BEFORE_END = 0.2;

    private $number: HTMLElement | null = null;
    private total = 0;
    private loaded = 0;
    private progress = { value: 0 };
    private target = 0;
    private timeout: number | null = null;
    private isDone = false;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        this.$number = this.querySelector('[data-preloader="number"]');

        // Nothing to wait for in the CloudCannon Visual Editor
        if ((window as any).inEditorMode) {
            this.finish(true);
            return;
        }

        this.bindEvents();
        this.load();
    }

    disconnectedCallback() {
        this.unbindEvents();
        if (this.timeout) window.clearTimeout(this.timeout);
        gsap.killTweensOf([this, this.progress]);
        if (this.$number) gsap.killTweensOf(this.$number);
    }

    // =============================================================================
    // Events
    // =============================================================================
    private bindEvents(): void {
        // Block native scrolling behind the overlay
        this.addEventListener('wheel', this.onScrollAttempt, { passive: false });
        this.addEventListener('touchmove', this.onScrollAttempt, { passive: false });
    }

    private unbindEvents(): void {
        this.removeEventListener('wheel', this.onScrollAttempt);
        this.removeEventListener('touchmove', this.onScrollAttempt);
    }

    // =============================================================================
    // Callbacks
    // =============================================================================
    private onScrollAttempt = (e: Event): void => {
        e.preventDefault();
    };

    private onAssetLoaded = (): void => {
        this.loaded = Math.min(this.loaded + 1, this.total);
        this.countTo(this.loaded / this.total);
    };

    private onTimeout = (): void => {
        // Stop waiting: count the rest of the way and leave
        this.loaded = this.total;
        this.countTo(1);
    };

    // =============================================================================
    // Methods
    // =============================================================================
    /**
     * Wait for the web fonts and the images in the first screen
     */
    private load(): void {
        const $images = getImages(document, true);

        this.total = $images.length + 1;

        // Load every web font now, not only those the browser has started on: fonts.ready can
        // resolve before the italic is requested, and each late font re-lays out the hero text
        Promise.all([...document.fonts].map((font) => font.load())).then(
            this.onAssetLoaded,
            this.onAssetLoaded
        );

        $images.forEach(($image) => waitForImage($image).then(this.onAssetLoaded));

        this.timeout = window.setTimeout(this.onTimeout, Preloader.TIMEOUT);
    }

    /**
     * Count the number up to a share of the assets (0 to 1).
     * The time is in proportion to the distance, so the number never jumps
     * when several assets arrive at once.
     */
    private countTo(target: number): void {
        if (this.isDone || target === this.target) return;
        this.target = target;

        const distance = target - this.progress.value;

        gsap.to(this.progress, {
            value: target,
            duration: Math.max(MOTION.duration.fast, Preloader.COUNT_DURATION * distance),
            ease: 'power2.out',
            overwrite: true,
            onUpdate: () => this.render(),
            onComplete: () => {
                if (target >= 1) this.finish();
            }
        });
    }

    private render(): void {
        if (this.$number) {
            this.$number.textContent = `${Math.round(this.progress.value * 100)}%`;
        }
    }

    /**
     * Take the overlay away and release the page's reveal animations
     */
    private finish(immediate: boolean = false): void {
        if (this.isDone) return;
        this.isDone = true;

        if (this.timeout) window.clearTimeout(this.timeout);

        this.progress.value = 1;
        this.render();

        if (immediate) {
            $ready.set(true);
            this.remove();
            return;
        }

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            $ready.set(true);

            gsap.to(this, {
                autoAlpha: 0,
                duration: MOTION.duration.fast,
                ease: MOTION.ease.inOut,
                onComplete: () => this.remove()
            });
            return;
        }

        // The number slides up out of its mask, then the overlay lifts like a curtain
        gsap.timeline({ onComplete: () => this.remove() })
            .to(this.$number, {
                yPercent: -110,
                duration: MOTION.duration.base,
                ease: MOTION.ease.reveal
            })
            .to(
                this,
                {
                    yPercent: -100,
                    duration: MOTION.duration.slow,
                    ease: MOTION.ease.reveal
                },
                `-=${MOTION.duration.fast}`
            )
            // The page's reveals start as the curtain clears the screen
            .call(() => $ready.set(true), [], `-=${Preloader.READY_BEFORE_END}`);
    }
}

// Register the custom element
customElements.define('c-preloader', ComponentElement(Preloader, 'Preloader'));
