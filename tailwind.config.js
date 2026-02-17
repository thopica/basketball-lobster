/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        lobster: {
          'primary': '#FF6B35',
          'primary-content': '#ffffff',
          'secondary': '#1A1A2E',
          'secondary-content': '#ffffff',
          'accent': '#16213E',
          'accent-content': '#ffffff',
          'neutral': '#1A1A2E',
          'neutral-content': '#ffffff',
          'base-100': '#FFFFFF',
          'base-200': '#F5F5F5',
          'base-300': '#E5E7EB',
          'base-content': '#1A1A2E',
          'info': '#2563EB',
          'success': '#16A34A',
          'warning': '#F59E0B',
          'error': '#DC2626',
        },
        lobsterdark: {
          'primary': '#FF6B35',
          'primary-content': '#ffffff',
          'secondary': '#E5E7EB',
          'secondary-content': '#1A1A2E',
          'accent': '#FF6B35',
          'accent-content': '#ffffff',
          'neutral': '#2A2A3E',
          'neutral-content': '#E5E7EB',
          'base-100': '#1A1A2E',
          'base-200': '#16213E',
          'base-300': '#2A2A3E',
          'base-content': '#E5E7EB',
          'info': '#60A5FA',
          'success': '#4ADE80',
          'warning': '#FBBF24',
          'error': '#F87171',
        },
      },
    ],
  },
};
