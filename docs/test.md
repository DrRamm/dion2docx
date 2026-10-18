# Tests

Read this file when you change tests or you check a change.

## Playwright

`npm test` builds `dist/` and runs Playwright.
The config is `src/tests/playwright.config.js`.
The tests are in `src/tests/extension.spec.js`.
The dialog fixture is local. The tests do not use a Dion account.

The suite checks virtual scroll, replies, time, images, and the DOCX bytes.
Playwright uses the time zone `Europe/Moscow`.

`npm run test:yandex` runs the same suite in Yandex Browser.
`npm run test:yandex:dom` runs the test `Yandex runs the scraper on the same virtualized dialog`.

Prepare the Yandex profile one time:

```sh
npm run setup:yandex
```

In the open `chrome://extensions` page, enable developer mode.
Load the unpacked extension from `dist/`.
The window closes after the extension service worker appears.
The profile path is `~/.cache/dion-chat-docx/yandex-test`.
This command does not change the normal browser profile.
Set `YANDEX_BINARY` to use another browser path.
Set `YANDEX_PROFILE` to use another profile path.
The default binary is `/Applications/Yandex.app/Contents/MacOS/Yandex`.

## Live check

Inject `dist/content.js` into an open `dion.vc` tab.
Call `window.__dionExportDocx()`.
A good result is `{ ok: true, messages: N, images: M }` and a downloaded `.docx`.
The file must contain the authors, the time, the replies, and the images.

## Chrome DevTools MCP

`opencode.jsonc` starts the `chrome-devtools` MCP server with `--autoConnect`.
It attaches to the normal Chrome profile that already has the login.
Enable remote debugging at `chrome://inspect/#remote-debugging`.
