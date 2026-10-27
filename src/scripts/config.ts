const config: Config = Object.freeze({
    // Utopia
    utopia: {
        minViewport: 320,
        maxViewport: 1440,
        rootSize: 16
    }
});

const CUSTOM_EVENTS: {
    RESIZE_END: string;
} = Object.freeze({
    RESIZE_END: 'loco.resizeEnd'
});

// Shared motion values. Durations and CSS eases mirror the
// --transition-duration-* / --ease* tokens in src/styles/tailwind.css
const MOTION = Object.freeze({
    duration: {
        fast: 0.4,
        base: 0.8,
        slow: 1
    },
    ease: {
        out: 'expo.out',
        inOut: 'power2.inOut',
        reveal: 'power3.inOut',
        none: 'none'
    },
    cssEase: {
        out: 'cubic-bezier(0.19, 1, 0.22, 1)',
        inOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
        reveal: 'cubic-bezier(0.76, 0, 0.24, 1)'
    },
    stagger: 0.08,
    // Same line as the Locomotive Scroll triggerRootMargin in Scroll.ts
    trigger: {
        start: 'top 90%',
        once: true
    },
    triggerRootMargin: '0px 0px -10% 0px'
});

export { config, CUSTOM_EVENTS, MOTION };
