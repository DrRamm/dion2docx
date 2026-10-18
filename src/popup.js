const go = document.getElementById("go");
const status = document.getElementById("status");

function showStatus(message) {
  status.textContent = message;
  document.body.classList.add("has-status");
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
    const res = await chrome.tabs.sendMessage(tab.id, { type: "dion-export-docx" });
    if (res?.ok) {
      showStatus(`Готово: ${res.filename}\nСообщений: ${res.messages}, вложений: ${res.images}`);
    } else {
      showStatus(`Не удалось: ${res?.error || "нет ответа"}.\nОткройте диалог на dion.vc и попробуйте снова.`);
    }
  } catch (e) {
    showStatus("Расширение не видит страницу. Откройте вкладку dion.vc и обновите её (F5), затем повторите.");
  } finally {
    go.disabled = false;
  }
});
