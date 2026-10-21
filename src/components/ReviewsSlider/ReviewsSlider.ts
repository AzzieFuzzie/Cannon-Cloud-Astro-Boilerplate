import { ComponentElement } from '@locomotivemtl/component-manager';
import { MOTION } from '@scripts/config';
import { $screenDebounce } from '@scripts/stores/screen';
import gsap from 'gsap';

export class ReviewsSlider extends HTMLElement {
    static CLASS_ACTIVE = 'is-active';
    static CLASS_PREV = 'is-prev';
    static CLASS_NEXT = 'is-next';

    private $track: HTMLElement | null = null;
    private $slides: HTMLElement[] = [];
    private $dots: HTMLElement[] = [];
    private currentIndex = 0;
    private autoplay: gsap.core.Tween | null = null;
    private observer: IntersectionObserver | null = null;
    private unsubscribeScreen: (() => void) | null = null;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        this.$track = this.querySelector('[data-reviews-slider="track"]');
        this.$slides = Array.from(this.querySelectorAll('[data-reviews-slider="slide"]'));
        this.$dots = Array.from(this.querySelectorAll('[data-reviews-slider="dot"]'));

        if (!this.$track || !this.$slides.length) return;

        this.bindEvents();
        this.goTo(0, false);

        if (this.canAutoplay()) this.startAutoplay();
    }

    disconnectedCallback() {
        this.unbindEvents();
        this.autoplay?.kill();
        this.autoplay = null;

        if (this.$track) gsap.killTweensOf(this.$track);
    }

    // =============================================================================
    // Events
    // =============================================================================
    private bindEvents(): void {
        this.$dots.forEach(($dot) => $dot.addEventListener('click', this.onDotClick));

        // Re-centre the active slide when the layout changes
        this.unsubscribeScreen = $screenDebounce.listen(() => this.goTo(this.currentIndex, false));

        // Only advance while the slider is on screen
        this.observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                this.autoplay?.resume();
            } else {
                this.autoplay?.pause();
            }
        });
        this.observer.observe(this);
    }

    private unbindEvents(): void {
        this.$dots.forEach(($dot) => $dot.removeEventListener('click', this.onDotClick));
        this.unsubscribeScreen?.();
        this.unsubscribeScreen = null;
        this.observer?.disconnect();
        this.observer = null;
    }

    // =============================================================================
    // Callbacks
    // =============================================================================
    private onDotClick = (e: Event): void => {
        const index = this.$dots.indexOf(e.currentTarget as HTMLElement);
        if (index === -1) return;

        this.goTo(index);

        // Give the reader a full interval on the slide they picked
        this.autoplay?.restart();
    };

    // =============================================================================
    // Methods
    // =============================================================================
    private canAutoplay(): boolean {
        if ((window as any).inEditorMode) return false;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

        return this.$slides.length > 1;
    }

    private startAutoplay(): void {
        const interval = parseFloat(this.dataset.interval ?? '') || 3.5;

        this.autoplay = gsap.to(
            {},
            {
                duration: interval,
                repeat: -1,
                onRepeat: () => this.goTo(this.currentIndex + 1)
            }
        );
    }

    /**
     * Centre a slide in the viewport
     */
    private goTo(index: number, animate: boolean = true): void {
        const total = this.$slides.length;
        this.currentIndex = ((index % total) + total) % total;

        const slideWidth = this.$slides[0].offsetWidth;
        const viewportWidth = this.$track!.parentElement!.offsetWidth;
        const x = viewportWidth / 2 - slideWidth / 2 - this.currentIndex * slideWidth;

        gsap.to(this.$track, {
            x,
            duration: animate ? MOTION.duration.base : 0,
            ease: MOTION.ease.out,
            overwrite: true
        });

        this.updateClasses();
    }

    private updateClasses(): void {
        const total = this.$slides.length;
        const prevIndex = (this.currentIndex - 1 + total) % total;
        const nextIndex = (this.currentIndex + 1) % total;

        this.$slides.forEach(($slide, i) => {
            $slide.classList.toggle(ReviewsSlider.CLASS_ACTIVE, i === this.currentIndex);
            $slide.classList.toggle(
                ReviewsSlider.CLASS_PREV,
                total > 2 && i === prevIndex && i !== this.currentIndex
            );
            $slide.classList.toggle(
                ReviewsSlider.CLASS_NEXT,
                total > 2 && i === nextIndex && i !== this.currentIndex
            );
        });

        this.$dots.forEach(($dot, i) => {
            const isActive = i === this.currentIndex;
            $dot.classList.toggle(ReviewsSlider.CLASS_ACTIVE, isActive);
            $dot.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
    }
}

// Register the custom element
customElements.define('c-reviews-slider', ComponentElement(ReviewsSlider, 'ReviewsSlider'));
