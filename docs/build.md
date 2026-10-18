# Build and release

Read this file when you change `build.mjs`, `scripts/release.mjs`, or the manifest copy.

## Build

`npm run build` runs `build.mjs`.
`npm run watch` runs the same script with `--watch`.

esbuild bundles four entry points to IIFE for Chrome 120.

| Entry | Source |
| --- | --- |
| `content` | `src/content.js` |
| `popup` | `src/popup.js` |
| `background` | `src/background.js` |
| `offscreen` | `src/offscreen.js` |

The script deletes `dist/` and writes it again.
It copies these files as they are:

- `src/manifest.json`
- `src/popup.html`
- `src/offscreen.html`
- `src/icons/`
- `src/popup-reference.png`

Do not edit `dist/` by hand.

Check the manifest after a build:

```sh
node -e "JSON.parse(require('fs').readFileSync('dist/manifest.json'))"
```

## Release

`npm run release` runs `scripts/release.mjs`.
The script builds `dist/` and packs it into `release/dion-chat-docx-<version>.zip`.
The version comes from `src/manifest.json`.
`manifest.json` is at the root of the zip.
Do not edit `release/` by hand.

Load the unpacked extension from `dist/`, or from the unpacked zip folder.
Do not load `src/`. See `docs/rules.md`.
