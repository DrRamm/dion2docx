# DOM facts for dion.vc chats

Read this file when you change selectors, scroll, message fields, or images.

The UI is React, MUI, and react-virtuoso. The clock on the page is local. Message metadata is UTC.

## Page

The dialog page is `https://dion.vc/chats/conversations/<uuid>`.

## Message nodes

Each message has one wrapper: `[data-cursor][data-id]`.

- `data-id` is the message id.
- `data-cursor` is ISO-8601 UTC. Example: `2026-01-01T12:00:00.000000Z`.

The wrapper contains `[data-testid="chats_message_item"]`.

| Test id | Content |
| --- | --- |
| `chats_message_author` | Author text |
| `chats_message_text` | Text, links, and `<br>`. It also has `data-message-id`. |
| `chats_message_time` | Local time as `HH:MM` |
| `chats_message_text_reply` | Reply text |
| `chats_reply_message_author` | Reply author |

The date divider is `[data-testid="messagesDate"]`. Example text: `16 Oct`.
The dialog title is `[data-testid="chats_selected_chat_title"]`.
An image is `img[alt^="File"]`. The file id is the `alt` text after the prefix `File `.

Keep these selectors in the object `S` at the top of `src/content.js`.

## Scroll

The page has more than one scroll list.
`[data-virtuoso-scroller]` is the chat list in the sidebar. It is not the message list.
Find the message list from a message node.
Go to the nearest parent with `overflow-y: auto` or `overflow-y: scroll`, and with `scrollHeight > clientHeight`.

Old messages load when you scroll toward the top.
For a full history, set `scrollTop` to `0` and send the wheel event a few times.
The message count is stable only after the list reaches the top. The first message is the top message.

The list is virtualized. The page reuses the nodes.
Do not keep element references across a scroll. Read the nodes from the DOM again.

## Images

`https://photo-delivery.dion.vc/v1/file/<uuid>` returns 404.
The bytes are a `blob:` URL on `img.src` after the node is near the viewport.
Read them with `fetch(img.src)`. When that fails, copy the canvas to a PNG.
`scrollIntoView` redraws the list and detaches neighbor nodes.
Check `img.isConnected`. Do not mark a detached node as a broken file.

## History API

Do not call the history API.
`GET chats-api.dion.vc/v1/conversations/<id>/history` returns 428.
The body is `{"code":1903,"message":"Не предоставлен ID сессии шифрования"}`.
The call needs an encryption session. Read the open page instead.
