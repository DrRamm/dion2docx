// Offscreen document: only place in MV3 where URL.createObjectURL works.
// Builds a blob URL for the DOCX bytes so the service worker can download it.

const cache = new Map();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "dion-offscreen-blob") {
    try {
      const bin = atob(msg.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      cache.set(url, blob);
      sendResponse({ url });
    } catch (e) {
      sendResponse({ error: String(e) });
    }
    return true;
  }
  if (msg?.type === "dion-offscreen-revoke") {
    try {
      URL.revokeObjectURL(msg.url);
    } catch {}
    cache.delete(msg.url);
    sendResponse({ ok: true });
    return true;
  }
});
