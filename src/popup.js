const go = document.getElementById("go");
const status = document.getElementById("status");

go.addEventListener("click", async () => {
  go.disabled = true;
  status.textContent = "Запущено. Прогресс — в правом нижнем углу страницы.";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    status.textContent = "Не найдена активная вкладка.";
    go.disabled = false;
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "dion-export-docx" });
    if (res?.ok) {
      status.textContent = `Готово: ${res.filename}\nСообщений: ${res.messages}, вложений: ${res.images}`;
    } else {
      status.textContent = `Не удалось: ${res?.error || "нет ответа"}.\nОткройте диалог на dion.vc и попробуйте снова.`;
    }
  } catch (e) {
    status.textContent =
      "Расширение не видит страницу. Откройте вкладку dion.vc и обновите её (F5), затем повторите.";
  } finally {
    go.disabled = false;
  }
});
