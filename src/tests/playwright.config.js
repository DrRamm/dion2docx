import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 45_000,
  workers: 1,
  reporter: 'list',
});
