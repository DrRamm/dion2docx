# Architecture

Read this file when you change the export path or the DOCX build.
Also read it for the popup, the service worker, or the offscreen page.

## Path

1. `src/popup.js` sends `{ type: "dion-export-docx" }` to the open tab.
2. `src/content.js` runs `runExport`.
3. `getScroller` finds the message list.
4. `collectAll` scrolls the list toward the top one time.
5. `collectAll` stores each message in a `Map`.
6. `collectAll` stores each image `blob:` URL.
7. `collectAll` waits one time for the batch. It does not wait for each image.
8. `fetchImages` reads the images in parallel.
9. `fetchImages` calls `fetch` on the `blob:` URL first.
10. When `fetch` fails, `fetchImages` reads the canvas and writes a PNG.
11. `buildDocx` builds the `.docx` with the `docx` library. `ImageRun` places each image.
12. The message time in the file is local. The format is `DD.MM.YYYY HH:MM:SS`.
13. `runExport` sends the file as base64. The message type is `dion-download`.
14. `src/background.js` opens the offscreen document.
15. `src/offscreen.js` makes a blob URL with `URL.createObjectURL`.
16. `chrome.downloads.download` saves the file.
17. When that path fails, the content script saves the file with `<a download>`.

`runExport` returns `{ ok: true, messages, images, filename }` after a good export.

## Modules

| Path | Role |
| --- | --- |
| `src/popup.html` | Popup page. The button starts the export. |
| `src/popup.js` | Sends the export message. Injects `content.js` when the tab has no listener. |
| `src/content.js` | Reads the DOM, builds the DOCX, and shows the progress overlay. |
| `src/background.js` | Service worker. Receives base64 and starts the download. |
| `src/offscreen.html` | Host page for the offscreen document. |
| `src/offscreen.js` | Makes the blob URL. Manifest V3 blocks `createObjectURL` in the service worker. |
| `src/manifest.json` | Manifest V3. It names the scripts and the permissions. |

## File name

`runExport` builds the file name from the chat title and the local date.
The pattern is `<title> YYYY-MM-DD.docx`.
`sanitize` replaces characters that a file name cannot contain.
