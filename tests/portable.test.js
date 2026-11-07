#!/usr/bin/env node
/* Cross-browser smoke: local editor, help, editable export and the viewer without the editor. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const pw = require('playwright');
const engine = process.env.MOTHERSHIP_TEST_BROWSER || 'chromium';
const root = path.resolve(__dirname, '..');

(async () => {
  const executablePath = engine === 'chromium' ? process.env.CHROMIUM_PATH : undefined;
  const browser = await pw[engine].launch(executablePath ? { executablePath } : {});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-portable-'));
  try {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1280, height: 860 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'dist/mothership-standalone.html')).href);
    await page.getByRole('button', { name: 'Start here', exact: true }).click();
    assert.equal(await page.locator('.workflow-step').count(), 5);
    await page.keyboard.press('Escape');
    await page.evaluate(() => MS.openHtml('<title>Portable</title><h1>Before</h1><p>Report body</p>', 'portable.html'));
    const child = page.frameLocator('#child');
    await child.locator('h1').dblclick();
    await child.locator('h1').fill('After export');
    await child.locator('p').click();
    assert.equal(await page.evaluate(() => MS.dirty), true);
    // Force the supported download fallback even when a browser has its own file picker.
    await page.evaluate(() => { window.showSaveFilePicker = undefined; });
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.locator('#btn-export').click()
    ]);
    const saved = path.join(dir, download.suggestedFilename());
    await download.saveAs(saved);
    const view = await browser.newPage();
    await view.goto(pathToFileURL(saved).href);
    assert.equal(await view.locator('h1').innerText(), 'After export');
    assert.equal(await view.locator('#appbar').count(), 0);
    const html = fs.readFileSync(saved, 'utf8');
    await page.evaluate(h => MS.openHtml(h, 'reopen.html'), html);
    assert.equal(await child.locator('h1').innerText(), 'After export');
    assert.deepEqual(errors, []);
    console.log('Standalone editing, help and download round trip passed in ' + engine);
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
