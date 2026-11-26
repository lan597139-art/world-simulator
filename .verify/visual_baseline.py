#!/usr/bin/env python3
"""视觉回归基线：六档视口 × 多页面，Chrome（CDP）与 Safari（WebDriver）双引擎。

用法：
    python3 .verify/visual_baseline.py capture --engine chrome          # 写基线
    python3 .verify/visual_baseline.py compare --engine chrome          # 与基线比对
    python3 .verify/visual_baseline.py capture --engine safari
    python3 .verify/visual_baseline.py compare --engine chrome --page community

产物：
    .verify/baseline/<engine>.json          结构指纹 + 度量（可 diff）
    .verify/baseline/shots/<engine>/...png  截图（给人看，模型不读图）

判定口径：不比对像素，比对真实布局度量——滚动屏数、横向溢出、被截断元素数、
10px 以下文字数、关键节点矩形与字号。矩形容差 2px，计数容差 0。
Chrome 通过 CDP 控制；Safari 需要先在 Safari 设置 → 开发者 里勾选
「允许远程自动化」（safaridriver 会明确报错），脚本会给出提示后跳过。
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cdp_shot import WS  # noqa: E402

ORIGIN = os.environ.get('APP_ORIGIN', 'http://127.0.0.1:5173')
CDP_PORT = int(os.environ.get('CDP_PORT', '9231'))
WD_PORT = int(os.environ.get('WD_PORT', '9233'))
BASELINE_DIR = os.path.join(HERE, 'baseline')
TOKEN_FILE = os.environ.get('AUTH_TOKEN_FILE', '/tmp/dev_token.txt')
AUTH_USER = os.environ.get(
    'AUTH_USER',
    json.dumps({"id": "local", "username": "兰哆哆", "display_name": "兰哆哆", "is_owner": True}),
)

VIEWPORTS = [
    (2048, 1200),
    (1440, 900),
    (1280, 800),
    (1024, 900),
    (768, 1024),
    (390, 844),
    (360, 780),
]

PAGES = [
    ('creation-center', '/'),
    ('experience-center', '/?page=experience-center'),
    ('community', '/?page=community'),
    ('user-center', '/?page=user-center'),
    ('business', '/?page=business'),
    ('creator-assets', '/?page=creator-assets'),
]

# 指纹节点：稳定存在、能代表布局骨架的选择器
FINGERPRINT_SELECTORS = [
    '.cc-sidebar',
    '.cc-topbar',
    '.cc-page-scroll',
    '.cc-content, .cc-main',
    '.uc-hero, .cm-hero, .ct-hero, .ec-hero, .bc-hero, .ca-page-head',
    '.uc-group-head',
    '.cm-tabs',
    '.bc-nav-item',
    '.ca-list',
    '.ec-card',
]

PROBE = """(() => {
  const sc = document.querySelector('.cc-page-scroll') || document.scrollingElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const all = [...document.querySelectorAll('body *')];
  const visible = all.filter((e) => e.offsetParent !== null || e === document.body);

  const tiny = visible.filter((e) => {
    if (e.children.length) return false;
    const text = (e.textContent || '').trim();
    if (!text) return false;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    return fs > 0 && fs < 10;
  });

  const clipped = visible.filter((e) => {
    if (e.children.length) return false;
    const text = (e.textContent || '').trim();
    if (!text) return false;
    return e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible';
  });

  const wide = visible.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 2 || r.left < -2);
  });

  const fp = {};
  for (const sel of %s) {
    const el = document.querySelector(sel);
    if (!el) { fp[sel] = null; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    fp[sel] = {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      fs: parseFloat(cs.fontSize), display: cs.display, position: cs.position,
      vis: cs.visibility, offscreen: r.right <= 0 || r.left >= vw,
    };
  }

  return {
    vw, vh,
    docScreens: +(sc.scrollHeight / Math.max(sc.clientHeight, 1)).toFixed(2),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollWPag: sc.scrollWidth - sc.clientWidth,
    tinyText: tiny.length,
    clippedText: clipped.length,
    overflowingBoxes: wide.length,
    nodes: all.length,
    fp,
  };
})()""" % json.dumps(FINGERPRINT_SELECTORS)


# --------------------------------------------------------------------------
# Chrome / CDP
# --------------------------------------------------------------------------
def chrome_connect():
    with urllib.request.urlopen(f'http://127.0.0.1:{CDP_PORT}/json/list', timeout=10) as resp:
        pages = json.load(resp)
    target = next(p for p in pages if p.get('type') == 'page')
    ws = WS(target['webSocketDebuggerUrl'])
    ws.call('Page.enable')
    ws.call('Runtime.enable')
    return ws


def ev(ws, expr):
    res = ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    return res.get('result', {}).get('value')


def seed_auth_chrome(ws, token):
    ws.call('Page.navigate', {'url': ORIGIN + '/'})
    time.sleep(2.0)
    ev(ws, "localStorage.setItem('ws.authToken', %s)" % json.dumps(token))
    ev(ws, "localStorage.setItem('ws.authUser', %s)" % json.dumps(AUTH_USER))


def capture_chrome(token, pages, viewports, shots_dir):
    ws = chrome_connect()
    seed_auth_chrome(ws, token)
    result = {}
    for w, h in viewports:
        ws.call('Emulation.setDeviceMetricsOverride', {
            'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': w < 768,
        })
        for name, path in pages:
            ws.call('Page.navigate', {'url': ORIGIN + path})
            time.sleep(3.4)
            data = ev(ws, PROBE)
            key = f'{w}x{h}:{name}'
            if data is None:
                data = {'error': 'probe returned null'}
            result[key] = data
            shot = ws.call('Page.captureScreenshot', {'format': 'png'})
            # WS.call 直接返回 result 负载，截图数据在顶层 data
            payload = shot.get('data') or shot.get('result', {}).get('data')
            if shots_dir and payload:
                os.makedirs(shots_dir, exist_ok=True)
                with open(os.path.join(shots_dir, f'{w}x{h}-{name}.png'), 'wb') as fh:
                    fh.write(base64.b64decode(payload))
    ws.call('Emulation.clearDeviceMetricsOverride')
    return result


# --------------------------------------------------------------------------
# Safari / WebDriver
# --------------------------------------------------------------------------
class WebDriverError(RuntimeError):
    pass


def wd(method, path, payload=None, base=None, session=None, timeout=60):
    base = base or f'http://127.0.0.1:{WD_PORT}'
    url = base + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.load(resp)
    except urllib.error.HTTPError as exc:  # WebDriver 用 4xx + JSON 报错
        try:
            body = json.load(exc)
        except Exception:
            raise WebDriverError(f'{method} {path} -> HTTP {exc.code}')
    if isinstance(body, dict) and body.get('value', {}).get('error'):
        raise WebDriverError(body['value'].get('message') or body['value']['error'])
    return body.get('value', body)


def safari_session():
    try:
        wd('GET', '/status', timeout=5)
    except Exception as exc:
        raise WebDriverError(f'safaridriver 没在 {WD_PORT} 端口运行：{exc}') from exc
    try:
        value = wd('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})
    except WebDriverError as exc:
        raise WebDriverError(
            'Safari 拒绝远程控制：请在 Safari → 设置 → 开发者 中勾选「允许远程自动化」'
            f'（原始错误：{exc}）'
        ) from exc
    return value.get('sessionId') or value.get('id')


def capture_safari(token, pages, viewports, shots_dir):
    sid = safari_session()
    base = f'http://127.0.0.1:{WD_PORT}/session/{sid}'
    try:
        wd('POST', f'{base}/url', {'url': ORIGIN + '/'})
        time.sleep(2.5)
        wd('POST', f'{base}/execute/sync', {
            'script': "localStorage.setItem('ws.authToken', arguments[0]);"
                      "localStorage.setItem('ws.authUser', arguments[1]); return 1;",
            'args': [token, AUTH_USER],
        })
        result = {}
        for w, h in viewports:
            wd('POST', f'{base}/window/rect', {'width': w, 'height': h, 'x': 0, 'y': 0})
            for name, path in pages:
                wd('POST', f'{base}/url', {'url': ORIGIN + path})
                time.sleep(4.0)
                data = wd('POST', f'{base}/execute/sync', {'script': f'return ({PROBE});', 'args': []})
                result[f'{w}x{h}:{name}'] = data
                if shots_dir:
                    try:
                        png = wd('GET', f'{base}/screenshot')
                        os.makedirs(shots_dir, exist_ok=True)
                        with open(os.path.join(shots_dir, f'{w}x{h}-{name}.png'), 'wb') as fh:
                            fh.write(base64.b64decode(png))
                    except Exception:
                        pass
        return result
    finally:
        try:
            wd('DELETE', base, timeout=10)
        except Exception:
            pass


# --------------------------------------------------------------------------
# 比对
# --------------------------------------------------------------------------
RECT_TOL = 2


def diff_states(base, cur):
    out = []
    for key in sorted(set(base) | set(cur)):
        b, c = base.get(key), cur.get(key)
        if b is None:
            out.append((key, 'added', None, None))
            continue
        if c is None:
            out.append((key, 'missing', None, None))
            continue
        if 'error' in b or 'error' in c:
            if b.get('error') != c.get('error'):
                out.append((key, 'error', b.get('error'), c.get('error')))
            continue
        for field in ('docScreens', 'overflowX', 'scrollWPag', 'tinyText', 'clippedText', 'overflowingBoxes'):
            bv, cv = b.get(field), c.get(field)
            if bv is None or cv is None:
                continue
            if field == 'docScreens':
                if abs(float(bv) - float(cv)) > 0.05:
                    out.append((key, field, bv, cv))
            elif bv != cv:
                out.append((key, field, bv, cv))
        bfp, cfp = b.get('fp', {}), c.get('fp', {})
        for sel in FINGERPRINT_SELECTORS:
            bb, cc = bfp.get(sel), cfp.get(sel)
            if bb is None and cc is None:
                continue
            if bb is None or cc is None:
                out.append((key, f'fp:{sel}', 'present' if bb else 'absent', 'present' if cc else 'absent'))
                continue
            for f in ('x', 'y', 'w', 'h'):
                if abs(bb.get(f, 0) - cc.get(f, 0)) > RECT_TOL:
                    out.append((key, f'fp:{sel}.{f}', bb.get(f), cc.get(f)))
            for f in ('fs', 'display', 'position'):
                if bb.get(f) != cc.get(f):
                    out.append((key, f'fp:{sel}.{f}', bb.get(f), cc.get(f)))
    return out


def main():
    parser = argparse.ArgumentParser(description='视觉回归基线（六档视口 × 双引擎）')
    parser.add_argument('mode', choices=['capture', 'compare'])
    parser.add_argument('--engine', choices=['chrome', 'safari'], default='chrome')
    parser.add_argument('--page', action='append', help='只跑指定页面名（可多次）')
    parser.add_argument('--viewport', action='append', help='只跑指定视口，如 390x844')
    parser.add_argument('--no-shots', action='store_true', help='不写截图')
    args = parser.parse_args()

    token = os.environ.get('AUTH_TOKEN') or ''
    if not token and os.path.exists(TOKEN_FILE):
        token = open(TOKEN_FILE, encoding='utf-8').read().strip()
    if not token:
        print('缺少登录令牌：设置 AUTH_TOKEN 或写入 /tmp/dev_token.txt', file=sys.stderr)
        return 2

    pages = [p for p in PAGES if not args.page or p[0] in args.page]
    viewports = VIEWPORTS
    if args.viewport:
        viewports = []
        for v in args.viewport:
            w, h = v.lower().split('x')
            viewports.append((int(w), int(h)))

    shots_dir = None if args.no_shots else os.path.join(BASELINE_DIR, 'shots', args.engine)
    print(f'[{args.engine}] {len(pages)} 页 × {len(viewports)} 视口 = {len(pages) * len(viewports)} 次采集')

    if args.engine == 'chrome':
        cur = capture_chrome(token, pages, viewports, shots_dir)
    else:
        try:
            cur = capture_safari(token, pages, viewports, shots_dir)
        except WebDriverError as exc:
            print(f'Safari 引擎不可用：{exc}', file=sys.stderr)
            return 3

    os.makedirs(BASELINE_DIR, exist_ok=True)
    path = os.path.join(BASELINE_DIR, f'{args.engine}.json')

    if args.mode == 'capture':
        if os.path.exists(path) and not args.page and not args.viewport:
            backup = path.replace('.json', '.prev.json')
            os.replace(path, backup)
            print(f'旧基线已备份到 {os.path.relpath(backup, os.getcwd())}')
        data = json.load(open(path, encoding='utf-8')) if (args.page or args.viewport) and os.path.exists(path) else {}
        data.update(cur)
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1, sort_keys=True)
        print(f'基线已写入 {os.path.relpath(path, os.getcwd())}（{len(data)} 条）')
        return 0

    if not os.path.exists(path):
        print(f'没有基线文件 {path}，先跑 capture', file=sys.stderr)
        return 2
    base = json.load(open(path, encoding='utf-8'))
    diffs = diff_states({k: v for k, v in base.items() if k in cur}, cur)
    if not diffs:
        print(f'✓ 与基线一致（{len(cur)} 条）')
        return 0
    for key, field, b, c in diffs[:60]:
        print(f'  {key:34s} {field:24s} {b!r} -> {c!r}')
    if len(diffs) > 60:
        print(f'  … 还有 {len(diffs) - 60} 处差异')
    print(f'✗ {len(diffs)} 处差异')
    return 1


if __name__ == '__main__':
    sys.exit(main())
