/*
 * Low Power Mode on iPhone caps requestAnimationFrame at 30fps, while scrolling and CSS
 * transitions keep running at full rate on the compositor. Anything GSAP or a script moves frame
 * by frame then visibly lags the page. There is no API for the mode, but the cap can be measured:
 * when frames come at under ~40fps, the site switches to animations the compositor runs.
 * Phones too slow to hold 60fps take the same lighter path.
 */

const CLASS_LOW_POWER = 'is-low-power';
// Frames timed, and the median frame time (ms) above which the page counts as low power
const SAMPLE_FRAMES = 24;
const LOW_POWER_FRAME_TIME = 24;
// A hidden tab gets no frames: stop waiting and assume full power
const TIMEOUT = 1500;

let lowPower = false;

const measure = (): Promise<boolean> =>
    new Promise((resolve) => {
        const times: number[] = [];
        let last = 0;

        const timeout = window.setTimeout(() => resolve(false), TIMEOUT);

        const onFrame = (time: number) => {
            if (last) times.push(time - last);
            last = time;

            if (times.length < SAMPLE_FRAMES) {
                requestAnimationFrame(onFrame);
                return;
            }

            window.clearTimeout(timeout);

            // The median, so a long frame while the page is loading doesn't count
            const sorted = [...times].sort((a, b) => a - b);
            resolve(sorted[Math.floor(sorted.length / 2)] > LOW_POWER_FRAME_TIME);
        };

        requestAnimationFrame(onFrame);
    });

const known = measure().then((isLow) => {
    lowPower = isLow;
    document.documentElement.classList.toggle(CLASS_LOW_POWER, isLow);
    return isLow;
});

/** Resolves once the frame rate has been measured (about 0.4s after the page starts) */
export const whenLowPowerKnown = (): Promise<boolean> => known;

/** Whether the page runs in low power; false until measured */
export const isLowPower = (): boolean => lowPower;
