import '@mux/mux-background-video/html';
import { ComponentElement } from '@locomotivemtl/component-manager';
import { MOTION } from '@scripts/config';
import { whenReady } from '@scripts/stores/ready';

type MuxPlayer = HTMLElement & { video: HTMLVideoElement };

type PlayerOptions = {
    playbackId: string;
    maxResolution: string;
    preload: 'auto' | 'metadata';
    // Video time (s) of the poster frame; the player stays hidden until it reaches it
    posterTime: number;
};

// One player per video, kept alive for the whole visit (also while it is off the page)
const players = new Map<string, MuxPlayer>();

/**
 * A plain muted, looping, inline <video> playing the stream with the browser's own HLS support.
 * The Mux element needs Media Source Extensions, which iPhones don't have (before iOS 17.1 at all,
 * and after that only as ManagedMediaSource), so there it would never play.
 */
const createNativePlayer = ({ playbackId, maxResolution, preload }: PlayerOptions): MuxPlayer => {
    const $video = document.createElement('video');

    // iOS only autoplays a video that is muted and inline, set as attributes before the source
    $video.muted = true;
    $video.setAttribute('muted', '');
    $video.setAttribute('playsinline', '');
    $video.loop = true;
    $video.disableRemotePlayback = true;
    $video.preload = preload;
    $video.src = `https://stream.mux.com/${playbackId}.m3u8?max_resolution=${maxResolution}`;

    return Object.assign($video, { video: $video });
};

const usesNativeHls = (): boolean =>
    !('MediaSource' in window) &&
    document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';

const createPlayer = (options: PlayerOptions): MuxPlayer => {
    const { playbackId, maxResolution, preload, posterTime } = options;
    let $player: MuxPlayer;

    if (usesNativeHls()) {
        $player = createNativePlayer(options);
    } else {
        $player = document.createElement('mux-background-video') as MuxPlayer;
        $player.setAttribute('max-resolution', maxResolution);
        $player.setAttribute('preload', preload);
        $player.setAttribute('src', `https://stream.mux.com/${playbackId}.m3u8`);
    }

    const $video = $player.video;

    // Read by waitForVideos() so a page change waits for the reveal below
    $player.setAttribute('data-await-reveal', '');

    // Styled inline: the player is created here, outside the component's scoped styles.
    // It sits on top of the poster and starts invisible.
    Object.assign($player.style, {
        position: 'absolute',
        inset: '0',
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: '0',
        transition: `opacity ${MOTION.duration.fast / 2}s linear`
    });

    // Playback is started and stopped by the component, never by the browser
    $video.autoplay = false;

    // Start on the poster's frame, so the hand-over from poster to video is invisible
    if (posterTime > 0) {
        $video.addEventListener(
            'loadedmetadata',
            () => {
                $video.currentTime = posterTime;
            },
            { once: true }
        );
    }

    // Show the player the first time it presents a frame at or past the poster's.
    // If the seek above was ignored, the poster simply stays until the video gets there.
    const reveal = (): void => {
        $player.style.opacity = '1';
        $player.dataset.revealed = 'true';
        $player.dispatchEvent(new Event('revealed'));
    };
    const hasReachedPoster = (time: number): boolean => time >= posterTime - 0.05;

    if (typeof $video.requestVideoFrameCallback === 'function') {
        const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
            if (hasReachedPoster(metadata.mediaTime)) {
                reveal();
            } else {
                $video.requestVideoFrameCallback(onFrame);
            }
        };
        $video.requestVideoFrameCallback(onFrame);
    } else {
        const onTimeUpdate = (): void => {
            if ($video.paused || !hasReachedPoster($video.currentTime)) return;

            $video.removeEventListener('timeupdate', onTimeUpdate);
            reveal();
        };
        $video.addEventListener('timeupdate', onTimeUpdate);
    }

    players.set(playbackId, $player);

    return $player;
};

export class HeroVideo extends HTMLElement {
    // How long after the page is revealed the stream is prepared in the background (ms)
    static WARM_DELAY = 1500;

    private $player: MuxPlayer | null = null;
    private cancelReady: (() => void) | null = null;
    private warmTimeout: number | null = null;

    // =============================================================================
    // Lifecycle
    // =============================================================================
    connectedCallback() {
        const playbackId = this.dataset.playbackId;
        if (!playbackId) return;

        const options = {
            playbackId,
            maxResolution: this.dataset.maxResolution ?? '1080p',
            posterTime: parseFloat(this.dataset.posterTime ?? '0') || 0
        };

        if (this.hasAttribute('data-warm')) {
            this.warm(options);
            return;
        }

        this.$player = players.get(playbackId) ?? createPlayer({ ...options, preload: 'auto' });

        this.append(this.$player);
        this.play();

        // Phones pause background videos when the tab is hidden and don't always resume them
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    disconnectedCallback() {
        this.cancelReady?.();
        this.cancelReady = null;
        if (this.warmTimeout) window.clearTimeout(this.warmTimeout);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.unbindGesture();

        // Keep the player (and what it has buffered) for the next time this video is shown
        this.$player?.video.pause();
        this.$player?.remove();
        this.$player = null;
    }

    // =============================================================================
    // Events
    // =============================================================================
    private onVisibilityChange = (): void => {
        if (document.visibilityState === 'visible') this.play();
    };

    // A touch counts as permission to play, even in Low Power Mode
    private onGesture = (): void => {
        this.unbindGesture();
        this.play();
    };

    private bindGesture(): void {
        window.addEventListener('pointerdown', this.onGesture, { passive: true, capture: true });
        window.addEventListener('touchend', this.onGesture, { passive: true, capture: true });
    }

    private unbindGesture(): void {
        window.removeEventListener('pointerdown', this.onGesture, { capture: true });
        window.removeEventListener('touchend', this.onGesture, { capture: true });
    }

    // =============================================================================
    // Methods
    // =============================================================================
    /**
     * Autoplay can be refused (iOS Low Power Mode, Android data saver): the poster stays
     * and the video starts on the visitor's first touch instead
     */
    private play(): void {
        this.$player?.video.play().catch((error: DOMException) => {
            if (error.name === 'NotAllowedError') this.bindGesture();
        });
    }

    /**
     * Prepare the stream without showing or playing it.
     * With preload="metadata" the player fetches the playlists but no video data until it plays.
     */
    private warm(options: Omit<PlayerOptions, 'preload'>): void {
        this.cancelReady = whenReady(() => {
            this.warmTimeout = window.setTimeout(() => {
                if (!players.has(options.playbackId)) {
                    createPlayer({ ...options, preload: 'metadata' });
                }
            }, HeroVideo.WARM_DELAY);
        });
    }
}

// Register the custom element
customElements.define('c-hero-video', ComponentElement(HeroVideo, 'HeroVideo'));
