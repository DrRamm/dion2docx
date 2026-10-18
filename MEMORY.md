# MEMORY.md

Compact "memory" of the project. Read it before you work with the scraper. It
does not copy `AGENTS.md` (the rules) and `README.md` (for people).

## Subject field: dion.vc (chats)

- Dialog page: `https://dion.vc/chats/conversations/<uuid>`.
- The UI is React + MUI + react-virtuoso. The time zone in the UI is local. The
  metadata is in UTC.

### DOM facts

- Message wrapper: `[data-cursor][data-id]` — exactly one for each message.
  - `data-id` = the message id. `data-cursor` = ISO-8601 UTC (for example,
    `2026-01-01T12:00:00.000000Z`).
- Inside: `[data-testid="chats_message_item"]`:
  - `chats_message_author` — the author (text);
  - `chats_message_text` (+`data-message-id`) — the text, the links, `<br>`;
  - `chats_message_time` — the time HH:MM (local);
  - `chats_message_text_reply` / `chats_reply_message_author` — the reply;
  - image: `img[alt^="File"]`, uuid = `alt` without the prefix `File `.
- Date divider: `[data-testid="messagesDate"]` (for example, `16 Oct`).
- Dialog title: `[data-testid="chats_selected_chat_title"]`.

### Scroll

- The list of messages is virtualized. The container is not
  `[data-virtuoso-scroller]` (that is the sidebar). Find it: go up from a message
  to the parent with `overflow-y:auto/scroll` and `scrollHeight > clientHeight`.
- Old messages load when you scroll up. For a reliable result, go to
  `scrollTop === 0` and push the wheel some times.

### Images

- Direct URL `https://photo-delivery.dion.vc/v1/file/<uuid>` → **404**.
- The real bytes are available as `blob:` in `img.src` after the render near the
  viewport. Read `fetch(img.src)` (fallback — canvas → PNG).
- The history API is encrypted: `GET chats-api.dion.vc/v1/conversations/<id>/history`
  → `428 {"code":1903,"message":"Не предоставлен ID сессии шифрования"}`.

## Technical decisions

- The library `docx` builds the DOCX (`Packer.toBlob`). `ImageRun` makes the
  images.
- Download: `chrome.downloads` through offscreen (in MV3, the SW cannot use
  `URL.createObjectURL`). Fallback — `<a download>` in the content script.
- The time in the document is local. The format is `DD.MM.YYYY HH:MM:SS`.

## Environment

- The MCP `chrome-devtools` is connected for the project (`opencode.jsonc`) in
  the mode `--autoConnect` to the usual Chrome with the logins. It needs remote
  debugging: `chrome://inspect/#remote-debugging`.
- Live test: inject `dist/content.js` into a tab of `dion.vc`, then call
  `window.__dionExportDocx()`.

## Known features

- The number of messages in the output can be different until the top of the list
  is reached (the first message is the topmost).
- Performance: one fast pass (`collectAll`) collects the messages and the `blob:`
  URLs of the images. Then `fetchImages` reads all images **in parallel**. Do not
  wait for each image separately — that was a bottleneck.
- Measurements: 5 messages / 0 images ≈ 0.5 s; 20 messages / 11 images ≈ 1.6 s.
