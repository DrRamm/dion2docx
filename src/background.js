// Service worker: receives the finished DOCX (base64) from the content script,
// turns it into a blob URL via an offscreen document and downloads it with the
// chrome.downloads API (reliable, no "automatic download" prompts).

const OFFSCREEN_PATH = "offscreen.html";

async function ensureOffscreen() {
  if (chrome.offscreen?.hasDocument && (await chrome.offscreen.hasDocument())) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["BLOBS"],
      justification: "Создание blob-URL для скачивания сформированного DOCX.",
    });
  } catch (e) {
    // Already exists — ignore.
  }
}

async function handleDownload({ base64, filename }) {
  await ensureOffscreen();
  const r = await chrome.runtime.sendMessage({ type: "dion-offscreen-blob", base64 });
  if (!r?.url) throw new Error("Не удалось создать blob-URL.");
  const downloadId = await chrome.downloads.download({ url: r.url, filename, saveAs: false });
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: "dion-offscreen-revoke", url: r.url }).catch(() => {});
  }, 120000);
  return { ok: true, downloadId };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "dion-download") {
    handleDownload(msg)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true; // async response
  }
});
