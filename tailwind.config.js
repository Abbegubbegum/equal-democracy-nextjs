/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
		'./lib/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			colors: {
				// Theme-aware colors using CSS variables
				primary: {
					50: 'var(--color-primary-50, #eff6ff)',
					100: 'var(--color-primary-100, #dbeafe)',
					400: 'var(--color-primary-400, #60a5fa)',
					500: 'var(--color-primary-500, #3b82f6)',
					600: 'var(--color-primary-600, #2563eb)',
					700: 'var(--color-primary-700, #1d4ed8)',
					800: 'var(--color-primary-800, #1e40af)',
					900: 'var(--color-primary-900, #1e3a8a)',
				},
				accent: {
					50: 'var(--color-accent-50, #fefce8)',
					100: 'var(--color-accent-100, #fef9c3)',
					400: 'var(--color-accent-400, #facc15)',
					500: 'var(--color-accent-500, #eab308)',
					600: 'var(--color-accent-600, #ca8a04)',
				},
			},
		},
	},
	plugins: [],
};
