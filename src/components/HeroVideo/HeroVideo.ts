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

const createPlayer = ({
    playbackId,
    maxResolution,
    preload,
    posterTime
}: PlayerOptions): MuxPlayer => {
    const $player = document.createElement('mux-background-video') as MuxPlayer;
    const $video = $player.video;

    $player.setAttribute('max-resolution', maxResolution);
    $player.setAttribute('preload', preload);
    $player.setAttribute('src', `https://stream.mux.com/${playbackId}.m3u8`);

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
        this.$player.video.play().catch(() => {
            // Autoplay can be refused (e.g. low power mode); the poster stays visible
        });
    }

    disconnectedCallback() {
        this.cancelReady?.();
        this.cancelReady = null;
        if (this.warmTimeout) window.clearTimeout(this.warmTimeout);

        // Keep the player (and what it has buffered) for the next time this video is shown
        this.$player?.video.pause();
        this.$player?.remove();
        this.$player = null;
    }

    // =============================================================================
    // Methods
    // =============================================================================
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
