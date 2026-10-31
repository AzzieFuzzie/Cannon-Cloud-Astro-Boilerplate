import { ComponentElement } from '@locomotivemtl/component-manager';
import { $mediaStatus } from '@scripts/stores/deviceStatus';

export class Accordion extends HTMLElement {
    static CLASS_ACTIVE = 'is-active';
    // As the FAQ on pigalle.co.za: opens in 0.5s power2.out, closes in 0.4s power2.inOut
    static OPEN = { duration: 500, easing: 'cubic-bezier(0.5, 1, 0.89, 1)' };
    static CLOSE = { duration: 400, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' };

    private $summary: HTMLElement | null = null;
    private $content: HTMLElement | null = null;
    private $details: HTMLDetailsElement | null = null;
    private animation: Animation | null = null;
    private isClosing: boolean = false;
    private isExpanding: boolean = false;

    constructor() {
        super();

        this.$summary = this.querySelector('summary');
        this.$details = this.querySelector('details');
        this.$content = this.querySelector('[data-accordion="content"]');
    }

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        if (!this.validateElements()) return;
        this.bindEvents();
    }

    disconnectedCallback() {
        this.unbindEvents();
        this.cancelAnimation();
    }

    // =============================================================================
    // Events
    // =============================================================================
    private bindEvents(): void {
        this.$summary?.addEventListener('click', this.onClick);
        this.$details?.addEventListener('toggle', this.onToggle);
    }

    private unbindEvents(): void {
        this.$summary?.removeEventListener('click', this.onClick);
        this.$details?.removeEventListener('toggle', this.onToggle);
    }

    // =============================================================================
    // Callbacks
    // =============================================================================
    /**
     * Accordions that share a `name` are exclusive: opening one makes the browser close the others
     * on its own, without going through close(). Keep the closed one's state (and icon) in step.
     */
    private onToggle = (): void => {
        if (this.$details?.open || this.isAnimating()) return;

        this.cancelAnimation();
        this.$details?.classList.remove(Accordion.CLASS_ACTIVE);
        this.$details!.style.height = '';
        this.style.overflow = '';
    };

    private onClick = (e: Event): void => {
        e.preventDefault();

        if (this.isAnimating()) return;

        // Phones and touch screens: animating the height re-lays out the whole page below on
        // every frame, which stutters there. It opens and closes at once; the answer fades in (CSS).
        if ($mediaStatus.get().isTouchOrSmall) {
            this.toggleInstantly();
            return;
        }

        if (this.isOpen()) {
            this.close();
        } else {
            this.open();
        }
    };

    private toggleInstantly(): void {
        const open = !this.isOpen();

        // Opening sets the attribute, so the browser closes the other accordions in the group
        this.$details!.toggleAttribute('open', open);
        this.$details!.classList.toggle(Accordion.CLASS_ACTIVE, open);

        this.dispatchCustomEvent(open ? 'accordion-opened' : 'accordion-closed');
        this.dispatchCustomEvent('accordion-animation-finished', { isOpen: open });
    }

    // =============================================================================
    // Animation Methods
    // =============================================================================
    private cancelAnimation(): void {
        if (this.animation) {
            this.animation.cancel();
            this.animation = null;
        }
    }

    private createAnimation(
        startHeight: string,
        endHeight: string,
        timing: { duration: number; easing: string }
    ): Animation {
        this.cancelAnimation();

        return this.animate({ height: [startHeight, endHeight] }, timing);
    }

    private prepareForAnimation(): void {
        this.style.overflow = 'hidden';
    }

    private cleanupAfterAnimation(): void {
        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.$details!.style.height = '';
        this.style.overflow = '';
    }

    // =============================================================================
    // Methods
    // =============================================================================
    private close(): void {
        this.isClosing = true;
        this.$details!.classList.remove(Accordion.CLASS_ACTIVE);
        this.prepareForAnimation();

        const startHeight = `${this.$details!.offsetHeight}px`;
        const endHeight = `${this.$summary!.offsetHeight}px`;

        this.animation = this.createAnimation(startHeight, endHeight, Accordion.CLOSE);
        this.animation.onfinish = () => this.onAnimationFinish(false);
        this.animation.oncancel = () => this.onCloseCancel();

        this.dispatchCustomEvent('accordion-closed');
    }

    private open(): void {
        this.isExpanding = true;
        this.$details!.style.height = `${this.offsetHeight}px`;
        this.$details!.setAttribute('open', '');
        this.$details!.classList.add(Accordion.CLASS_ACTIVE);
        this.prepareForAnimation();

        window.requestAnimationFrame(() => {
            const startHeight = `${this.$details!.offsetHeight}px`;
            const endHeight = `${this.$summary!.offsetHeight + this.$content!.offsetHeight}px`;

            this.animation = this.createAnimation(startHeight, endHeight, Accordion.OPEN);
            this.animation.onfinish = () => this.onAnimationFinish(true);
            this.animation.oncancel = () => this.onExpandCancel();
        });

        this.dispatchCustomEvent('accordion-opened');
    }

    // =============================================================================
    // Animation Callbacks
    // =============================================================================
    private onAnimationFinish(open: boolean): void {
        if (open) {
            this.$details!.setAttribute('open', '');
        } else {
            this.$details!.removeAttribute('open');
        }

        this.cleanupAfterAnimation();

        this.dispatchCustomEvent('accordion-animation-finished', {
            isOpen: open
        });
    }

    private onCloseCancel(): void {
        this.isClosing = false;
        this.$details!.classList.add(Accordion.CLASS_ACTIVE);
    }

    private onExpandCancel(): void {
        this.isExpanding = false;
        this.$details!.classList.remove(Accordion.CLASS_ACTIVE);
    }

    // =============================================================================
    // Utilities
    // =============================================================================
    private dispatchCustomEvent(eventName: string, detail: any = {}): void {
        this.dispatchEvent(
            new CustomEvent(eventName, {
                detail: { target: this, ...detail },
                bubbles: true
            })
        );
    }

    private validateElements(): boolean {
        if (!this.$summary || !this.$details || !this.$content) {
            console.warn('Accordion: Missing required elements (summary, details, or content)');
            return false;
        }
        return true;
    }

    // =============================================================================
    // Public API
    // =============================================================================
    public toggle(): void {
        if (this.isAnimating()) return;

        if (this.isOpen()) {
            this.close();
        } else {
            this.openAccordion();
        }
    }

    public openAccordion(): void {
        if (!this.isOpen() && !this.isAnimating()) {
            this.open();
        }
    }

    public closeAccordion(): void {
        if (this.isOpen() && !this.isAnimating()) {
            this.close();
        }
    }

    public isOpen(): boolean {
        return this.$details?.hasAttribute('open') ?? false;
    }

    public isAnimating(): boolean {
        return this.isClosing || this.isExpanding;
    }
}

// Register the custom element
customElements.define('c-accordion', ComponentElement(Accordion, 'Accordion'));
