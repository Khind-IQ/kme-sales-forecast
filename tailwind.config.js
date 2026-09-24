import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;
// Opaque tint of a token over base-100 — for sticky headers/columns, where a
// translucent `bg-accent/10` would let scrolled rows show through.
const tint = (name, pct) => `color-mix(in srgb, rgb(var(--color-${name})) ${pct}%, rgb(var(--color-base-100)))`;

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Manrope', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                'base-100': token('base-100'),
                'base-200': token('base-200'),
                'base-300': token('base-300'),
                'base-150': tint('base-300', 60),
                'primary-tint': tint('primary', 15),
                'primary-tint-strong': tint('primary', 30),
                'accent-tint': tint('accent', 10),
                'success-tint': tint('success', 15),
                'warning-tint': tint('warning', 12),
                'secondary-tint': tint('secondary', 10),
                'base-content': token('base-content'),
                primary: {
                    DEFAULT: token('primary'),
                    hover: token('primary-hover'),
                    strong: token('primary-strong'),
                    content: token('primary-content'),
                },
                secondary: { DEFAULT: token('secondary'), content: token('secondary-content') },
                accent: { DEFAULT: token('accent'), content: token('accent-content') },
                neutral: { DEFAULT: token('neutral'), content: token('neutral-content') },
                info: { DEFAULT: token('info'), content: token('info-content') },
                success: { DEFAULT: token('success'), content: token('success-content') },
                warning: {
                    DEFAULT: token('warning'),
                    strong: token('warning-strong'),
                    content: token('warning-content'),
                },
                error: { DEFAULT: token('error'), content: token('error-content') },
            },
            borderRadius: {
                selector: '0.375rem',
                field: '0.5rem',
                box: '0.625rem',
            },
        },
    },

    plugins: [forms],
};
