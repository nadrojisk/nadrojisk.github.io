# nadrojisk's Blog

Source for [blog.nadrojisk.com](https://blog.nadrojisk.com) — notes on malware analysis, reverse engineering, and CTF writeups.

Built with [Astro](https://astro.build) on the [Astro Cactus](https://astro-cactus.midori-ai.xyz/) theme, styled with Tailwind CSS, and deployed to GitHub Pages.

## Development

```bash
npm install
npm run dev
```

Other scripts:

| Command           | Description                                   |
| ------------------ | ---------------------------------------------- |
| `npm run build`    | Build the production site to `dist/`          |
| `npm run preview`  | Preview the production build locally          |
| `npm run check`    | Run `astro check` (types) and Biome (lint)     |
| `npm run lint`     | Run Biome with autofix                        |
| `npm run format`   | Format the project with Prettier              |

Posts and pages live under `content/`; components, layouts, and site config live under `src/`.

## Deployment

Pushes to `main` are built and deployed to GitHub Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Pull requests run [`.github/workflows/ci.yml`](.github/workflows/ci.yml), which must pass before merging — `main` is a protected branch and does not accept direct pushes.
