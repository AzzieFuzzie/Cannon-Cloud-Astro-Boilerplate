import '@mux/mux-background-video/html';
import { Transitions } from '@scripts/classes/Transitions';
import { Scroll } from '@scripts/classes/Scroll';
import { $ready } from '@scripts/stores/ready';
import { watchImageReveals } from '@scripts/utils/imageLoad';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// The smooth scroll runs on GSAP's ticker, so never let it skip ahead after a slow frame
gsap.ticker.lagSmoothing(0);

// Reveal animations are held while this class is on <html>
$ready.subscribe((ready) => {
    document.documentElement.classList.toggle('is-loading', !ready);
});

// Initialize the Transitions class
const transitions = new Transitions();
transitions.init();

// Initialize the Scroll class
Scroll.init();

// Image reveals wait for their image
watchImageReveals();

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
