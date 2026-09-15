// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.nadrojisk.com',
	vite: {
		preview: {
			// Allows the local `astro preview` server to be reached through
			// tunnels (e.g. cloudflared) during manual testing. Has no effect
			// on the deployed static build.
			allowedHosts: true,
		},
	},
	integrations: [
		starlight({
			title: "nadrojisk's Blog",
			description: 'Notes on malware analysis, reverse engineering, and CTF writeups.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/nadrojisk' },
				{ icon: 'twitter', label: 'Twitter', href: 'https://twitter.com/nadrojisk' },
				{ icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/nadrojisk/' },
			],
			sidebar: [
				{ label: 'Tags', link: '/tags/' },
				{ label: 'About', link: '/about/' },
				{
					label: 'Reverse Engineering',
					items: [{ autogenerate: { directory: 'reverse_engineering' } }],
				},
				{
					label: 'CTF',
					items: [{ autogenerate: { directory: 'ctf' } }],
				},
				{
					label: 'Malware',
					items: [{ autogenerate: { directory: 'malware' } }],
				},
			],
		}),
	],
});
