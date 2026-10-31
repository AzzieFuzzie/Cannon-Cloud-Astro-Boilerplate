import '@mux/mux-background-video/html';
import { Transitions } from '@scripts/classes/Transitions';
import { Scroll } from '@scripts/classes/Scroll';
import { $ready } from '@scripts/stores/ready';
import { showDecorInView } from '@scripts/utils/decor';
import { watchImageReveals } from '@scripts/utils/imageLoad';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// The smooth scroll runs on GSAP's ticker, so never let it skip ahead after a slow frame
gsap.ticker.lagSmoothing(0);

// A reload always starts at the top, behind the preloader, instead of where the visitor was.
// A link to an anchor (#section) still lands on that anchor.
// Set through ScrollTrigger: it puts back the setting it found on every refresh, so setting
// history.scrollRestoration directly would be undone the first time it refreshes.
ScrollTrigger.clearScrollMemory('manual');
const startAtTop = !window.location.hash;
if (startAtTop) window.scrollTo(0, 0);

// Reveal animations are held while this class is on <html>
$ready.subscribe((ready) => {
    document.documentElement.classList.toggle('is-loading', !ready);
});

// Initialize the Transitions class
const transitions = new Transitions();
transitions.init();

// Initialize the Scroll class
Scroll.init();

// The smooth scroll may have picked up a restored position before the line above ran
if (startAtTop) Scroll.scrollTo(0, { immediate: true, force: true });

// Image reveals wait for their image
watchImageReveals();

// Decorations on screen behind the preloader are already in place when it lifts
showDecorInView();

// Trigger positions shift once the web fonts are in
document.fonts.ready.then(() => ScrollTrigger.refresh());

if (import.meta.env.MODE === 'development') {
    // Dynamically import the grid-helper only in development mode
    import('@locomotivemtl/grid-helper')
        .then(({ default: GridHelper }) => {
            new GridHelper({
                columns: 'var(--grid-columns)',
                gutterWidth: 'var(--grid-gutter)',
                marginWidth: 'var(--grid-margin)'
            });
        })
        .catch((error) => {
            console.error('Failed to load the grid helper:', error);
        });
}
