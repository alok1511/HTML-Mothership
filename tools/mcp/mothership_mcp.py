#!/usr/bin/env python3
"""
Mothership MCP server for Python (stdio). The same tools as tools/mcp/mothership-mcp.js,
for laptops that have Python but not Node.js.

Standard library only: no pip install. Python 3.8 or newer.
It starts Edge or Chrome with the DevTools protocol, opens mothership.html and calls
MS.api inside the page, so every feature works exactly as it does when you click.

    python tools/mcp/mothership_mcp.py

Settings (environment variables, all optional):
    MOTHERSHIP_BROWSER   path to msedge.exe / chrome.exe (found automatically otherwise)
    MOTHERSHIP_HEADLESS  0 = show the browser window so you can watch (default 1 = hidden)
    MOTHERSHIP_ATTACH    DevTools port (e.g. 9222) of a browser you started yourself with
                         --remote-debugging-port=9222; edits then happen in your window
    MOTHERSHIP_HTML      which editor file to open (default: mothership.html two folders up)
    MOTHERSHIP_OUT       folder for saved files when no path is given (default: current folder)
"""
import base64
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request

VERSION = '2.9.0'
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
EDITOR = os.path.abspath(os.environ.get('MOTHERSHIP_HTML') or os.path.join(ROOT, 'mothership.html'))
OUT = os.path.abspath(os.environ.get('MOTHERSHIP_OUT') or os.getcwd())
HEADLESS = os.environ.get('MOTHERSHIP_HEADLESS', '1') != '0'


def log(*a):
    sys.stderr.write('[mothership-mcp] ' + ' '.join(str(x) for x in a) + '\n')
    sys.stderr.flush()


class ToolError(Exception):
    pass


# --------------------------------------------------------------------------- WebSocket client (RFC 6455)
class WebSocket:
    def __init__(self, url):
        u = urllib.parse.urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port or 80), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        path = u.path + ('?' + u.query if u.query else '')
        req = ('GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
               'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n') % (path, u.netloc, key)
        self.sock.sendall(req.encode())
        head = b''
        while b'\r\n\r\n' not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ToolError('DevTools closed the connection.')
            head += chunk
        status, _, rest = head.partition(b'\r\n\r\n')
        if not status.startswith(b'HTTP/1.1 101'):
            raise ToolError('DevTools refused the connection: ' + status.split(b'\r\n')[0].decode('latin-1'))
        self.buf = rest
        self.sock.settimeout(None)
        self.lock = threading.Lock()

    def send(self, text):
        data = text.encode('utf-8')
        n = len(data)
        if n < 126:
            hdr = struct.pack('!BB', 0x81, 0x80 | n)
        elif n < 65536:
            hdr = struct.pack('!BBH', 0x81, 0x80 | 126, n)
        else:
            hdr = struct.pack('!BBQ', 0x81, 0x80 | 127, n)
        mask = os.urandom(4)
        body = bytes(b ^ mask[i & 3] for i, b in enumerate(data)) if n < 4096 else _mask_fast(data, mask)
        with self.lock:
            self.sock.sendall(hdr + mask + body)

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(max(65536, n - len(self.buf)))
            if not chunk:
                raise EOFError('The browser closed.')
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        parts = []
        while True:
            b0, b1 = self._read(2)
            fin, op, masked, n = b0 & 0x80, b0 & 0x0F, b1 & 0x80, b1 & 0x7F
            if n == 126:
                n = struct.unpack('!H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('!Q', self._read(8))[0]
            mask = self._read(4) if masked else None
            payload = self._read(n)
            if mask:
                payload = _mask_fast(payload, mask)
            if op == 9:   # ping
                with self.lock:
                    self.sock.sendall(struct.pack('!BB', 0x8A, 0x80 | len(payload)) + b'\0\0\0\0' + payload)
                continue
            if op == 8:
                raise EOFError('The browser closed.')
            parts.append(payload)
            if fin:
                return b''.join(parts).decode('utf-8')

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def _mask_fast(data, mask):
    m = int.from_bytes((mask * (len(data) // 4 + 1))[:len(data)], 'big')
    return (int.from_bytes(data, 'big') ^ m).to_bytes(len(data), 'big') if data else b''


# --------------------------------------------------------------------------- DevTools protocol
class Browser:
    def __init__(self):
        self.ws = None
        self.session = None
        self.proc = None
        self.profile = None
        self.exe = None
        self.mode = None
        self.error = None
        self.id = 0
        self.pending = {}
        self.cond = threading.Condition()
        self.start_lock = threading.Lock()

    # -- plumbing
    def _reader(self):
        try:
            while True:
                msg = json.loads(self.ws.recv())
                if 'id' in msg:
                    with self.cond:
                        self.pending[msg['id']] = msg
                        self.cond.notify_all()
                elif msg.get('method') == 'Page.javascriptDialogOpening':
                    # never let an alert/confirm in the page block the assistant
                    threading.Thread(target=lambda s=msg.get('sessionId'): self._safe('Page.handleJavaScriptDialog', {'accept': True}, s), daemon=True).start()
                elif msg.get('method') == 'Target.detachedFromTarget' and msg.get('params', {}).get('sessionId') == self.session:
                    self.session = None
        except (EOFError, OSError, ValueError):
            pass
        finally:
            with self.cond:
                self.ws = None
                self.session = None
                self.cond.notify_all()

    def _safe(self, method, params, session):
        try:
            self.cdp(method, params, session)
        except Exception:
            pass

    def cdp(self, method, params=None, session='default', timeout=120):
        if not self.ws:
            raise ToolError('The browser is not connected.')
        with self.cond:
            self.id += 1
            mid = self.id
        msg = {'id': mid, 'method': method, 'params': params or {}}
        sid = self.session if session == 'default' else session
        if sid:
            msg['sessionId'] = sid
        self.ws.send(json.dumps(msg))
        end = time.time() + timeout
        with self.cond:
            while mid not in self.pending:
                if not self.ws:
                    raise ToolError('The browser closed.')
                left = end - time.time()
                if left <= 0:
                    raise ToolError(method + ' timed out.')
                self.cond.wait(min(left, 1.0))
            res = self.pending.pop(mid)
        if 'error' in res:
            raise ToolError(method + ': ' + res['error'].get('message', 'error'))
        return res.get('result', {})

    def connect(self, ws_url):
        self.ws = WebSocket(ws_url)
        threading.Thread(target=self._reader, daemon=True).start()

    # -- starting
    def find_browser(self):
        c = [os.environ.get('MOTHERSHIP_BROWSER'), os.environ.get('CHROMIUM_PATH')]
        if sys.platform == 'win32':
            pf = os.environ.get('ProgramFiles', r'C:\Program Files')
            pf86 = os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')
            la = os.environ.get('LOCALAPPDATA', '')
            c += [os.path.join(pf86, r'Microsoft\Edge\Application\msedge.exe'), os.path.join(pf, r'Microsoft\Edge\Application\msedge.exe'),
                  os.path.join(pf, r'Google\Chrome\Application\chrome.exe'), os.path.join(pf86, r'Google\Chrome\Application\chrome.exe'),
                  la and os.path.join(la, r'Google\Chrome\Application\chrome.exe'), la and os.path.join(la, r'Microsoft\Edge\Application\msedge.exe')]
        elif sys.platform == 'darwin':
            c += ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                  os.path.expanduser('~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), '/Applications/Chromium.app/Contents/MacOS/Chromium']
        else:
            c += ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
                  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/pw-browsers/chromium']
            for name in ('microsoft-edge', 'google-chrome', 'chromium', 'chromium-browser'):
                w = shutil.which(name)
                if w:
                    c.append(w)
        for p in c:
            if p and os.path.isfile(p):
                return p
        return None

    def launch(self):
        self.exe = self.find_browser()
        if not self.exe:
            raise ToolError('Could not find Microsoft Edge or Google Chrome. Set MOTHERSHIP_BROWSER to the full path of msedge.exe or chrome.exe.')
        self.profile = tempfile.mkdtemp(prefix='mothership-mcp-')
        args = [self.exe, '--remote-debugging-port=0', '--user-data-dir=' + self.profile, '--no-first-run', '--no-default-browser-check',
                '--disable-extensions', '--allow-file-access-from-files', '--window-size=1440,900']
        if HEADLESS:
            args += ['--headless=new', '--hide-scrollbars']
        if sys.platform.startswith('linux') and hasattr(os, 'geteuid') and os.geteuid() == 0:
            args.append('--no-sandbox')
        args.append('about:blank')
        flags = 0x08000000 if sys.platform == 'win32' else 0   # CREATE_NO_WINDOW
        self.proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
        port_file = os.path.join(self.profile, 'DevToolsActivePort')
        end = time.time() + 30
        while time.time() < end:
            if self.proc.poll() is not None:
                raise ToolError('The browser closed straight away (%s).' % self.exe)
            try:
                with open(port_file) as f:
                    lines = f.read().split('\n')
                if len(lines) >= 2 and lines[0].strip():
                    return self.connect('ws://127.0.0.1:%s%s' % (lines[0].strip(), lines[1].strip()))
            except OSError:
                pass
            time.sleep(0.15)
        raise ToolError('The browser did not start within 30 seconds (%s).' % self.exe)

    def attach(self, port):
        with urllib.request.urlopen('http://127.0.0.1:%d/json/version' % port, timeout=10) as r:
            v = json.loads(r.read().decode())
        self.connect(v['webSocketDebuggerUrl'])

    def editor_url(self):
        p = EDITOR.replace('\\', '/')
        if not p.startswith('/'):
            p = '/' + p
        return 'file://' + urllib.parse.quote(p, safe='/:')

    def open_editor(self):
        base = os.path.basename(EDITOR).lower()
        targets = self.cdp('Target.getTargets', session=None)['targetInfos']
        hit = [t for t in targets if t['type'] == 'page' and base in urllib.parse.unquote(t['url']).lower()]
        if hit:
            tid = hit[0]['targetId']
        else:
            blank = [t for t in targets if t['type'] == 'page'] if self.mode == 'launched' else []
            if blank:
                tid = blank[0]['targetId']
                a = self.cdp('Target.attachToTarget', {'targetId': tid, 'flatten': True}, session=None)
                self.cdp('Page.navigate', {'url': self.editor_url()}, session=a['sessionId'])
                self.cdp('Target.detachFromTarget', {'sessionId': a['sessionId']}, session=None)
            else:
                tid = self.cdp('Target.createTarget', {'url': self.editor_url()}, session=None)['targetId']
        self.session = self.cdp('Target.attachToTarget', {'targetId': tid, 'flatten': True}, session=None)['sessionId']
        self.cdp('Page.enable')
        try:
            self.cdp('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
        except ToolError:
            pass
        end = time.time() + 30
        while time.time() < end:
            if self.evaluate('typeof MS !== "undefined" && !!MS.api && !!MS.view'):
                return
            time.sleep(0.2)
        raise ToolError('Mothership did not load from ' + EDITOR)

    def ensure(self):
        if self.ws and self.session:
            return
        with self.start_lock:
            if self.ws and self.session:
                return
            try:
                if not self.ws:
                    port = os.environ.get('MOTHERSHIP_ATTACH')
                    if port:
                        self.mode = 'attached'
                        self.attach(int(port))
                    else:
                        if not os.path.isfile(EDITOR):
                            raise ToolError('Mothership editor not found at %s. Set MOTHERSHIP_HTML.' % EDITOR)
                        self.mode = 'launched'
                        self.launch()
                self.open_editor()
                self.error = None
                log('ready (%s%s)' % (self.mode, ', ' + self.exe if self.exe else ''))
            except Exception as e:
                self.error = str(e)
                raise

    def evaluate(self, expr):
        r = self.cdp('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True})
        if r.get('exceptionDetails'):
            ex = r['exceptionDetails'].get('exception') or {}
            text = ex.get('description') or ex.get('value') or r['exceptionDetails'].get('text') or 'Error'
            raise ToolError(str(text).split('\n')[0].replace('Error: ', '', 1))
        return r.get('result', {}).get('value')

    def api(self, name, args=None):
        self.ensure()
        s = self.evaluate('(async function () { var v = await MS.api.run(%s, %s); return JSON.stringify(v === undefined ? { ok: true } : v); })()'
                          % (json.dumps(name), json.dumps(args or {})))
        return {'ok': True} if s is None else json.loads(s)

    def shutdown(self):
        if self.ws:
            self.ws.close()
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
                self.proc.wait(5)
            except Exception:
                pass
        if self.profile:
            shutil.rmtree(self.profile, ignore_errors=True)


B = Browser()


# --------------------------------------------------------------------------- files
def resolve_path(p):
    if not p:
        raise ToolError('Give a file path.')
    return os.path.abspath(os.path.expanduser(p))


def b64file(p, rel=None):
    full = resolve_path(p)
    with open(full, 'rb') as f:
        data = base64.b64encode(f.read()).decode()
    return {'name': os.path.basename(full), 'path': rel or os.path.basename(full), 'b64': data}


def out_path(p, fallback=None):
    full = resolve_path(p) if p else os.path.join(OUT, fallback)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    return full


SKIP_DIRS = {'.git', 'node_modules', '.venv', '__pycache__'}


def walk(folder, limit_files=4000, limit_bytes=150e6):
    out, total = [], 0
    for dirpath, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        for fn in files:
            full = os.path.join(dirpath, fn)
            total += os.path.getsize(full)
            if total > limit_bytes:
                raise ToolError("That folder is over 150 MB. Point open_folder at the dashboard's own folder.")
            out.append({'full': full, 'rel': os.path.relpath(full, folder).replace('\\', '/')})
            if len(out) >= limit_files:
                return out
    return out


REF_RE = re.compile(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', re.I)
URL_RE = re.compile(r'url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)')


def referenced(html_path):
    folder, seen, out = os.path.dirname(html_path), set(), []

    def add(src, ref):
        ref = ref.split('#')[0].split('?')[0]
        if not ref or re.match(r'^(https?:|data:|blob:|mailto:|#|//|javascript:)', ref, re.I):
            return
        full = os.path.abspath(os.path.join(os.path.dirname(src), urllib.parse.unquote(ref)))
        if full in seen or not os.path.isfile(full):
            return
        seen.add(full)
        out.append(full)
        if full.lower().endswith('.css'):
            with open(full, encoding='utf-8', errors='replace') as f:
                for m in URL_RE.finditer(f.read()):
                    add(full, m.group(1))

    with open(html_path, encoding='utf-8', errors='replace') as f:
        html = f.read()
    for rx in (REF_RE, URL_RE):
        for m in rx.finditer(html):
            add(html_path, m.group(1))
    return [p for p in out if not os.path.relpath(p, folder).startswith('..')]


def open_files(main, others, password=None):
    folder = os.path.dirname(main)
    top = os.path.basename(folder) or 'dashboard'
    files = []
    for full in [main] + others:
        with open(full, 'rb') as f:
            files.append({'name': os.path.basename(full), 'path': top + '/' + os.path.relpath(full, folder).replace('\\', '/'),
                          'b64': base64.b64encode(f.read()).decode()})
    args = {'files': files}
    if password is not None:
        args['password'] = password
    return B.api('open_folder_files', args)


# --------------------------------------------------------------------------- tools that need the file system
def t_status(a):
    s = {'editor': EDITOR, 'browser': B.exe or ('attached on port ' + os.environ['MOTHERSHIP_ATTACH'] if os.environ.get('MOTHERSHIP_ATTACH') else B.find_browser()),
         'mode': B.mode, 'connected': bool(B.ws and B.session), 'headless': HEADLESS and B.mode != 'attached', 'saveFolder': OUT,
         'server': 'python ' + sys.version.split()[0], 'lastError': B.error}
    try:
        o = B.api('outline', {})
        s['connected'] = True
        s['dashboard'] = {'name': o.get('name'), 'charts': len(o.get('charts', [])), 'tabs': len(o.get('tabs', [])), 'unsavedChanges': o.get('unsavedChanges')} if o.get('open') else None
    except Exception as e:
        s['lastError'] = str(e)
    return s


def t_open_file(a):
    full = resolve_path(a.get('path'))
    if not re.search(r'\.html?$', full, re.I):
        raise ToolError('Give an .html file. For a folder use open_folder.')
    refs = referenced(full)
    if not refs:
        with open(full, encoding='utf-8', errors='replace') as f:
            args = {'html': f.read(), 'name': os.path.basename(full)}
        if a.get('password') is not None:
            args['password'] = a['password']
        return B.api('open_html', args)
    return open_files(full, refs, a.get('password'))


def t_open_folder(a):
    folder = resolve_path(a.get('path'))
    files = walk(folder)
    htmls = [f for f in files if re.search(r'\.html?$', f['rel'], re.I)]
    main = None
    if a.get('main'):
        main = next((f for f in htmls if f['rel'] == a['main'] or os.path.basename(f['rel']) == a['main']), None)
    elif len(htmls) == 1:
        main = htmls[0]
    else:
        main = next((f for f in htmls if re.match(r'^index\.html?$', f['rel'], re.I)), None)
    if not main:
        raise ToolError(('Say which page is the dashboard with main. Pages: ' + ', '.join(f['rel'] for f in htmls)) if htmls else 'No .html file in ' + folder)
    return open_files(main['full'], [f['full'] for f in files if not re.search(r'\.html?$', f['rel'], re.I)])


def t_export_html(a):
    r = B.api('export_html', {'drop_comments': bool(a.get('drop_comments'))})
    name = re.sub(r'(-edited)?\.html?$', '', r.get('name') or 'dashboard.html', flags=re.I) + '-edited.html'
    full = out_path(a.get('path'), name)
    with open(full, 'w', encoding='utf-8', newline='') as f:
        f.write(r['html'])
    return {'saved': full, 'size': '%d KB' % round(r['bytes'] / 1024)}


CLIP_JS = ('(function(){var r=document.querySelector("#stage iframe")||document.querySelector("#stage");var b=r.getBoundingClientRect();'
           'return {x:Math.max(0,b.left),y:Math.max(0,b.top),width:Math.min(b.width,innerWidth),height:Math.min(b.height,innerHeight),scale:1};})()')


def t_screenshot(a):
    what = a.get('what') or 'dashboard'
    B.ensure()
    if what == 'editor':
        data = B.cdp('Page.captureScreenshot', {'format': 'png'})['data']
    elif what == 'dashboard':
        data = B.cdp('Page.captureScreenshot', {'format': 'png', 'clip': B.evaluate(CLIP_JS)})['data']
    else:
        data = re.sub(r'^data:image/\w+;base64,', '', B.api('chart_image', {'chart': what})['dataUrl'])
    saved = None
    if a.get('path'):
        saved = out_path(a['path'])
        with open(saved, 'wb') as f:
            f.write(base64.b64decode(data))
    return {'__content': [{'type': 'image', 'data': data, 'mimeType': 'image/png'}, {'type': 'text', 'text': ('Saved to ' + saved) if saved else 'Screenshot of ' + what}]}


def t_ui_screenshot(a):
    if not a.get('target'):
        return t_screenshot({'what': 'dashboard', 'path': a.get('path')})
    B.ensure()
    loc = B.api('ui_locate', {'target': a['target']})
    if not (loc.get('width', 0) > 1 and loc.get('height', 0) > 1):
        raise RuntimeError(loc.get('what', 'That part') + ' is not on screen (open its tab first).')
    time.sleep(0.15)
    clip = {'x': loc['x'], 'y': loc['y'], 'width': loc['width'], 'height': loc['height'], 'scale': min(2, 1 / (loc.get('scale') or 1))}
    data = B.cdp('Page.captureScreenshot', {'format': 'png', 'clip': clip})['data']
    saved = None
    if a.get('path'):
        saved = out_path(a['path'])
        with open(saved, 'wb') as f:
            f.write(base64.b64decode(data))
    return {'__content': [{'type': 'image', 'data': data, 'mimeType': 'image/png'}, {'type': 'text', 'text': ('Saved to %s. ' % saved if saved else '') + 'Picture of ' + loc.get('what', '')}]}


def t_ui_mouse(a):
    act = a.get('action') or 'click'
    B.ensure()
    loc = B.api('ui_locate', {'target': a.get('target'), 'point': a.get('point'), 'series': a.get('series'), 'interact': True})
    x, y = loc['cx'], loc['cy']
    btn = 'right' if act == 'right_click' else 'left'

    def ev(kind, **extra):
        p = {'type': kind, 'x': x, 'y': y, 'button': 'none', 'clickCount': 0}
        p.update(extra)
        B.cdp('Input.dispatchMouseEvent', p)
    ev('mouseMoved')
    time.sleep(0.06)
    if act != 'hover':
        for i in range(1, 3 if act == 'dblclick' else 2):
            ev('mousePressed', button=btn, clickCount=i)
            ev('mouseReleased', button=btn, clickCount=i)
    time.sleep(0.25 if act == 'hover' else 0.35)
    r = {'did': act, 'on': loc.get('what'), 'at': {'x': round(x), 'y': round(y)}}
    r.update(B.api('ui_after', {}))
    return r


def t_save_test_document(a):
    r = B.api('test_document', {'format': a.get('format') or 'markdown', 'goal': a.get('goal')})
    full = out_path(a.get('path'), r['name'])
    if r.get('b64'):
        with open(full, 'wb') as f:
            f.write(base64.b64decode(r['b64']))
    else:
        with open(full, 'w', encoding='utf-8', newline='') as f:
            f.write(r['text'])
    return {'saved': full, 'summary': B.api('test_plan', {}).get('summary')}


def t_save_prompt(a):
    keys = ('goal', 'assistant', 'scope', 'tab', 'output', 'group', 'detail', 'include_done', 'extra', 'embed_html')
    p = B.api('comments_prompt', {k: a[k] for k in keys if k in a})
    o = B.api('outline', {})
    full = out_path(a.get('path'), re.sub(r'\.html?$', '', o.get('name') or 'dashboard', flags=re.I) + '-review-prompt.md')
    with open(full, 'w', encoding='utf-8') as f:
        f.write(p['prompt'])
    return {'saved': full, 'comments': o.get('comments'), 'characters': len(p['prompt'])}



def print_pdf(html):
    t = B.cdp('Target.createTarget', {'url': 'about:blank'}, None)
    target = t['targetId']
    try:
        sid = B.cdp('Target.attachToTarget', {'targetId': target, 'flatten': True}, None)['sessionId']
        B.cdp('Page.enable', {}, sid)
        ft = B.cdp('Page.getFrameTree', {}, sid)
        B.cdp('Page.setDocumentContent', {'frameId': ft['frameTree']['frame']['id'], 'html': html}, sid)
        time.sleep(0.9)
        B.cdp('Runtime.evaluate', {'expression': 'typeof msFit==="function"&&msFit()'}, sid)
        return B.cdp('Page.printToPDF', {'printBackground': True, 'preferCSSPageSize': True, 'landscape': True}, sid)['data']
    finally:
        try:
            B.cdp('Target.closeTarget', {'targetId': target}, None)
        except Exception:
            pass


def base_name(suffix=''):
    o = B.api('outline', {})
    return re.sub(r'\.html?$', '', o.get('name') or 'dashboard', flags=re.I) + suffix


def t_save_pdf(a):
    r = B.api('print_layout', {'from': a.get('from')})
    base = base_name('-story' if a.get('from') == 'story' else '')
    try:
        pdf = print_pdf(r['html'])
    except Exception as e:
        p = a.get('path')
        full = out_path(re.sub(r'\.pdf$', '-print.html', p, flags=re.I) if p else None, base + '-print.html')
        with open(full, 'w', encoding='utf-8') as f:
            f.write(r['html'])
        return {'saved': full, 'pages': r['pages'], 'note': 'The browser could not make the PDF itself (%s). Open the saved print layout and choose Print, then Save as PDF.' % e}
    full = out_path(a.get('path'), base + '.pdf')
    with open(full, 'wb') as f:
        f.write(base64.b64decode(pdf))
    return {'saved': full, 'pages': r['pages']}


def t_save_pptx(a):
    r = B.api('export_pptx', {'from': a.get('from')})
    full = out_path(a.get('path'), r['name'])
    with open(full, 'wb') as f:
        f.write(base64.b64decode(r['b64']))
    return {'saved': full, 'slides': r['slides']}


def t_scrubbed_copy(a):
    r = B.api('scrub_names', {'names': a.get('names') or [], 'where': 'copy'})
    full = out_path(a.get('path'), base_name('-cleaned.html'))
    with open(full, 'w', encoding='utf-8') as f:
        f.write(r['html'])
    return {'saved': full, 'replaced': r['replaced'], 'left': r['left']}


def t_save_tracker(a):
    r = B.api('comments_tracker', {})
    full = out_path(a.get('path'), r['name'])
    with open(full, 'wb') as f:
        f.write(base64.b64decode(r['b64']))
    return {'saved': full, 'comments': r['rows']}


def read_text(p):
    with open(resolve_path(p), encoding='utf-8', errors='replace') as f:
        return f.read()


def t_publish_html(a):
    args = {k: a[k] for k in ('version', 'note', 'by', 'as_of', 'password', 'unlock', 'badge', 'keep_comments') if k in a}
    r = B.api('publish', args)
    full = out_path(a.get('path'), r['name'])
    with open(full, 'w', encoding='utf-8', newline='') as f:
        f.write(r['html'])
    return {'saved': full, 'version': r['version'], 'locked': r['locked'], 'sha256': r['sha256'], 'size': '%d KB' % round(r['bytes'] / 1024)}


def t_compare_file(a):
    args = {'before_html': read_text(a.get('path'))}
    if a.get('after'):
        args['after_html'] = read_text(a['after'])
    else:
        args['after'] = 'now'
    return B.api('compare_versions', args)


LOCAL = {
    'status': ('Is Mothership running? Which browser, which editor file, and what is open.', {}, t_status),
    'open_file': ('Open a dashboard HTML file from disk. Local scripts, styles, images and fonts it refers to are bundled in, so it works offline. A published file locked for editing needs its password.',
                  {'path': ['string', 'Path to the .html file', True], 'password': ['string', 'Password, for a published file locked for editing']}, t_open_file),
    'open_folder': ('Open a dashboard folder (its HTML with scripts, styles, data and images).',
                    {'path': ['string', 'Folder path', True], 'main': ['string', 'Which .html file is the dashboard (default: index.html or the only one)']}, t_open_folder),
    'export_html': ('Save the edited dashboard as one standalone HTML file (opens anywhere, offline).',
                    {'path': ['string', 'Where to save (default: <name>-edited.html in the save folder)'], 'drop_comments': ['boolean', 'Leave review comments out of the file']}, t_export_html),
    'screenshot': ('See the dashboard: a picture of the editor, of just the dashboard, or of one chart.',
                   {'what': ['string', '"dashboard" (default), "editor" (whole window) or a chart name'], 'path': ['string', 'Also save the PNG here']}, t_screenshot),
    'insert_file': ('Turn a document on disk (Markdown, Word, Excel, PowerPoint, PDF, image) into a new tab or a block.',
                    {'path': ['string', 'File path', True], 'as': ['string', 'tab (default) | block'], 'title': ['string', 'Tab or block title']},
                    lambda a: B.api('insert_content_file', {'file': b64file(a.get('path')), 'as': a.get('as'), 'title': a.get('title')})),
    'load_data': ('Load a CSV, Excel or JSON file as dataset(s), embedded in the dashboard. Each Excel sheet becomes a dataset.',
                  {'path': ['string', 'File path', True], 'name': ['string', 'Dataset name (default: file/sheet name)']},
                  lambda a: B.api('add_dataset', {'name': a.get('name'), 'file': b64file(a.get('path'))})),
    'drill_data_file': ('Embed drill-down (double-click) detail from a Markdown, Excel, CSV or JSON file and link each table to its chart automatically. In Markdown, put each | table | under a heading naming the chart.',
                        {'path': ['string', 'File path', True], 'link': ['boolean', 'Link to matching charts (default true)']},
                        lambda a: B.api('drill_data', {'file': b64file(a.get('path')), 'link': a.get('link')})),
    'chart_data_file': ('Give one chart new numbers from a CSV or Excel file on disk: labels in the first column, one column per series (or Category / Series / Value).',
                        {'chart': ['string', 'Chart name or key', True], 'path': ['string', 'File path', True]},
                        lambda a: B.api('set_chart_data', {'chart': a.get('chart'), 'file': b64file(a.get('path'))})),
    'refresh_data_files': ("One-click refresh: re-read this month's CSV / Excel files for every dataset (matched by file name, then sheet or dataset name). Charts, KPI cards and filters keep their settings. Then export_html.",
                           {'paths': ['array', 'File paths', True], 'apply': ['boolean', 'Apply (default true); false only lists the matches']},
                           lambda a: B.api('refresh_data', {'files': [b64file(x) for x in (a.get('paths') or [])], 'apply': a.get('apply')})),
    'load_brand': ('Apply a brand from a file: brand JSON, a brand SKILL.md, a .skill/.zip package, or a font file.',
                   {'path': ['string', 'File path', True]}, lambda a: B.api('apply_theme', {'file': b64file(a.get('path'))})),
    'save_prompt': ('Turn review comments into an AI prompt (each located by tab › section › chart) and save it as a Markdown file.',
                    {'path': ['string', 'Where to save (default: <name>-review-prompt.md)'], 'goal': ['string', 'apply | polish | review | explain'],
                     'assistant': ['string', 'chat | agent | mcp'], 'scope': ['string', 'all | tab | must'], 'output': ['string', 'file | changes | plan | tickets'],
                     'include_done': ['boolean', 'Include closed comments'], 'extra': ['string', 'Extra instruction']}, t_save_prompt),
    'save_pdf': ('Save a client-ready PDF: one page per tab (or per story step) with the firm header and footer, fitted to A4 landscape.',
                 {'path': ['string', 'Where to save (default: <name>.pdf)'], 'from': ['string', 'tabs (default) | story']}, t_save_pdf),
    'save_pptx': ('Save a PowerPoint: one slide per tab (or per story step), editable titles, each page as a picture, firm footer.',
                  {'path': ['string', 'Where to save (default: <name>.pptx)'], 'from': ['string', 'tabs (default) | story']}, t_save_pptx),
    'scrubbed_copy': ('Save a copy with client or people names taken out (text, chart labels, data, comments, settings). The open dashboard is unchanged.',
                      {'names': ['array', '[{from, to}] e.g. [{from: "Acme Insurance", to: "Client"}]', True], 'path': ['string', 'Where to save (default: <name>-cleaned.html)']}, t_scrubbed_copy),
    'save_tracker': ('Save every review comment as an Excel tracker (.xlsx) with tab, section, chart, comment, done-when, status, owner and due date.',
                     {'path': ['string', 'Where to save (default: <name> - review tracker.xlsx)']}, t_save_tracker),
    'publish_html': ('Publish a view-only copy to disk: version number, date, release note and corner badge; optionally locked for editing with a password, and sealed so Mothership warns if it is changed later. Run publish_check first.',
                     {'path': ['string', 'Where to save (default: <name> v<version>.html)'], 'version': ['string', 'e.g. 1.0 (default: next after the last publish)'], 'note': ['string', 'What changed'], 'by': ['string', 'Published by'], 'as_of': ['string', 'Data as of (YYYY-MM-DD)'], 'password': ['string', 'Lock editing with this password (6+ characters). Without one, an earlier lock is kept'], 'unlock': ['boolean', 'Remove an earlier lock'], 'badge': ['boolean', 'Show the version badge (default true)'], 'keep_comments': ['boolean', 'Keep review comments in the file']}, t_publish_html),
    'load_tracker': ('Update comments from an edited Excel tracker: status, priority, owner, due date, notes and wording (matched by the ID column).',
                     {'path': ['string', 'The .xlsx file', True]}, lambda a: B.api('apply_tracker', {'file': b64file(a.get('path'))})),
    'compare_file': ('What changed between a dashboard file on disk and what is open now (or a second file): tabs, text, chart settings, data, KPI cards, filters, colours, comments.',
                     {'path': ['string', 'The earlier .html file', True], 'after': ['string', 'A later .html file (default: the dashboard open now)']}, t_compare_file),
    'ui_screenshot': ('Testing: a picture of the dashboard, or of one part (target: a ref, text=…, chart=…, kpi=…, tab=… or a CSS selector), at its real size. Use it for every "check by eye" step and for each failure.',
                      {'target': ['string', 'The part (default: the whole dashboard on screen)'], 'path': ['string', 'Also save the PNG here']}, t_ui_screenshot),
    'ui_mouse': ("Testing: real mouse input, as a person would do it (the browser's own events, like Playwright). action: click (default), dblclick, hover, right_click. For a chart, point = a category. Returns what changed and the pop-up text. ui_click / ui_hover do the same with page events and work everywhere; use ui_mouse when a dashboard ignores those.",
                 {'target': ['string', 'The part: a ref, text=…, button=…, chart=…, kpi=…, tab=… or a CSS selector', True], 'action': ['string', 'click | dblclick | hover | right_click'], 'point': ['string', 'A chart category'], 'series': ['number', 'Which series (0 = first)']}, t_ui_mouse),
    'save_test_document': ('Testing: save the test document with the results: markdown (default), html (prints to PDF), xlsx (Excel tracker of the cases), json, prompt (instructions for another AI tester) or failures (a prompt built from the failed cases: find the cause, fix, test again).',
                           {'format': ['string', 'markdown | html | xlsx | json | prompt | failures'], 'goal': ['string', 'For failures: fix (default) or retest'], 'path': ['string', 'Where to save (default: <name> - test plan.<ext>)']}, t_save_test_document),
    'chart_image': ('A PNG of one chart (shown to you, optionally saved).', {'chart': ['string', 'Chart name or key', True], 'path': ['string', 'Also save it here']},
                    lambda a: t_screenshot({'what': a.get('chart'), 'path': a.get('path')})),
}
HIDDEN = {'open_folder_files', 'insert_content_file', 'comments_tracker', 'apply_tracker', 'publish', 'ui_after'}


def schema_of(props):
    p, req = {}, []
    for k, v in props.items():
        p[k] = {'type': v[0], 'description': v[1]}
        if v[0] == 'array':
            p[k]['items'] = {}
        if len(v) > 2 and v[2]:
            req.append(k)
    return {'type': 'object', 'properties': p, 'required': req}


def local_tools():
    return [{'name': k, 'description': v[0], 'inputSchema': schema_of(v[1])} for k, v in LOCAL.items()]


_page_tools = None


def list_tools():
    global _page_tools
    if _page_tools is None:
        try:
            B.ensure()
            _page_tools = json.loads(B.evaluate('JSON.stringify(MS.api.describe())'))
        except Exception as e:
            log('could not start the browser yet:', e)
            return local_tools()   # status explains what is wrong
    names = set(LOCAL)
    return local_tools() + [t for t in _page_tools if t['name'] not in names and t['name'] not in HIDDEN]


def call_tool(name, args):
    try:
        r = LOCAL[name][2](args or {}) if name in LOCAL else B.api(name, args or {})
        if isinstance(r, dict) and '__content' in r:
            return {'content': r['__content']}
        text = json.dumps(r, indent=1, ensure_ascii=False)
        if len(text) > 200000:
            text = text[:200000] + '\n…(cut)'
        return {'content': [{'type': 'text', 'text': text}]}
    except Exception as e:
        return {'content': [{'type': 'text', 'text': 'Error: ' + str(e)}], 'isError': True}


# --------------------------------------------------------------------------- MCP over stdio (newline-delimited JSON-RPC)
INSTRUCTIONS = ('Mothership edits HTML dashboards like PowerPoint edits slides. Start with open_file (or new_dashboard), then outline to see the tabs, charts, '
                'datasets and comments. Refer to charts by their plain names from outline. Elements: use find to get refs, then set_text / set_style / set_popup. '
                'Every change is undoable (undo). Use screenshot to look at the result and export_html to save. Numbers follow the region set with set_locale (US $ by default). '
                'If outline lists pageTabs, the dashboard has its own tabs: use page_tabs for them, not add_tab or layout. '
                'To test a dashboard like Playwright: ui_snapshot, then ui_tab / ui_click / ui_hover / ui_select / ui_type, check with ui_expect / ui_read / ui_errors, look with ui_screenshot; '
                'plan and record with test_plan / test_run / test_record and save with save_test_document.')

_out_lock = threading.Lock()


def send(obj):
    line = json.dumps(obj, ensure_ascii=False) + '\n'
    with _out_lock:
        sys.stdout.write(line)
        sys.stdout.flush()


def handle(msg):
    mid, method = msg.get('id'), msg.get('method')
    try:
        if method == 'initialize':
            res = {'protocolVersion': (msg.get('params') or {}).get('protocolVersion') or '2025-06-18', 'capabilities': {'tools': {'listChanged': False}},
                   'serverInfo': {'name': 'mothership', 'version': VERSION}, 'instructions': INSTRUCTIONS}
        elif method == 'ping':
            res = {}
        elif method == 'tools/list':
            res = {'tools': list_tools()}
        elif method == 'tools/call':
            p = msg.get('params') or {}
            res = call_tool(p.get('name'), p.get('arguments'))
        elif method == 'resources/list':
            res = {'resources': []}
        elif method == 'prompts/list':
            res = {'prompts': []}
        else:
            if mid is not None:
                send({'jsonrpc': '2.0', 'id': mid, 'error': {'code': -32601, 'message': 'Method not found: ' + str(method)}})
            return
        if mid is not None:
            send({'jsonrpc': '2.0', 'id': mid, 'result': res})
    except Exception as e:
        if mid is not None:
            send({'jsonrpc': '2.0', 'id': mid, 'error': {'code': -32603, 'message': str(e)}})


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stdin.reconfigure(encoding='utf-8')
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except ValueError:
                send({'jsonrpc': '2.0', 'id': None, 'error': {'code': -32700, 'message': 'Parse error'}})
                continue
            handle(msg)   # one at a time: the editor is a single page
    finally:
        B.shutdown()


if __name__ == '__main__':
    main()
