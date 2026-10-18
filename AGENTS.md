# AGENTS.md

Chrome extension (Manifest V3). It exports the open `dion.vc` dialog to a `.docx` file.

## Language

Write project Markdown in English ASD-STE100.
`README.md` is Russian. Do not translate it.
`README.en.md` is the English copy of `README.md`. Do not write that file in STE.
This rule applies to prose. It does not apply to code, paths, commands, or selectors.

## Commands

```sh
npm install
npm run build
npm run watch
npm run release
npm test
```

`npm run build` writes `dist/`. Load the unpacked extension from `dist/`.

## Read one file

Open `docs/index.md` when you do not know which file to open.

| Task | File |
| --- | --- |
| You change the export path, the popup, the service worker, the offscreen page, or the DOCX build | `docs/architecture.md` |
| You change selectors, scroll, message fields, or images | `docs/dom.md` |
| You change the build or the release zip | `docs/build.md` |
| You change tests or you check a change | `docs/test.md` |
| You add a permission, a dependency, or a selector | `docs/rules.md` |

Before you change the scraper, read `docs/dom.md`.

## Rules

- Do not use hashed CSS classes (`dion-web-platform-*`, `e1dx*`). Use `data-testid`, `data-*`, and a DOM walk.
- Keep selectors in the object `S` at the top of `src/content.js`.
- Edit files in `src/` only. Do not edit `dist/` or `release/` by hand.
- Do not add a dependency unless the task needs it. The stack is plain JS and `docx`.
- Do not add a manifest permission. The current set is `downloads`, `offscreen`, `scripting`, and the host `https://dion.vc/*`.
