import { atom } from 'nanostores';

// True once the page is revealed: preloader gone on first load, page transition finished after that.
// Reveal animations wait for it so nothing plays behind an overlay.
export const $ready = atom<boolean>(false);

/**
 * Run a callback as soon as the page is ready
 *
 * @returns a function that cancels the pending callback
 */
export const whenReady = (callback: () => void): (() => void) => {
    if ($ready.get()) {
        callback();
        return () => {};
    }

    const unsubscribe = $ready.listen((ready) => {
        if (!ready) return;
        unsubscribe();
        callback();
    });

    return unsubscribe;
};
