// Dion Chat → DOCX
// Content script: scrapes the open dion.vc conversation and builds a .docx
// with author, timestamp, text, replies and embedded images.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
} from "docx";

// ---- Selectors (verified against dion.vc chats UI) --------------------------
// Only stable attributes: data-testid / data-* plus structural DOM walking.
// Never hashed CSS-in-JS class names (dion-web-platform-*, e1dx*).
const S = {
  wrapper: "[data-cursor][data-id]",
  item: '[data-testid="chats_message_item"]',
  author: '[data-testid="chats_message_author"]',
  text: '[data-testid="chats_message_text"]',
  time: '[data-testid="chats_message_time"]',
  replyAuthor: '[data-testid="chats_reply_message_author"]',
  replyText: '[data-testid="chats_message_text_reply"]',
  title: '[data-testid="chats_selected_chat_title"]',
  img: 'img[alt^="File"]',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Scraping ---------------------------------------------------------------
// The page has several scrollable lists (sidebar chats, calls, messages).
// The message list is NOT the one marked [data-virtuoso-scroller], so we find
// it as the scrollable ancestor of an actual message.
function getScroller() {
  const anchor = document.querySelector(S.item) || document.querySelector(S.text);
  if (anchor) {
    let node = anchor;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
  }
  for (const el of document.querySelectorAll("div")) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.querySelector(S.text)) return el;
  }
  return null;
}

function extractMessage(wrapper) {
  const item = wrapper.querySelector(S.item);
  if (!item) return null;
  const q = (sel) => wrapper.querySelector(sel);
  const textEl = q(S.text);
  const imgs = [...item.querySelectorAll(S.img)];
  return {
    id: wrapper.getAttribute("data-id"),
    iso: wrapper.getAttribute("data-cursor"),
    author: (q(S.author)?.textContent || "").trim(),
    time: (q(S.time)?.textContent || "").trim(),
    text: textEl ? textEl.innerText.replace(/\u00a0/g, " ").trim() : "",
    replyAuthor: (q(S.replyAuthor)?.textContent || "").trim() || null,
    replyText: (q(S.replyText)?.innerText || "").trim() || null,
    imageUuids: imgs.map((im) => im.alt.replace(/^File /, "")),
  };
}

function collectRendered(messages) {
  for (const w of document.querySelectorAll(S.wrapper)) {
    const id = w.getAttribute("data-id");
    if (!id || messages.has(id)) continue;
    const msg = extractMessage(w);
    if (msg) messages.set(id, msg);
  }
}

// Record the blob: URL of every rendered, already-loaded image.
function recordImages(blobUrls) {
  for (const w of document.querySelectorAll(S.wrapper)) {
    const item = w.querySelector(S.item);
    if (!item) continue;
    for (const img of item.querySelectorAll(S.img)) {
      const uuid = img.alt.replace(/^File /, "");
      if (blobUrls.has(uuid) || !img.src) continue;
      blobUrls.set(uuid, {
        src: img.src,
        w: img.naturalWidth || 0,
        h: img.naturalHeight || 0,
        img,
      });
    }
  }
}

function countPending(messages, blobUrls, failed) {
  let n = 0;
  for (const m of messages.values()) {
    for (const u of m.imageUuids) if (!blobUrls.has(u) && !failed.has(u)) n++;
  }
  return n;
}

// One fast pass: collect all messages and trigger image loading, then wait
// (globally, not per image) for the blobs to appear.
async function collectAll(sc, messages, blobUrls, failed, onProgress) {
  const collect = () => {
    collectRendered(messages);
    recordImages(blobUrls);
  };

  sc.scrollTop = sc.scrollHeight;
  await sleep(150);
  collect();
  onProgress?.(messages.size, blobUrls.size);

  // Scroll up through the whole history, triggering lazy image loads.
  let guard = 0;
  while (guard++ < 4000) {
    collect();
    onProgress?.(messages.size, blobUrls.size);
    if (sc.scrollTop <= 0) break;
    sc.scrollTop = Math.max(0, sc.scrollTop - sc.clientHeight);
    await sleep(90);
  }

  // Make sure we hit the very beginning.
  sc.scrollTop = 0;
  for (let i = 0; i < 3; i++) {
    sc.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -sc.clientHeight, bubbles: true, cancelable: true }),
    );
    await sleep(120);
    collect();
    onProgress?.(messages.size, blobUrls.size);
  }

  // Wait once for all outstanding images (they load in parallel on the page).
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && countPending(messages, blobUrls, failed) > 0) {
    for (const w of document.querySelectorAll(S.wrapper)) {
      const item = w.querySelector(S.item);
      if (!item) continue;
      for (const img of item.querySelectorAll(S.img)) {
        if (!img.src && img.isConnected) {
          try {
            img.scrollIntoView({ block: "center" });
          } catch {}
        }
      }
    }
    await sleep(150);
    collect();
    onProgress?.(messages.size, blobUrls.size);
  }
  collect();

  // Anything still missing after the deadline is treated as unavailable.
  for (const m of messages.values()) {
    for (const u of m.imageUuids) if (!blobUrls.has(u)) failed.add(u);
  }
}

// ---- Image bytes ------------------------------------------------------------
async function convertToPng(imgEl, fallback) {
  try {
    const c = document.createElement("canvas");
    c.width = imgEl?.naturalWidth || fallback.w || 1;
    c.height = imgEl?.naturalHeight || fallback.h || 1;
    c.getContext("2d").drawImage(imgEl, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) return fallback;
    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      type: "image/png",
      w: c.width,
      h: c.height,
    };
  } catch {
    return fallback;
  }
}

async function readImage(entry) {
  try {
    const res = await fetch(entry.src, { credentials: "include" });
    const blob = await res.blob();
    let e = {
      data: new Uint8Array(await blob.arrayBuffer()),
      type: blob.type || "image/png",
      w: entry.w,
      h: entry.h,
    };
    if (!/^image\/(png|jpeg|jpg|gif|bmp)$/i.test(e.type)) e = await convertToPng(entry.img, e);
    return e;
  } catch {
    // Fallback: read pixels straight off the <img> via canvas.
    return await convertToPng(entry.img, {
      data: new Uint8Array(),
      type: "image/png",
      w: entry.w,
      h: entry.h,
    });
  }
}

// Fetch every image concurrently.
async function fetchImages(blobUrls, failed, onProgress) {
  const out = new Map();
  await Promise.all(
    [...blobUrls.entries()].map(async ([uuid, entry]) => {
      try {
        out.set(uuid, await readImage(entry));
      } catch {
        failed.add(uuid);
      }
      onProgress?.(out.size);
    }),
  );
  return out;
}

// ---- DOCX -------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");

function fmtLocal(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || "";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function textRuns(text, size = 22) {
  return String(text)
    .split("\n")
    .map((line, i) => new TextRun({ text: line, size, break: i > 0 ? 1 : undefined }));
}

function imageParagraph(entry) {
  const maxW = 550;
  const maxH = 700;
  let w = entry.w || maxW;
  let h = entry.h || (w ? Math.round(w * 0.66) : maxW);
  let scale = 1;
  if (w > maxW) scale = maxW / w;
  if (h * scale > maxH) scale = maxH / h;
  const type = entry.type.includes("png")
    ? "png"
    : entry.type.includes("gif")
      ? "gif"
      : entry.type.includes("bmp")
        ? "bmp"
        : "jpg";
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    children: [
      new ImageRun({
        type,
        data: entry.data,
        transformation: { width: Math.round(w * scale), height: Math.round(h * scale) },
      }),
    ],
  });
}

async function buildDocx(messages, imagesByUuid, meta) {
  const sorted = [...messages.values()].sort(
    (a, b) => (Date.parse(a.iso) || 0) - (Date.parse(b.iso) || 0),
  );

  const children = [
    new Paragraph({ text: meta.title || "Чат", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Экспорт: ${meta.exportedAt} · сообщений: ${sorted.length} · вложений: ${imagesByUuid.size}`,
          color: "777777",
          size: 18,
        }),
      ],
    }),
  ];

  for (const m of sorted) {
    const runs = [
      new TextRun({ text: `[${fmtLocal(m.iso)}] `, color: "888888", size: 18 }),
      new TextRun({ text: `${m.author || "Неизвестный"}: `, bold: true, size: 22 }),
    ];
    if (m.text) runs.push(...textRuns(m.text));
    children.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: runs }));

    if (m.replyAuthor || m.replyText) {
      children.push(
        new Paragraph({
          spacing: { after: 20 },
          indent: { left: 360 },
          children: [
            new TextRun({
              text: `↪ ${m.replyAuthor || ""}: ${m.replyText || ""}`,
              italics: true,
              color: "666666",
              size: 18,
            }),
          ],
        }),
      );
    }

    for (const uuid of m.imageUuids) {
      const entry = imagesByUuid.get(uuid);
      children.push(
        entry
          ? imageParagraph(entry)
          : new Paragraph({
              spacing: { after: 40 },
              indent: { left: 360 },
              children: [
                new TextRun({ text: `[вложение недоступно: ${uuid}]`, color: "aa0000", size: 18 }),
              ],
            }),
      );
    }
  }

  const doc = new Document({
    creator: "Dion Chat → DOCX",
    title: meta.title || "Чат",
    sections: [{ children }],
  });
  return await Packer.toBlob(doc);
}

// ---- UI / orchestration -----------------------------------------------------
function overlay() {
  let el = document.getElementById("__dion_docx_overlay");
  if (el) return el;
  el = document.createElement("div");
  el.id = "__dion_docx_overlay";
  el.style.cssText =
    "position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:340px;" +
    "background:#202124;color:#fff;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;" +
    "padding:12px 14px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.4);white-space:pre-wrap;";
  document.body.appendChild(el);
  return el;
}

function setStatus(text) {
  const el = overlay();
  el.textContent = text;
  el.style.display = "block";
}

function hideOverlay() {
  const el = document.getElementById("__dion_docx_overlay");
  if (el) el.style.display = "none";
}

function sanitize(name) {
  return (name || "chat").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function runExport() {
  const sc = getScroller();
  if (!sc) {
    setStatus("Не удалось найти список сообщений. Откройте диалог в чатах dion.vc.");
    return { ok: false, error: "scroller-not-found" };
  }

  const messages = new Map();
  const blobUrls = new Map();
  const failed = new Set();

  try {
    setStatus("Сбор сообщений…");
    await collectAll(sc, messages, blobUrls, failed, (m, i) =>
      setStatus(`Сбор сообщений… ${m} шт., картинок ${i}`),
    );

    setStatus("Загрузка картинок…");
    const imagesByUuid = await fetchImages(blobUrls, failed, (n) =>
      setStatus(`Загрузка картинок… ${n}/${blobUrls.size}`),
    );

    const title = (
      document.querySelector(S.title)?.textContent ||
      document.title ||
      "Чат"
    ).trim();
    const now = new Date();
    const meta = {
      title,
      exportedAt: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(
        now.getHours(),
      )}:${pad(now.getMinutes())}`,
    };

    setStatus("Формирование DOCX…");
    const blob = await buildDocx(messages, imagesByUuid, meta);

    const fname = `${sanitize(title)} ${pad(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate(),
    )}.docx`;

    setStatus("Сохранение файла…");
    try {
      const b64 = await blobToBase64(blob);
      const r = await chrome.runtime.sendMessage({ type: "dion-download", base64: b64, filename: fname });
      if (!r?.ok) throw new Error(r?.error || "download-failed");
    } catch (e) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
    }

    setStatus(`Готово: ${fname}\nСообщений: ${messages.size}, вложений: ${imagesByUuid.size}`);
    setTimeout(hideOverlay, 6000);
    return { ok: true, messages: messages.size, images: imagesByUuid.size, filename: fname };
  } catch (e) {
    setStatus(`Ошибка: ${e?.message || e}`);
    return { ok: false, error: String(e) };
  }
}

// ---- Wiring -----------------------------------------------------------------
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "dion-export-docx") {
      runExport().then(sendResponse);
      return true; // async response
    }
  });
}

// Expose for manual/injected testing.
window.__dionExportDocx = runExport;
