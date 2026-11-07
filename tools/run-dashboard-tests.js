#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const editor = path.join(root, 'dist', 'mothership-standalone.html');

function parseArgs(args) {
  if (!args.length || args.includes('--help')) {
    console.log('Usage: npm run test:isolated -- JOB.json [--timeout SECONDS] [--out RESULTS.json]');
    return null;
  }
  const jobFile = path.resolve(args[0]);
  let timeout = 120, out = jobFile.replace(/\.json$/i, '') + ' - results.json';
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!value || !['--timeout', '--out'].includes(flag)) throw new Error('Use --timeout SECONDS or --out RESULTS.json.');
    if (flag === '--timeout') timeout = Number(value);
    else out = path.resolve(value);
  }
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1800) throw new Error('Timeout must be between 1 and 1800 seconds.');
  return { jobFile, out, timeout };
}

async function readJob(file) {
  const job = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!job || job.$type !== 'mothership/isolated-job' || job.v !== 1 || typeof job.id !== 'string' ||
      typeof job.html !== 'string' || !Array.isArray(job.ids) || !job.ids.length || job.ids.length > 10000 ||
      job.ids.some(id => typeof id !== 'string') || new Set(job.ids).size !== job.ids.length ||
      !['all', 'smoke'].includes(job.scope)) throw new Error('Choose an isolated job exported from Mothership.');
  if (createHash('sha256').update(job.html).digest('hex') !== job.payloadHash) throw new Error('The dashboard inside this job has changed. Export a new job.');
  return job;
}

async function run(job, seconds) {
  // launchServer owns an independent Chromium process. Kill it from Node even
  // if dashboard JavaScript is busy and its browser cannot answer Playwright.
  const executablePath = process.env.CHROMIUM_PATH;
  const server = await chromium.launchServer({ host: '127.0.0.1', ...(executablePath ? { executablePath } : {}) });
  const ids = new Set(job.ids), outcomes = new Map(), started = Date.now();
  let timer, timedOut = false, finished;
  try {
    const work = (async () => {
      const browser = await chromium.connect(server.wsEndpoint());
      const context = await browser.newContext({ offline: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.exposeBinding('msIsolatedResult', (_source, result) => {
        if (!result || !ids.has(result.id) || result.status === 'Stopped') return;
        outcomes.set(result.id, result);
        process.stderr.write('[' + outcomes.size + '/' + ids.size + '] ' + result.id + ' ' + result.status + '\n');
      });
      await page.goto(pathToFileURL(editor).href);
      return page.evaluate(async ({ html, dashboard, ids, scope }) => {
        MS.settings.netLock = true;
        await MS.openHtml(html, dashboard, { force: true, nonInteractive: true });
        if (!MS.rt() || ids.some(id => !MS.qa.get(id))) throw new Error('The dashboard or its test plan could not be opened.');
        const stop = MS.on('qa-run', event => {
          if (event.phase === 'result') window.msIsolatedResult(event.result).catch(() => {});
        });
        try { return await MS.qa.run(ids, { scope }); }
        finally { stop(); }
      }, job);
    })();
    finished = await Promise.race([work, new Promise(resolve => {
      timer = setTimeout(() => { timedOut = true; resolve(null); }, seconds * 1000);
    })]);
  } finally {
    clearTimeout(timer);
    await server.kill();
  }
  if (finished) for (const result of finished) outcomes.set(result.id, result);
  return {
    $type: 'mothership/isolated-results', v: 1, id: job.id, revision: job.revision, scope: job.scope, ids: job.ids,
    definitionsHash: job.definitionsHash, snapshotHash: job.snapshotHash,
    stopped: timedOut || outcomes.size !== ids.size, ms: Date.now() - started,
    results: job.ids.filter(id => outcomes.has(id)).map(id => outcomes.get(id))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return;
  const job = await readJob(args.jobFile);
  await fs.access(editor);
  const results = await run(job, args.timeout);
  await fs.writeFile(args.out, JSON.stringify(results, null, 2), { encoding: 'utf8', flag: 'wx' });
  console.log((results.stopped ? 'Run stopped. Completed results saved to ' : 'Results saved to ') + args.out);
  if (results.stopped) process.exitCode = 2;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
