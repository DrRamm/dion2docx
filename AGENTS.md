# AGENTS.md

Instructions for agents that work with this repository.

## What this is

This is a Chrome extension (Manifest V3). It exports an open dialog on `dion.vc`
to a `.docx` file. The export contains the author, the time, the text, the
replies, and the images. The user documentation is in `README.md`. Compact facts
about the subject field are in `MEMORY.md`. Read `MEMORY.md` before you change
the scraper.

## Commands

```sh
npm install        # install the dependencies
npm run build      # build the extension in dist/
npm run watch      # build again after changes
npm run release    # build + zip to release/dion-chat-docx-<version>.zip
```

Check the syntax of the manifest:

```sh
node -e "JSON.parse(require('fs').readFileSync('dist/manifest.json'))"
```

Load the ready extension in Chrome as unpacked from the `dist/` folder
(`chrome://extensions` → developer mode → "Load unpacked").

## Structure

| Path | Purpose |
| --- | --- |
| `src/content.js` | DOM scraper + DOCX build (`docx`), progress overlay |
| `src/background.js` | Service worker: download through `chrome.downloads` |
| `src/offscreen.js` | Offscreen document: makes a blob URL (in MV3, `createObjectURL` is only here) |
| `src/popup.html/.js` | Start button |
| `src/manifest.json` | MV3 manifest |
| `build.mjs` | esbuild build → `dist/` |
| `scripts/release.mjs` | Release: build + zip (`manifest.json` in the root) |
| `dist/` | Build artifact (do not edit by hand) |
| `release/` | Ready zip archives of the extension (release artifact) |

## Data flow

`popup` → `chrome.tabs.sendMessage` → `content.runExport()`:
1. It finds the scroll container of the messages (`getScroller`).
2. `collectAll` makes one fast pass up. It collects the messages in a `Map` and
   the `blob:` URLs of the images. Then it does **one common** wait (not one wait
   for each image).
3. `fetchImages` reads all images **in parallel** (`fetch(blob:)`, fallback
   canvas → PNG).
4. `buildDocx` builds the document.
5. It sends base64 to `background`. `offscreen` makes a blob URL. Then
   `chrome.downloads.download` starts the download. On an error, the fallback
   downloads through `<a>`.

## Rules

- **Do not use hashed CSS classes** (`dion-web-platform-*`, `e1dx*`). CSS-in-JS
  makes these classes and they change. Use only `data-testid`, `data-*`, and a
  structural walk of the DOM.
- Keep the selectors in the object `S` at the start of `src/content.js`.
- Make changes only in `src/`. `npm run build` builds `dist/` again.
- Style: no frameworks, only JS and `docx`, and no new dependencies if not
  necessary.
- Do not add permissions to the manifest above the necessary permissions
  (`downloads`, `offscreen`, `activeTab`, the host `https://dion.vc/*`).

## Problems (tested on the live UI)

- The page has some scroll lists. `[data-virtuoso-scroller]` is the **list of
  chats in the sidebar**, not the messages. Find the container of the messages.
  Go up from a message to the nearest parent with `overflow-y:auto/scroll`.
- The list of messages is **virtualized**. The nodes are used again. Do not cache
  references to elements between scrolls. Get the elements from the DOM again.
- The images come encrypted as `blob:` (a direct CDN URL gives 404). Read
  `img.src` after the element is near the viewport.
- `scrollIntoView` redraws the list and detaches the neighbor nodes. Check
  `img.isConnected`. Do not mark detached attachments as broken.
- The history API (`chats-api.dion.vc/.../history`) needs an encryption session
  (error 428). Do not use it. Work through the DOM.

## Test of the changes

Live test without a load of the extension: inject `dist/content.js` into an open
tab of `dion.vc` and call `window.__dionExportDocx()`. Expected result:
`{ ok: true, messages: N, images: M }` and a downloaded `.docx`. The document
must contain the authors, the time, the replies, and the images.
