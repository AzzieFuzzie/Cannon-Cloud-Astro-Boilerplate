// Set on a decoration's reveal to skip its grow-in (see Decor.css)
const CLASS_SHOWN = 'is-shown';

/**
 * Show the decorations already on screen as they are: growing in only makes sense for one that
 * scrolls into view. Run it whenever a page appears, while the preloader or transition covers it.
 * The outer element is measured: the inner one is still scaled down at this point.
 */
export const showDecorInView = (root: ParentNode = document): void => {
    root.querySelectorAll<HTMLElement>('.c-decor').forEach(($decor) => {
        const rect = $decor.getBoundingClientRect();
        if (rect.top >= window.innerHeight || rect.bottom <= 0) return;

        $decor.querySelector('.c-decor_inner')?.classList.add(CLASS_SHOWN);
    });
};
