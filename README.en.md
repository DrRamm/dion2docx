<p align="center">
  <img src="images/promo-small-440x280_v3.png" width="440" alt="Dion: a conference chat in DOCX, a browser extension">
</p>

<h1 align="center">Dion Chat → DOCX</h1>

<p align="center">
  An open dialog on <a href="https://dion.vc">dion.vc</a> is saved to one Word file.<br>
  Author, time, text, replies, and images. The build runs in the browser, on your computer.
</p>

<p align="center">
  <img alt="Version 0.1.2" src="https://img.shields.io/badge/version-0.1.2-6C5CE7">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4285F4">
  <img alt="Chrome extension" src="https://img.shields.io/badge/Chrome-extension-34A853?logo=googlechrome&logoColor=white">
  <a href="https://github.com/DrRamm/dion2docx/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/DrRamm/dion2docx?style=flat&logo=github"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#what-goes-into-the-document">Document</a> ·
  <a href="#security">Security</a> ·
  <a href="#install">Install</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  Russian text: <a href="README.md">README.md</a>.
</p>

<p align="center">
  <img src="images/screenshot-1-1280x800_v1.png" width="860" alt="Save a conference chat in one click: participant messages and replies go into Word">
</p>

The dion.vc web chat has no built-in history export. The extension walks the open dialog and puts it into a `.docx` file in Downloads.

## Features

<table>
<tr>
<td width="33%" valign="top">

**The whole dialog history**

The message list on the site is virtual: only part of it is in the DOM at one time. The extension scrolls it up and takes messages as they load.

</td>
<td width="33%" valign="top">

**Author and exact time**

Each message has a name and a local time to the second, `DD.MM.YYYY HH:MM:SS`. The time comes from the message timestamp, not from the `10:02` label on the screen.

</td>
<td width="33%" valign="top">

**Text and replies**

Plain text is saved as it is, with line breaks. A reply to a message is a separate line: `↪ author: quote`.

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Images inside the file**

Image attachments are embedded in the document as bytes. The file opens without access to dion.vc.

</td>
<td width="33%" valign="top">

**Name from the chat title**

The file is named `<chat title> YYYY-MM-DD.docx`. Inside are the dialog title and a line with the export time, the message count, and the attachment count.

</td>
<td width="33%" valign="top">

**Progress on the page**

The bottom-right corner shows how many messages are already collected and how many images are being read. While the export runs, the page scrolls by itself.

</td>
</tr>
</table>

The button in the extension window: **Download dialog to DOCX**.

## Quick start

1. Install the extension from the [ready zip](#ready-build) or [build `dist/`](#build-from-source).
2. Open the dialog you need on `dion.vc` under your account.
3. Click the extension icon and **Download dialog to DOCX**.

The file appears in Downloads. If the chat tab was open before installation, reload it.

## What goes into the document

<p align="center">
  <img src="images/screenshot-2-1280x800_v2.png" width="860" alt="The conference chat is on the left, and the same conversation is in DOCX on the right: time, author, text, and reply">
</p>

The document goes from top to bottom, from older messages to newer ones.

```text
Conference chat "Design standup"
Export: 18.10.2026 19:40 · messages: 4 · attachments: 0

[18.10.2026 10:02:00] Anna Kozlova: Hi! Here is the link to the mockups

[18.10.2026 10:04:11] Igor Petrov: Thanks, I opened it
    ↪ Anna Kozlova: Hi! Here is the link to the mockups
```

An image sits directly under its message. If the image bytes could not be read, its place has the line `[attachment unavailable: <id>]`.

The header shows the export time without seconds. Message times are full, in the computer time zone.

## Security

The correspondence stays with you.

- The extension has no server of its own. There is no analytics, no telemetry, and no calls to third-party APIs in the code. Text, authors, and images are not sent anywhere.
- The manifest asks for four things: `downloads` (put the file in Downloads), `offscreen` (make a temporary link to the file: in Manifest V3 the service worker cannot do this itself), `scripting` (start the scraper on an already open tab if the browser did not inject it), and access only to `https://dion.vc/*`. There is no `storage` permission: the extension writes nothing between runs.
- Messages are read from the page that is already open. Images come from `blob:` addresses that the tab itself showed after decryption. The fallback path is to take the pixels from the image already drawn on the same page. The chat history API and direct CDN addresses are not requested.
- The Word file is built in the browser with the `docx` library. The finished bytes move inside the extension: page → service worker → offscreen document → `chrome.downloads`. If this path did not work, the download uses a normal link on the same tab.
- The finished `.docx` is in Downloads on your disk.

## Install

It works in Chrome and in Yandex Browser. Both load the extension unpacked: the project has no Chrome Web Store listing.

### Ready build

Node.js is not required.

1. Take the archive `release/dion-chat-docx-<version>.zip`.
2. Unpack it into a permanent folder. You must not delete or move that folder later: the browser reads the extension directly from there.
3. Open `chrome://extensions` (in Yandex Browser, `browser://extensions`).
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the unpacked folder. `manifest.json` must be inside it.
6. Reload the `dion.vc` tab if it was open earlier.

### Build from source

Node.js is required.

```sh
npm install
npm run build
```

Then follow the same steps in the browser, but at step 5 select the `dist/` folder.

You cannot load the `src/` folder. Its `content.js` contains `import` and does not work as a content script before the build. If such an extension is installed anyway, the button window says directly that the `dist/` folder is required.

### If the export did not start

Open the dialog itself, not the chat list. After you update the extension in `chrome://extensions`, confirm the permissions and reload the tab. If the browser did not inject the scraper itself, the extension installs it on the tab again when you press the button and shows the error text if that also fails.

## Limits

- The file contains the **open** dialog. The chat list on the left is not exported.
- Short dialogs are usually ready in a couple of seconds. A long history takes longer: it must be scrolled to the start.
- Images are saved (`img` with the caption `File …`). Voice messages, video, and files of other types are not included in the document.
- You must be signed in to dion.vc in this browser. Another person's account and a closed tab are not read.
- If dion.vc changes the layout, the selectors in the object `S` in `src/content.js` have to be updated.

## Development

```sh
npm install
npm run build       # dist/
npm run watch       # rebuild on edits
npm run release     # dist/ and release/dion-chat-docx-<version>.zip
npm test            # Chromium: popup → content script → DOCX
npm run test:yandex:dom
```

The version in the archive name comes from `src/manifest.json`. `manifest.json` is at the root of the archive.

The tests run a local dialog, without a Dion account. They check virtual scroll, replies, time, images, and the downloaded DOCX.

Prepare a full run in Yandex Browser once like this:

```sh
npm run setup:yandex
```

In the `chrome://extensions` page that opens, load `dist/` through "Load unpacked", then run `npm run test:yandex`. The profile is separate: `~/.cache/dion-chat-docx/yandex-test`. The normal browser profile is not changed. Another browser or profile path is set with `YANDEX_BINARY` and `YANDEX_PROFILE`.

Notes on the page layout and the scraper are in [`AGENTS.md`](AGENTS.md).
