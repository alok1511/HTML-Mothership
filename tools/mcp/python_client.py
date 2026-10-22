#!/usr/bin/env python3
"""
Use Mothership from your own Python code, with nothing to install.

    python tools/mcp/python_client.py samples/sales-dashboard.html

MothershipClient starts the Mothership MCP server (the Python one by default, or the
Node one with server='node'), talks to it over stdio, and gives you call(tool, **args).
Every tool from `tools()` works, e.g. chart_settings, category_order, add_comment,
comments_prompt, export_html. See README §12 for the list.

If your office allows `pip install mcp`, the official MCP SDK works too: see
`with_official_sdk()` at the bottom.
"""
import json
import os
import subprocess
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))


class MothershipError(Exception):
    pass


class MothershipClient:
    def __init__(self, server='python', env=None):
        cmd = [sys.executable, os.path.join(HERE, 'mothership_mcp.py')] if server == 'python' else ['node', os.path.join(HERE, 'mothership-mcp.js')]
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=sys.stderr,
                                     env=dict(os.environ, **(env or {})), text=True, encoding='utf-8', bufsize=1)
        self._id = 0
        self._lock = threading.Lock()
        self.info = self._rpc('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'python-client', 'version': '1'}})
        self._notify('notifications/initialized')

    def _notify(self, method, params=None):
        self.proc.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': method, 'params': params or {}}) + '\n')
        self.proc.stdin.flush()

    def _rpc(self, method, params=None):
        with self._lock:
            self._id += 1
            mid = self._id
            self.proc.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': mid, 'method': method, 'params': params or {}}) + '\n')
            self.proc.stdin.flush()
            while True:
                line = self.proc.stdout.readline()
                if not line:
                    raise MothershipError('The Mothership server stopped. Run it on its own to see why.')
                msg = json.loads(line)
                if msg.get('id') == mid:
                    break
        if 'error' in msg:
            raise MothershipError(msg['error'].get('message'))
        return msg['result']

    def tools(self):
        """All tools: [{name, description, inputSchema}]."""
        return self._rpc('tools/list')['tools']

    def call(self, tool, **args):
        """Run a tool. Returns parsed JSON, or the list of content parts for images."""
        res = self._rpc('tools/call', {'name': tool, 'arguments': args})
        parts = res.get('content', [])
        if res.get('isError'):
            raise MothershipError(parts[0]['text'] if parts else 'Tool failed')
        if any(p['type'] == 'image' for p in parts):
            return parts
        text = parts[0]['text'] if parts else ''
        try:
            return json.loads(text)
        except ValueError:
            return text

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.wait(10)
        except Exception:
            self.proc.kill()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def demo(path):
    with MothershipClient() as ms:
        print('Connected to', ms.info['serverInfo'])
        o = ms.call('open_file', path=path)
        print('Opened %s: %d charts' % (o['name'], len(o['charts'])))
        for c in o['charts']:
            print('  -', c['name'], '·', c['kind'], '·', ', '.join(c['labels'][:6]))
        first = o['charts'][0]
        ms.call('chart_settings', chart=first['name'], inference='Added from Python.', look={'axisFormat': 'cr', 'legend': 'bottom'})
        ms.call('add_comment', chart=first['name'], text='Use the same region order on every chart.', priority='must')
        prompt = ms.call('comments_prompt', assistant='chat', goal='apply')['prompt']
        print('\nPrompt starts:\n' + prompt[:400] + '…\n')
        print('Saved:', ms.call('export_html')['saved'])


def with_official_sdk(path):
    """The same with the official SDK (pip install mcp)."""
    import asyncio
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    async def run():
        params = StdioServerParameters(command=sys.executable, args=[os.path.join(HERE, 'mothership_mcp.py')])
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as s:
                await s.initialize()
                print([t.name for t in (await s.list_tools()).tools][:10], '…')
                r = await s.call_tool('open_file', {'path': path})
                print(r.content[0].text[:300])
    asyncio.run(run())


if __name__ == '__main__':
    demo(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'samples', 'sales-dashboard.html'))
