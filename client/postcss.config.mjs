/**
 * PostCSS Configuration
 * Required for Tailwind CSS to process CSS
 *
 * Architectural Decision:
 * - tailwindcss plugin processes @tailwind directives
 * - autoprefixer adds vendor prefixes for browser compatibility
 */
export default {
    plugins: {
        tailwindcss: {},
        autoprefixer: {},
    },
};
