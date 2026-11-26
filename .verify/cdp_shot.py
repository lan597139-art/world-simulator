#!/usr/bin/env python3
"""Minimal pure-stdlib CDP client: seed localStorage, navigate, screenshot."""
import base64
import json
import os
import socket
import struct
import time
import urllib.request

DEBUG_PORT = int(os.environ.get('CDP_PORT', '9231'))
ORIGIN = os.environ.get('APP_ORIGIN', 'http://127.0.0.1:5173')
TOKEN = os.environ.get('AUTH_TOKEN', '')
USER = json.dumps({"id": "local", "username": "local", "display_name": "本地用户"})


class WS:
    def __init__(self, url):
        rest = url[len('ws://'):]
        hostport, path = rest.split('/', 1)
        path = '/' + path
        host, port = hostport.split(':')
        self.sock = socket.create_connection((host, int(port)), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET {path} HTTP/1.1\r\nHost: {hostport}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        resp = b''
        while b'\r\n\r\n' not in resp:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError('handshake closed')
            resp += chunk
        if b'101' not in resp.split(b'\r\n')[0]:
            raise RuntimeError('handshake failed: ' + resp[:200].decode(errors='replace'))
        self._buf = b''
        self._id = 0

    def _recv_exact(self, n):
        while len(self._buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError('socket closed')
            self._buf += chunk
        out, self._buf = self._buf[:n], self._buf[n:]
        return out

    def send_json(self, obj):
        data = json.dumps(obj).encode()
        header = bytearray([0x81])
        n = len(data)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack('>H', n)
        else:
            header.append(0x80 | 127)
            header += struct.pack('>Q', n)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(bytes(header) + masked)

    def recv_frame(self):
        b1, b2 = self._recv_exact(2)
        opcode = b1 & 0x0F
        n = b2 & 0x7F
        if n == 126:
            n = struct.unpack('>H', self._recv_exact(2))[0]
        elif n == 127:
            n = struct.unpack('>Q', self._recv_exact(8))[0]
        payload = self._recv_exact(n)
        if opcode == 0x8:
            raise RuntimeError('closed frame')
        if opcode == 0x9:
            self._send_pong(payload)
            return self.recv_frame()
        return payload

    def _send_pong(self, payload):
        header = bytearray([0x8A, 0x80 | len(payload)])
        mask = os.urandom(4)
        header += mask
        self.sock.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def call(self, method, params=None, timeout=60):
        self._id += 1
        mid = self._id
        self.send_json({'id': mid, 'method': method, 'params': params or {}})
        self.sock.settimeout(timeout)
        while True:
            payload = self.recv_frame()
            msg = json.loads(payload)
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError(method + ' -> ' + json.dumps(msg['error'], ensure_ascii=False))
                return msg.get('result', {})


def main():
    with urllib.request.urlopen(f'http://127.0.0.1:{DEBUG_PORT}/json/list', timeout=10) as r:
        pages = json.load(r)
    page_target = next(p for p in pages if p.get('type') == 'page')
    ws = WS(page_target['webSocketDebuggerUrl'])
    ws.call('Page.enable')
    ws.call('Runtime.enable')

    # Navigate to origin so localStorage is scoped, then seed auth.
    ws.call('Page.navigate', {'url': ORIGIN + '/'})
    time.sleep(2.5)
    ws.call('Runtime.evaluate', {
        'expression': "localStorage.setItem('ws.authToken', %s); localStorage.setItem('ws.authUser', %s); 'seeded'" % (json.dumps(TOKEN), USER),
        'returnByValue': True,
    })

    target = os.environ.get('APP_PATH', '/')
    url = ORIGIN + target
    ws.call('Page.navigate', {'url': url})
    time.sleep(float(os.environ.get('WAIT', '7')))

    title = ws.call('Runtime.evaluate', {'expression': 'document.title', 'returnByValue': True}).get('result', {})
    print('TITLE=' + str(title.get('value')))

    shot = ws.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': True})
    out = os.environ.get('OUT', 'shot.png')
    with open(out, 'wb') as f:
        f.write(base64.b64decode(shot['data']))
    print('saved', out)


if __name__ == '__main__':
    main()
