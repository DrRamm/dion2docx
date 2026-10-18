import { test, expect, chromium } from '@playwright/test';
import JSZip from 'jszip';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const extensionPath = join(projectRoot, 'dist');
const fixtureHtml = await readFile(new URL('./fixture.html', import.meta.url), 'utf8');
const fixtureUrl = 'https://dion.vc/chats/conversations/00000000-0000-0000-0000-000000000001';
const yandex = process.env.TEST_BROWSER === 'yandex';

async function findDionWorker(context, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const worker of context.serviceWorkers()) {
      try {
        if (await worker.evaluate(() => chrome.runtime.getManifest().name) === 'Dion Chat → DOCX') {
          return worker;
        }
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`service worker Dion не появился за ${timeout} мс`);
}

async function startExtension(pathToExtension = extensionPath) {
  const options = {
    acceptDownloads: true,
    headless: !yandex,
    timezoneId: 'Europe/Moscow',
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  };
  if (yandex) {
    options.executablePath = process.env.YANDEX_BINARY ||
      '/Applications/Yandex.app/Contents/MacOS/Yandex';
  } else {
    options.channel = 'chromium';
  }
  const profile = yandex
    ? process.env.YANDEX_PROFILE || join(homedir(), '.cache', 'dion-chat-docx', 'yandex-test')
    : '';
  const context = await chromium.launchPersistentContext(profile, options);
  try {
    const worker = await findDionWorker(context);
    const extensionId = new URL(worker.url()).host;
    return { context, worker, extensionId };
  } catch (error) {
    await context.close();
    throw new Error(
      `${yandex ? 'Яндекс.Браузер' : 'Chromium'} не загрузил расширение из dist. ` +
      `${yandex ? 'Запустите npm run setup:yandex и добавьте dist через «Load unpacked». ' : ''}` +
      `Проверьте, включено ли оно в тестовом профиле. ${error.message}`,
    );
  }
}

async function openFixture(context) {
  await context.route(fixtureUrl, route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: fixtureHtml,
  }));
  const page = await context.newPage();
  await page.goto(fixtureUrl);
  await expect(page.locator('[data-testid="chats_selected_chat_title"]')).toHaveText('Контрольный диалог');
  return page;
}

async function openActionPopup(context, extensionId, page) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForLoadState();
  // Keep Dion active while invoking the popup's real click handler. Opening
  // popup.html as a tab would otherwise make that extension tab the target.
  await page.bringToFront();
  return popup;
}

test('popup exports a virtualized dialog with replies and images', async () => {
  const { context, worker, extensionId } = await startExtension();
  try {
    const page = await openFixture(context);
    const popup = await openActionPopup(context, extensionId, page);
    await popup.evaluate(() => document.querySelector('#go').click());
    await expect(popup.locator('#status')).toContainText('Сообщений: 6', { timeout: 25_000 });
    await expect(popup.locator('#status')).toContainText('вложений: 2');

    await expect.poll(async () => {
      const results = await worker.evaluate(() => chrome.downloads.search({}));
      return results.find(result => result.byExtensionId === extensionId && result.state === 'complete');
    }, { timeout: 15_000 }).toBeTruthy();
    const downloads = await worker.evaluate(() => chrome.downloads.search({}));
    const completed = downloads.find(result => result.byExtensionId === extensionId && result.state === 'complete');
    expect(completed, 'DOCX должен появиться в загрузках браузера').toBeTruthy();
    const zip = await JSZip.loadAsync(await readFile(completed.filename));
    const xml = await zip.file('word/document.xml').async('string');
    const media = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !name.endsWith('/'));
    expect(media).toHaveLength(2);
    for (const name of media) {
      const bytes = await zip.file(name).async('uint8array');
      expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
    for (const value of ['Первое сообщение', 'Ответ с переносом', 'вторая строка', 'Середина истории', 'Последнее сообщение', 'Анна', 'Борис']) {
      expect(xml).toContain(value);
    }
    expect(xml).toContain('↪ Анна: Первое сообщение');
    expect(xml).toContain('[01.01.2026 12:00:00]');
    expect(xml).toContain('[01.01.2026 12:05:00]');
    expect(xml.indexOf('Первое сообщение')).toBeLessThan(xml.indexOf('Последнее сообщение'));
    expect(xml).not.toContain('вложение недоступно');
    await page.close();
  } finally {
    await context.close();
  }
});

test('Yandex runs the scraper on the same virtualized dialog', async () => {
  test.skip(!yandex);
  const context = await chromium.launchPersistentContext('', {
    executablePath: process.env.YANDEX_BINARY || '/Applications/Yandex.app/Contents/MacOS/Yandex',
    headless: false,
    acceptDownloads: true,
    timezoneId: 'Europe/Moscow',
  });
  try {
    const page = await openFixture(context);
    await page.addScriptTag({ path: join(extensionPath, 'content.js') });
    const downloadPromise = page.waitForEvent('download');
    const result = await page.evaluate(() => window.__dionExportDocx());
    expect(result).toMatchObject({ ok: true, messages: 6, images: 2 });
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const zip = await JSZip.loadAsync(await readFile(await download.path()));
    expect(Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !name.endsWith('/'))).toHaveLength(2);
  } finally {
    await context.close();
  }
});

test('popup injects the scraper when automatic content-script loading is absent', async () => {
  test.skip(yandex, 'В Яндексе используется установленное расширение из тестового профиля');
  const temp = await mkdtemp(join(tmpdir(), 'dion-no-content-script-'));
  const pathToExtension = join(temp, 'dist');
  let context;
  try {
    await cp(extensionPath, pathToExtension, { recursive: true });
    const manifestPath = join(pathToExtension, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.content_scripts = [];
    await writeFile(manifestPath, JSON.stringify(manifest));

    const started = await startExtension(pathToExtension);
    context = started.context;
    const page = await openFixture(context);
    const popup = await openActionPopup(context, started.extensionId, page);
    await popup.evaluate(() => document.querySelector('#go').click());
    await expect(popup.locator('#status')).toContainText('Сообщений: 6', { timeout: 25_000 });
    await expect(popup.locator('#status')).toContainText('вложений: 2');
  } finally {
    await context?.close();
    await rm(temp, { recursive: true, force: true });
  }
});

test('popup explains that the unbuilt src folder cannot be installed', async () => {
  test.skip(yandex, 'В Яндексе используется установленное расширение из тестового профиля');
  const { context, extensionId } = await startExtension(join(projectRoot, 'src'));
  try {
    const page = await openFixture(context);
    const popup = await openActionPopup(context, extensionId, page);
    await popup.evaluate(() => document.querySelector('#go').click());
    await expect(popup.locator('#status')).toContainText('Установлена папка src/');
    await expect(popup.locator('#status')).toContainText('загрузите папку dist/');
  } finally {
    await context.close();
  }
});

test('popup reports injection failure outside Dion', async () => {
  const { context, worker, extensionId } = await startExtension();
  try {
    const page = await context.newPage();
    await page.goto('https://example.com');
    const popup = await openActionPopup(context, extensionId, page);
    await popup.evaluate(() => document.querySelector('#go').click());
    await expect(popup.locator('#status')).toContainText('Не удалось запустить скрипт');
  } finally {
    await context.close();
  }
});
