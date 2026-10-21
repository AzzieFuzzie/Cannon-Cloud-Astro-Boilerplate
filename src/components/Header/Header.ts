import { ComponentElement } from '@locomotivemtl/component-manager';
import { Scroll } from '@scripts/classes/Scroll';

export class Header extends HTMLElement {
    static CLASS_OPEN = 'is-open';
    // Same as the md breakpoint in tailwind.css: from here the links are inline
    static DESKTOP_QUERY = '(min-width: 1000px)';

    private $toggle: HTMLButtonElement | null = null;
    private $links: HTMLAnchorElement[] = [];
    private desktop: MediaQueryList | null = null;
    private isOpen = false;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        this.$toggle = this.querySelector('[data-header="toggle"]');
        this.$links = Array.from(this.querySelectorAll('[data-header="link"]'));
        this.desktop = window.matchMedia(Header.DESKTOP_QUERY);

        this.bindEvents();
    }

    disconnectedCallback() {
        this.unbindEvents();
        if (this.isOpen) this.close();
    }

    // =============================================================================
    // Events
    // =============================================================================
    private bindEvents(): void {
        this.$toggle?.addEventListener('click', this.onToggleClick);
        this.$links.forEach(($link) => $link.addEventListener('click', this.onLinkClick));
        document.addEventListener('keydown', this.onKeydown);
        this.desktop?.addEventListener('change', this.onBreakpointChange);

        // The header is outside the Swup container, so it hears about page changes from Swup's DOM events
        document.addEventListener('swup:visit:start', this.onVisitStart);
        document.addEventListener('swup:page:view', this.onPageView);
    }

    private unbindEvents(): void {
        this.$toggle?.removeEventListener('click', this.onToggleClick);
        this.$links.forEach(($link) => $link.removeEventListener('click', this.onLinkClick));
        document.removeEventListener('keydown', this.onKeydown);
        this.desktop?.removeEventListener('change', this.onBreakpointChange);
        document.removeEventListener('swup:visit:start', this.onVisitStart);
        document.removeEventListener('swup:page:view', this.onPageView);
    }

    // =============================================================================
    // Callbacks
    // =============================================================================
    private onToggleClick = (): void => {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    };

    private onLinkClick = (): void => {
        if (this.isOpen) this.close();
    };

    private onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape' || !this.isOpen) return;

        this.close();
        this.$toggle?.focus();
    };

    private onBreakpointChange = (e: MediaQueryListEvent): void => {
        if (e.matches && this.isOpen) this.close();
    };

    private onVisitStart = (): void => {
        if (this.isOpen) this.close();
    };

    private onPageView = (): void => {
        this.updateCurrentLink();
    };

    // =============================================================================
    // Methods
    // =============================================================================
    private open(): void {
        this.setOpen(true);
    }

    private close(): void {
        this.setOpen(false);
    }

    private setOpen(isOpen: boolean): void {
        this.isOpen = isOpen;

        this.classList.toggle(Header.CLASS_OPEN, isOpen);
        this.$toggle?.setAttribute('aria-expanded', String(isOpen));
        this.$toggle?.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');

        // Keep keyboard focus inside the menu while it covers the page
        document.getElementById('swup')?.toggleAttribute('inert', isOpen);

        if (isOpen) {
            Scroll.stop();
        } else {
            Scroll.start();
        }
    }

    /**
     * Mark the link of the page on screen. The header is not swapped on a page change,
     * so the marker set in Header.astro has to follow along.
     */
    private updateCurrentLink(): void {
        const path = window.location.pathname.replace(/\/$/, '') || '/';

        this.$links.forEach(($link) => {
            const linkPath = new URL($link.href).pathname.replace(/\/$/, '') || '/';

            if (linkPath === path) {
                $link.setAttribute('aria-current', 'page');
            } else {
                $link.removeAttribute('aria-current');
            }
        });
    }
}

// Register the custom element
customElements.define('c-header', ComponentElement(Header, 'Header'));
