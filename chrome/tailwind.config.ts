import type { Config } from 'tailwindcss';

export default {
    content: ['./src/**/*.{html,tsx,ts}'],
    theme: {
        extend: {
            colors: {
                bg: '#080808',
                surface: '#121212',
                'surface-alt': '#1a1a1a',
                'surface-deep': 'oklch(0.08 0.004 264)',
                'surface-raised': 'oklch(0.09 0.004 264)',
                'surface-card': 'oklch(0.11 0.004 264)',
                'surface-hover': 'oklch(0.15 0.004 264)',
                accent: '#7ED37F',
                'accent-dim': '#5FB262',
                secondary: 'oklch(0.52 0.13 240)',
                'muted-fg': 'oklch(0.5 0.008 264)',
                destructive: 'oklch(0.62 0.22 25)',
                'on-surface': '#ffffff',
                'on-surface-alt': '#a1a1a1',
            },
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
            },
        },
    },
} satisfies Config;
