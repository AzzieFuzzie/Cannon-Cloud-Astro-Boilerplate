import { ComponentElement } from '@locomotivemtl/component-manager';
import { Scroll } from '@scripts/classes/Scroll';
import { track } from '@scripts/utils/analytics';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Business Lunch (BusinessLunch.astro): pick a number of courses to see which dishes it includes,
 * and fold the terms away.
 * Picking a course: the summary ("Starter, Main & Dessert") rises out of its mask while the dishes
 * fade out, then, with nothing on screen, the text and dishes are swapped, and the new summary
 * rises in (the line reveal of TextReveal.ts) as the dishes fade back in one after another.
 * Opening and closing the category itself is Menu.ts's job.
 */
export class BusinessLunch extends HTMLElement {
    static CLASS_ACTIVE = 'is-active';
    static CLASS_OPEN = 'is-open';

    // Course change timings (seconds): out together, swap, then in
    static OUT_DURATION = 0.3;
    static TEXT_IN_DURATION = 1.1;
    static DISHES_IN_DELAY = 0.1;
    static DISHES_IN_DURATION = 0.6;
    // The dishes' fade-ins are spread over this long, however many there are
    static DISHES_IN_SPREAD = 0.4;

    private $courses: HTMLButtonElement[] = [];
    private $groups: HTMLElement[] = [];
    private $summary: HTMLElement | null = null;
    private $terms: HTMLElement | null = null;
    private $termsToggle: HTMLButtonElement | null = null;
    private $termsPanel: HTMLElement | null = null;
    private $cross: HTMLElement | null = null;

    private activeIndex = 0;
    private timeline: gsap.core.Timeline | null = null;
    private split: SplitText | null = null;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        this.$courses = Array.from(this.querySelectorAll('[data-lunch="course"]'));
        this.$groups = Array.from(this.querySelectorAll('[data-lunch="group"]'));
        this.$summary = this.querySelector('[data-lunch="summary"]');
        this.$terms = this.querySelector('[data-lunch="terms"]');
        this.$termsToggle = this.querySelector('[data-lunch="terms-toggle"]');
        this.$termsPanel = this.querySelector('[data-lunch="terms-panel"]');
        this.$cross = this.querySelector('[data-lunch="cross"]');

        this.activeIndex = parseInt(this.dataset.defaultCourse ?? '0', 10) || 0;

        this.bindEvents();
    }

    disconnectedCallback() {
        this.unbindEvents();
        this.stopCourseChange();
    }

    // =============================================================================
    // Events
    // =============================================================================
    private bindEvents(): void {
        this.addEventListener('click', this.onClick);
        this.addEventListener('keydown', this.onKeyDown);
    }

    private unbindEvents(): void {
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('keydown', this.onKeyDown);
    }

    // =============================================================================
    // Callbacks
    // =============================================================================
    private onClick = (e: Event): void => {
        const $target = e.target as HTMLElement;

        const $course = $target.closest<HTMLButtonElement>('[data-lunch="course"]');
        if ($course) {
            this.selectCourse(parseInt($course.dataset.index ?? '0', 10));
            return;
        }

        if ($target.closest('[data-lunch="terms-toggle"]')) {
            this.toggleTerms();
            return;
        }

        // "Terms & conditions" under the intro: opens them and scrolls down to them
        if ($target.closest('[data-lunch="terms-link"]')) {
            this.toggleTerms(true);
            if (this.$terms) {
                const offset = parseFloat(
                    getComputedStyle(this.closest('c-menu') ?? this).getPropertyValue(
                        '--menu-nav-height'
                    ) || '0'
                );
                Scroll.scrollTo(this.$terms, {
                    offset: -offset - 16,
                    immediate: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                });
            }
        }
    };

    // Arrow keys move between the courses, as in any radio group
    private onKeyDown = (e: KeyboardEvent): void => {
        if (!(e.target as HTMLElement).closest('[data-lunch="course"]')) return;

        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;

        e.preventDefault();
        const count = this.$courses.length;
        const next = (this.activeIndex + step + count) % count;
        this.selectCourse(next);
        this.$courses[next]?.focus();
    };

    // =============================================================================
    // Methods
    // =============================================================================

    /**
     * Show the dishes the chosen number of courses includes
     */
    private selectCourse(index: number): void {
        const $course = this.$courses[index];
        if (!$course || index === this.activeIndex) return;

        this.activeIndex = index;

        this.$courses.forEach(($c, i) => {
            const isActive = i === index;
            $c.classList.toggle(BusinessLunch.CLASS_ACTIVE, isActive);
            $c.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });

        track('menu_lunch_course', {
            course: $course.querySelector('.heading-h3')?.textContent?.trim()
        });

        const text = $course.dataset.summary ?? '';
        const wanted = new Set(($course.dataset.groups ?? '').split(' ').filter(Boolean));

        // Swap the summary and show only the groups this course includes
        const swap = () => {
            if (this.$summary) this.$summary.textContent = text;
            this.$groups.forEach(($group) => {
                $group.hidden = !wanted.has($group.dataset.group ?? '');
            });
            // The page height changed
            ScrollTrigger.refresh();
        };

        // A change still playing is cut short: its text and dishes go back to rest first
        this.stopCourseChange();

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced || (window as any).inEditorMode || !this.$summary) {
            swap();
            return;
        }

        const $summary = this.$summary;
        const $shownDishes = this.getShownDishes();

        // Masked line, so the text rises out of view rather than fading
        this.split = SplitText.create($summary, { type: 'lines', mask: 'lines' });

        // In: the new text rises, the dishes fade in just behind it, one after another.
        // Its own timeline, built after the swap, because the new lines only exist then.
        const playIn = () => {
            this.split?.revert();
            swap();

            const split = SplitText.create($summary, { type: 'lines', mask: 'lines' });
            this.split = split;
            const $newDishes = this.getShownDishes();

            this.timeline = gsap
                .timeline({ onComplete: () => this.stopCourseChange() })
                .fromTo(
                    split.lines,
                    { yPercent: 120 },
                    {
                        yPercent: 0,
                        duration: BusinessLunch.TEXT_IN_DURATION,
                        ease: 'power4.out',
                        stagger: 0.1
                    },
                    0
                )
                .fromTo(
                    $newDishes,
                    { autoAlpha: 0 },
                    {
                        autoAlpha: 1,
                        duration: BusinessLunch.DISHES_IN_DURATION,
                        ease: 'sine.out',
                        stagger: { amount: BusinessLunch.DISHES_IN_SPREAD }
                    },
                    BusinessLunch.DISHES_IN_DELAY
                );
        };

        // Out, together; the swap happens once nothing is on screen
        this.timeline = gsap
            .timeline({ onComplete: playIn })
            .to(
                this.split.lines,
                { yPercent: -120, duration: BusinessLunch.OUT_DURATION, ease: 'power3.in' },
                0
            )
            .to(
                $shownDishes,
                { autoAlpha: 0, duration: BusinessLunch.OUT_DURATION, ease: 'sine.in' },
                0
            );
    }

    /**
     * What fades on a course change: the heading and dishes of each group on show
     */
    private getShownDishes(): HTMLElement[] {
        return this.$groups
            .filter(($group) => !$group.hidden)
            .flatMap(($group) =>
                Array.from(
                    $group.querySelectorAll<HTMLElement>('[data-lunch="group-head"], .c-lunch_item')
                )
            );
    }

    /**
     * End a course change at once and leave everything at rest: the summary unsplit, dishes visible
     */
    private stopCourseChange(): void {
        this.timeline?.kill();
        this.timeline = null;
        this.split?.revert();
        this.split = null;

        const $all = this.$groups.flatMap(($group) =>
            Array.from(
                $group.querySelectorAll<HTMLElement>('[data-lunch="group-head"], .c-lunch_item')
            )
        );
        gsap.killTweensOf($all);
        gsap.set($all, { clearProps: 'opacity,visibility' });
    }

    /**
     * Fold the terms away or open them again
     */
    private toggleTerms(force?: boolean): void {
        const $panel = this.$termsPanel;
        if (!$panel || !this.$termsToggle) return;

        const isOpen = this.$termsToggle.getAttribute('aria-expanded') === 'true';
        const open = force ?? !isOpen;
        if (open === isOpen) return;

        this.$termsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        this.$cross?.classList.toggle(BusinessLunch.CLASS_OPEN, open);

        $panel.hidden = !open;
        ScrollTrigger.refresh();
    }
}

// Register the custom element
customElements.define('c-business-lunch', ComponentElement(BusinessLunch, 'BusinessLunch'));
