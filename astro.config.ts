import { defineConfig, fontProviders } from 'astro/config';
import { loadEnv } from 'vite';
import editableRegions from '@cloudcannon/editable-regions/astro-integration';
/* PostCSS plugins */
import postcssHelpersFunctions from '@locomotivemtl/postcss-helpers-functions';
import postcssTailwindShortcuts from '@locomotivemtl/postcss-tailwind-shortcuts';
import tailwindcss from '@tailwindcss/postcss';
import postcssUtopia from 'postcss-utopia';

/* Astro Integrations / Plugins */
import icon from 'astro-icon';

/* Get server allowed hosts from .env */
const ENVS = loadEnv(process.env.NODE_ENV as string, process.cwd(), '');
const SERVER_ALLOWED_HOSTS = (ENVS?.SERVER_ALLOWED_HOSTS || '').split(',') || [];

// https://astro.build/config
export default defineConfig({
    site: 'https://locomotive-astro-boilerplate.vercel.app',
    vite: {
        css: {
            postcss: {
                plugins: [
                    // Orders matter here
                    // Tailwindcss plugin should call after postcss helpers
                    postcssUtopia(),
                    postcssHelpersFunctions(),
                    postcssTailwindShortcuts(),
                    tailwindcss()
                ]
            }
        },
        optimizeDeps: {
            include: [
                '@locomotivemtl/grid-helper',
                '@locomotivemtl/component-manager',
                'locomotive-scroll',
                '@swup/head-plugin',
                '@swup/preload-plugin',
                '@swup/scripts-plugin',
                'swup',
                'nanostores'
            ]
        },
        build: {
            chunkSizeWarningLimit: 1000
        }
    },
    integrations: [
        icon({
            iconDir: './src/assets/svgs'
        }),
        editableRegions()
    ],
    server: {
        allowedHosts: SERVER_ALLOWED_HOSTS
    },
    devToolbar: {
        enabled: false
    },
    image: {
        domains: ['locomotive.ca'],
        remotePatterns: [{ protocol: 'https' }]
    },
    fonts: [
        {
            provider: fontProviders.local(),
            name: 'Roslindale Display Narrow',
            cssVariable: '--custom-rd-narrow',
            fallbacks: ['sans-serif'],
            options: {
                variants: [
                    {
                        weight: 400,
                        style: 'normal',
                        display: 'swap',
                        src: ['./src/assets/fonts/RoslindaleDspNar-Regular.woff2']
                    }
                ]
            }
        },
        {
            provider: fontProviders.local(),
            name: 'Roslindale Display Condensed',
            cssVariable: '--custom-rd-condensed',
            fallbacks: ['sans-serif'],
            options: {
                variants: [
                    {
                        weight: 300,
                        style: 'italic',
                        display: 'swap',
                        src: ['./src/assets/fonts/RoslindaleDspCd-LtIt.woff2']
                    }
                ]
            }
        },
        {
            provider: fontProviders.local(),
            name: 'Lato',
            cssVariable: '--custom-lato',
            fallbacks: ['sans-serif'],
            options: {
                variants: [
                    {
                        weight: 400,
                        style: 'normal',
                        display: 'swap',
                        src: ['./src/assets/fonts/Lato-Regular.woff2']
                    }
                ]
            }
        }
    ]
});
