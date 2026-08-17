/** @type {import('tailwindcss').Config} */
module.exports = {
  // Section markup lives in template modules, not in index.html, so both must be
  // scanned or the utility classes they emit get purged out of the build.
  content: ['./index.html', './src/js/**/*.js'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
