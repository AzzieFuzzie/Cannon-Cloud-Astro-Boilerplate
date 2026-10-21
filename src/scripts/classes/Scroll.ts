import { MOTION } from '@scripts/config';
import { $scroll } from '@scripts/stores/scroll';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import LocomotiveScroll, {
    type lenisTargetScrollTo,
    type ILenisScrollToOptions
} from 'locomotive-scroll';

gsap.registerPlugin(ScrollTrigger);

export class Scroll {
    static locomotiveScroll: LocomotiveScroll;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    static init() {
        this.locomotiveScroll = new LocomotiveScroll({
            triggerRootMargin: MOTION.triggerRootMargin,
            // Run the smooth scroll on GSAP's ticker so both update in the same frame
            initCustomTicker: (render) => {
                gsap.ticker.add(render);
            },
            destroyCustomTicker: (render) => {
                gsap.ticker.remove(render);
            },
            scrollCallback({ scroll, limit, velocity, direction, progress }) {
                $scroll.set({
                    scroll,
                    limit,
                    velocity,
                    direction,
                    progress
                });

                // Keep GSAP ScrollTrigger in sync with the smooth scroll position
                ScrollTrigger.update();
            }
        });
    }

    static destroy() {
        this.locomotiveScroll?.destroy();
    }

    // =============================================================================
    // Methods
    // =============================================================================
    static start() {
        this.locomotiveScroll?.start();
    }

    static stop() {
        this.locomotiveScroll?.stop();
    }

    static addScrollElements(container: HTMLElement) {
        this.locomotiveScroll?.addScrollElements(container);
    }

    static removeScrollElements(container: HTMLElement) {
        this.locomotiveScroll?.removeScrollElements(container);
    }

    static scrollTo(target: lenisTargetScrollTo, options?: ILenisScrollToOptions) {
        this.locomotiveScroll?.scrollTo(target, options);
    }
}
