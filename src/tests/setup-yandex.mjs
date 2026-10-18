import { chromium } from '@playwright/test';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const profile = process.env.YANDEX_PROFILE || join(homedir(), '.cache', 'dion-chat-docx', 'yandex-test');
const executablePath = process.env.YANDEX_BINARY || '/Applications/Yandex.app/Contents/MacOS/Yandex';
const extensionPath = resolve('dist');
const context = await chromium.launchPersistentContext(profile, { executablePath, headless: false });

try {
  const page = await context.newPage();
  await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
  console.log(`Профиль: ${profile}`);
  console.log(`Включите режим разработчика и загрузите распакованное расширение из: ${extensionPath}`);
  console.log('После появления расширения окно закроется автоматически.');
  const deadline = Date.now() + 300_000;
  let found = false;
  while (Date.now() < deadline && !found) {
    for (const worker of context.serviceWorkers()) {
      try {
        if (await worker.evaluate(() => chrome.runtime.getManifest().name) === 'Dion Chat → DOCX') {
          console.log(`Расширение загружено: ${worker.url()}`);
          found = true;
          break;
        }
      } catch {}
    }
    if (!found) await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!found) throw new Error('Расширение не появилось за 5 минут. Проверьте установку в chrome://extensions/.');
} finally {
  await context.close();
}
