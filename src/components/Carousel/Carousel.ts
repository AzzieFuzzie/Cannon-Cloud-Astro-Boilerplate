import { ComponentElement } from '@locomotivemtl/component-manager';
import { MOTION } from '@scripts/config';
import gsap from 'gsap';

export class Carousel extends HTMLElement {
    static CLASS_ACTIVE = 'is-active';

    private $slides: HTMLElement[] = [];
    private $prev: HTMLElement | null = null;
    private $next: HTMLElement | null = null;
    private $counter: HTMLElement | null = null;
    private currentIndex = 0;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        this.$slides = Array.from(this.querySelectorAll('[data-carousel="slide"]'));
        this.$prev = this.querySelector('[data-carousel="prev"]');
        this.$next = this.querySelector('[data-carousel="next"]');
        this.$counter = this.querySelector('[data-carousel="counter"]');

        if (this.$slides.length < 2) return;

        this.bindEvents();
    }

    disconnectedCallback() {
        this.unbindEvents();
        gsap.killTweensOf(this.$slides);
    }

    // =============================================================================
    // Events
    // =============================================================================
    private bindEvents(): void {
        this.$prev?.addEventListener('click', this.onPrevClick);
        this.$next?.addEventListener('click', this.onNextClick);
    }

    private unbindEvents(): void {
        this.$prev?.removeEventListener('click', this.onPrevClick);
        this.$next?.removeEventListener('click', this.onNextClick);
    }

    // =============================================================================
    // Callbacks
    // =============================================================================
    private onPrevClick = (): void => this.change(-1);
    private onNextClick = (): void => this.change(1);

    // =============================================================================
    // Methods
    // =============================================================================
    /**
     * Crossfade to the previous (-1) or next (1) slide
     */
    private change(direction: number): void {
        // Let the running crossfade finish first
        if (gsap.isTweening(this.$slides)) return;

        const $current = this.$slides[this.currentIndex];

        this.currentIndex = gsap.utils.wrap(0, this.$slides.length, this.currentIndex + direction);

        const $incoming = this.$slides[this.currentIndex];
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : MOTION.duration.fast;

        // Explicit start values: the is-active class only sets the state before the first change
        gsap.fromTo(
            $current,
            { autoAlpha: 1 },
            { autoAlpha: 0, duration, ease: MOTION.ease.inOut }
        );
        gsap.fromTo(
            $incoming,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration, ease: MOTION.ease.inOut }
        );

        $current.classList.remove(Carousel.CLASS_ACTIVE);
        $current.setAttribute('aria-hidden', 'true');
        $incoming.classList.add(Carousel.CLASS_ACTIVE);
        $incoming.setAttribute('aria-hidden', 'false');

        if (this.$counter) {
            this.$counter.textContent = `${this.currentIndex + 1}/${this.$slides.length}`;
        }
    }
}

// Register the custom element
customElements.define('c-carousel', ComponentElement(Carousel, 'Carousel'));
