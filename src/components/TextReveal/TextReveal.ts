import { ComponentElement } from '@locomotivemtl/component-manager';
import { MOTION } from '@scripts/config';
import { $mediaStatus } from '@scripts/stores/deviceStatus';
import { whenReady } from '@scripts/stores/ready';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

type TextRevealType = 'lines' | 'chars' | 'fill';

export class TextReveal extends HTMLElement {
    private ctx: gsap.Context | null = null;
    private cancelReady: (() => void) | null = null;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        // Skip in the CloudCannon Visual Editor so editable text is never split or hidden
        if ((window as any).inEditorMode) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const type = (this.dataset.type ?? 'lines') as TextRevealType;
        const $target = this.firstElementChild ?? this;

        this.ctx = gsap.context(() => {
            if (type === 'chars') {
                this.revealChars($target);
            } else if (type === 'fill') {
                this.fill($target);
            } else {
                this.revealLines($target);
            }
        }, this);
    }

    disconnectedCallback() {
        this.cancelReady?.();
        this.cancelReady = null;

        // Kills every tween, ScrollTrigger and SplitText created in the context
        this.ctx?.revert();
        this.ctx = null;
    }

    // =============================================================================
    // Methods
    // =============================================================================
    private get delay(): number {
        return parseFloat(this.dataset.delay ?? '0') || 0;
    }

    /**
     * Run a callback once the element has scrolled into view and the page is revealed
     */
    private onEnter(callback: () => void, start: string = MOTION.trigger.start): void {
        ScrollTrigger.create({
            trigger: this,
            ...MOTION.trigger,
            start,
            onEnter: () => {
                this.cancelReady = whenReady(callback);
            }
        });
    }

    /**
     * Masked lines rise into place, as on des.obys.agency: 1.3s power4.out, 0.1s apart, no fade.
     * Lines start 120% down so letter tails (g, y) are fully hidden before they move.
     */
    private revealLines($target: Element): void {
        let tween: gsap.core.Tween | null = null;
        let hasEntered = false;

        SplitText.create($target, {
            type: 'lines',
            mask: 'lines',
            // Re-split when the fonts load or the width changes; the returned tween keeps its progress
            autoSplit: true,
            onSplit: (self) => {
                tween = gsap.from(self.lines, {
                    yPercent: 120,
                    duration: 1.1,
                    stagger: 0.1,
                    ease: 'power4.out',
                    delay: this.delay,
                    paused: !hasEntered
                });

                return tween;
            }
        });

        // Starts as soon as the paragraph enters the screen
        this.onEnter(() => {
            hasEntered = true;
            tween?.play();
        }, 'top bottom');
    }

    /**
     * Characters turn and slide in, all together (Title.js on pigalle.co.za: 1.8s expo.out)
     */
    private revealChars($target: Element): void {
        const split = SplitText.create($target, { type: 'words, chars' });

        gsap.set(split.words, { perspective: 800 });

        const tween = gsap.from(split.chars, {
            rotateY: 90,
            xPercent: -80,
            autoAlpha: 0,
            duration: 1.8,
            ease: MOTION.ease.out,
            delay: this.delay,
            paused: true
        });

        this.onEnter(() => tween.play());
    }

    /**
     * Characters fade up to full strength as the text scrolls through the viewport.
     * Tied straight to the scroll (no scrub smoothing: the smooth scroll already eases it, and a
     * second ease made the text trail behind) and linear, so each character keeps pace with the
     * page. It starts as the text comes up from the bottom and finishes once all of it sits above
     * the middle of the screen: about twice the old distance, so a quick flick still shows it.
     */
    private fill($target: Element): void {
        // Phones and touch screens: tied to the scroll, every character is restyled on each scroll
        // frame, which stutters there. Instead the words fade up once, on their own clock, as the
        // text comes into view.
        if ($mediaStatus.get().isTouchOrSmall) {
            const split = SplitText.create($target, { type: 'words' });
            const tween = gsap.fromTo(
                split.words,
                { opacity: 0.1 },
                {
                    opacity: 1,
                    duration: 0.6,
                    ease: 'sine.out',
                    // About a second and a half from the first word to the last, however long
                    stagger: { amount: 1.5 },
                    paused: true
                }
            );

            this.onEnter(() => tween.play(), 'top 85%');
            return;
        }

        const split = SplitText.create($target, { type: 'words, chars' });

        gsap.fromTo(
            split.chars,
            { opacity: 0.1 },
            {
                opacity: 1,
                ease: 'none',
                stagger: MOTION.stagger,
                scrollTrigger: {
                    trigger: this,
                    start: 'top 85%',
                    end: 'bottom 55%',
                    scrub: true
                }
            }
        );
    }
}

// Register the custom element
customElements.define('c-text-reveal', ComponentElement(TextReveal, 'TextReveal'));
