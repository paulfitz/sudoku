#!/usr/bin/env node
/* drive.js — a tiny Chrome DevTools Protocol driver, for checking the interactive parts.
 *
 * Headless --screenshot can only capture the initial render, which is useless for a site
 * whose whole point is what happens after you click. This drives a real browser: click
 * things, read the DOM back, screenshot, and fail on any console error.
 *
 *   node tools/drive.js <script.js> [outdir]
 *
 * The script file exports an async function (page) => {} where page has:
 *   goto(hash), click(selector), clickText(text), eval(expr), text(selector),
 *   shot(name), waitFor(selector)
 */
'use strict';

var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');

var SITE = 'file://' + path.join(__dirname, '..', 'site', 'index.html');
var PORT = 9223;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function launch() {
  var dir = fs.mkdtempSync('/tmp/cdp-profile-');
  var chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + dir,
    '--window-size=1280,1600',
    '--hide-scrollbars',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  for (var i = 0; i < 100; i++) {
    try {
      var res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      var tabs = await res.json();
      var page = tabs.filter(function (t) { return t.type === 'page'; })[0];
      if (page) return { chrome: chrome, wsUrl: page.webSocketDebuggerUrl, dir: dir };
    } catch (e) { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('chrome did not start');
}

async function connect(wsUrl) {
  var ws = new WebSocket(wsUrl);
  var id = 0, pending = new Map(), events = [];
  await new Promise(function (r, j) { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = function (m) {
    var msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      var p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };
  function send(method, params) {
    return new Promise(function (resolve, reject) {
      var mid = ++id;
      pending.set(mid, { resolve: resolve, reject: reject });
      ws.send(JSON.stringify({ id: mid, method: method, params: params || {} }));
    });
  }
  return { send: send, events: events, ws: ws };
}

async function main() {
  var scriptPath = process.argv[2];
  var outDir = process.argv[3] || '.';
  if (!scriptPath) { console.error('usage: drive.js <script.js> [outdir]'); process.exit(2); }
  var testFn = require(path.resolve(scriptPath));

  var { chrome, wsUrl, dir } = await launch();
  var cdp = await connect(wsUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  if (process.env.COLOR_SCHEME) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME }] });
  if (process.env.VIEWPORT) {
    var wh = process.env.VIEWPORT.split('x').map(Number);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: wh[0], height: wh[1], deviceScaleFactor: 2, mobile: true
    });
  }

  var problems = [];
  cdp.events.length = 0;

  function drainConsole(where) {
    cdp.events.forEach(function (e) {
      if (e.method === 'Runtime.exceptionThrown') {
        var d = e.params.exceptionDetails;
        problems.push('[' + where + '] EXCEPTION: ' +
          (d.exception && d.exception.description || d.text));
      } else if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') {
        problems.push('[' + where + '] console error: ' + e.params.entry.text);
      } else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
        problems.push('[' + where + '] console.error: ' +
          e.params.args.map(function (a) { return a.value || a.description; }).join(' '));
      }
    });
    cdp.events.length = 0;
  }

  async function evaluate(expr) {
    var r = await cdp.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error('eval failed: ' + (r.exceptionDetails.exception &&
        r.exceptionDetails.exception.description || r.exceptionDetails.text) + '\n  ' + expr);
    }
    return r.result.value;
  }

  var page = {
    async goto(hash) {
      await cdp.send('Page.navigate', { url: SITE + (hash || '') });
      await sleep(700);
      drainConsole('load ' + hash);
    },
    async hash(h) {
      // Setting location.hash to its current value fires no hashchange, so the page keeps
      // whatever state the last test left it in. Bounce via '#/' so a re-visit always
      // re-renders — otherwise check modules silently depend on each other's ordering.
      await evaluate(
        '(function(){ if (location.hash === ' + JSON.stringify(h) + ') location.hash = "#/";' +
        ' location.hash = ' + JSON.stringify(h) + '; })()');
      await sleep(350);
      drainConsole('hash ' + h);
    },
    eval: evaluate,
    async click(sel) {
      var ok = await evaluate(
        '(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');' +
        'if(!e) return false; e.click(); return true;})()');
      if (!ok) throw new Error('no element for ' + sel);
      await sleep(220);
      drainConsole('click ' + sel);
    },
    async clickText(sel, text) {
      var ok = await evaluate(
        '(function(){var es=[].slice.call(document.querySelectorAll(' + JSON.stringify(sel) + '));' +
        'var e=es.filter(function(x){return x.textContent.trim().indexOf(' +
        JSON.stringify(text) + ')>=0;})[0]; if(!e) return false; e.click(); return true;})()');
      if (!ok) throw new Error('no ' + sel + ' containing "' + text + '"');
      await sleep(220);
      drainConsole('clickText ' + text);
    },
    text(sel) {
      return evaluate('(document.querySelector(' + JSON.stringify(sel) +
        ')||{}).textContent || null');
    },
    count(sel) {
      return evaluate('document.querySelectorAll(' + JSON.stringify(sel) + ').length');
    },
    async shot(name) {
      var r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      var f = path.join(outDir, name + '.png');
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      return f;
    },
    fail(msg) { problems.push('[assert] ' + msg); },
    log(msg) { console.log('  ' + msg); }
  };

  try {
    await testFn(page);
  } catch (err) {
    problems.push('[fatal] ' + err.message + '\n' + (err.stack || '').split('\n').slice(1, 3).join('\n'));
  }
  drainConsole('end');

  cdp.ws.close();
  chrome.kill();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}

  if (problems.length) {
    console.error('\n' + problems.length + ' PROBLEM(S):\n');
    problems.forEach(function (p) { console.error('  ' + p + '\n'); });
    process.exit(1);
  }
  console.log('\nno console errors, all assertions passed.');
}

main().catch(function (e) { console.error(e); process.exit(1); });
