# Rules for code changes

Read this file when you add a permission, a dependency, or a selector.

## Selectors

Do not use hashed CSS classes. CSS-in-JS generates them, and they change.
Examples of hashed classes: `dion-web-platform-*` and `e1dx*`.
Use `data-testid`, other `data-*` attributes, and a structural DOM walk.
Put every selector in the object `S` at the top of `src/content.js`.
UI traps for scroll and images are in `docs/dom.md`.

## Where to edit

Edit files in `src/` only.
`npm run build` writes `dist/` again.
Do not edit `dist/` or `release/` by hand.
Do not load `src/` as the unpacked extension.
`src/content.js` starts with `import` and does not run as a content script before the build.
When that folder is loaded, the popup tells the user to load `dist/`.

## Stack

The code is plain JS plus the `docx` library.
Do not add a framework.
Do not add a dependency unless the task needs it.

## Permissions

Do not add a manifest permission.
The current permissions are `downloads`, `offscreen`, and `scripting`.
The only host permission is `https://dion.vc/*`.
There is no `storage` permission. The extension does not save data between runs.
