const go = document.getElementById("go");
const status = document.getElementById("status");
const exportRequest = { type: "dion-export-docx" };

function showStatus(message) {
  status.textContent = message;
  document.body.classList.add("has-status");
}

async function hasUnbuiltContentScript() {
  try {
    const response = await fetch(chrome.runtime.getURL("content.js"));
    const start = (await response.text()).slice(0, 512);
    return /^\s*import\s/m.test(start);
  } catch {
    return false;
  }
}

async function sendExport(tab) {
  try {
    return await chrome.tabs.sendMessage(tab.id, exportRequest);
  } catch (e) {
    if (!/Receiving end does not exist/i.test(String(e?.message || e))) throw e;
  }

  if (await hasUnbuiltContentScript()) {
    throw new Error("Установлена папка src/ с несобранным content.js. Выполните npm run build и загрузите папку dist/ в браузер.");
  }

  showStatus("Подключение к вкладке Dion…");
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (e) {
    throw new Error(`Не удалось запустить скрипт на вкладке ${tab.url || `#${tab.id}`}: ${e?.message || e}`);
  }
  return await chrome.tabs.sendMessage(tab.id, exportRequest);
}

go.addEventListener("click", async () => {
  go.disabled = true;
  showStatus("Запущено. Прогресс — в правом нижнем углу страницы.");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showStatus("Не найдена активная вкладка.");
      return;
    }
    const res = await sendExport(tab);
    if (res?.ok) {
      showStatus(`Готово: ${res.filename}\nСообщений: ${res.messages}, вложений: ${res.images}`);
    } else {
      showStatus(`Не удалось: ${res?.error || "нет ответа"}.\nОткройте диалог на dion.vc и попробуйте снова.`);
    }
  } catch (e) {
    showStatus(`Не удалось экспортировать диалог: ${e?.message || e}`);
  } finally {
    go.disabled = false;
  }
});
