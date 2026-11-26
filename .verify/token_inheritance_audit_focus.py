#!/usr/bin/env python3
"""针对性复测：皮肤(环境光令牌)、玻璃(内联覆盖)、密度(实际行高)、外观(文字色/字号/字体)。"""
import json, sys, time, urllib.request
sys.path.insert(0, '/Users/a1-6/Documents/world-simulator/.verify')
from cdp_shot import WS, ORIGIN

PORT = 9231
TOKEN = open('/tmp/dev_token.txt').read().strip()
API = 'http://127.0.0.1:8000/api'
PAGES = [('creation-center', '/'), ('community', '/?page=community'),
         ('user-center', '/?page=user-center'), ('creator-assets', '/?page=creator-assets')]


def api(path, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', 'Bearer ' + TOKEN)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def ev(ws, expr):
    r = ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    return r.get('result', {}).get('value')


def reset(ws):
    api('/settings', 'PATCH', {'preferences': {'theme': 'light', 'font_size': 'medium', 'density': 'comfortable'}})
    ev(ws, "localStorage.setItem('ws.ui.skin','default'); delete localStorage['ws.ui.glass']; 'ok'")


def nav(ws, url):
    ws.call('Page.navigate', {'url': ORIGIN + url})
    time.sleep(3.2)
    for _ in range(15):
        if ev(ws, "document.body && document.body.children.length > 0 && document.body.innerText.length > 0"):
            break
        time.sleep(0.4)
    time.sleep(0.5)


# 测量：环境光令牌、玻璃令牌、正文实际行高、body 色、--text-base
MEASURE = r"""(() => {
  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  // 找一个正文段落测实际行高
  let lh = '';
  const p = document.querySelector('.ws-prose p, .reading-body p, .article-body p, .markdown-body p, p');
  if (p) lh = getComputedStyle(p).lineHeight;
  return {
    ambientA: root.getPropertyValue('--ambient-a').trim(),
    ambientB: root.getPropertyValue('--ambient-b').trim(),
    glassBlur: root.getPropertyValue('--glass-blur').trim(),
    glassOpacity: root.getPropertyValue('--glass-opacity').trim(),
    glassSaturate: root.getPropertyValue('--glass-saturate').trim(),
    textBase: root.getPropertyValue('--text-base').trim(),
    textXs: root.getPropertyValue('--text-xs').trim(),
    bodyColor: body.color,
    paraLineHeight: lh,
  };
})()"""


def main():
    with urllib.request.urlopen('http://127.0.0.1:%d/json/list' % PORT, timeout=10) as r:
        pages = json.load(r)
    ws = WS(next(p for p in pages if p.get('type') == 'page')['webSocketDebuggerUrl'])
    ws.call('Page.enable'); ws.call('Runtime.enable')
    ws.call('Page.navigate', {'url': ORIGIN + '/'}); time.sleep(2.5)
    ev(ws, "localStorage.setItem('ws.authToken', %s); localStorage.setItem('ws.authUser', %s); 'seeded'"
       % (json.dumps(TOKEN), json.dumps({"id": "local", "username": "兰哆哆", "display_name": "兰哆哆", "is_owner": True})))

    out = {}
    for pg, url in PAGES:
        print('PAGE', pg, flush=True)
        out[pg] = {}
        # 皮肤
        for skin in ('aurora', 'sand', 'mono'):
            reset(ws); ev(ws, "localStorage.setItem('ws.ui.skin',%s)" % json.dumps(skin)); nav(ws, url)
            out[pg]['skin-' + skin] = ev(ws, MEASURE)
        # 玻璃
        for glass in ('low', 'high', 'solid'):
            reset(ws); ev(ws, "localStorage.setItem('ws.ui.glass',%s)" % json.dumps(glass)); nav(ws, url)
            out[pg]['glass-' + glass] = ev(ws, MEASURE)
        # 密度：测实际行高
        for den in ('compact', 'spacious'):
            reset(ws); api('/settings', 'PATCH', {'preferences': {'density': den}}); nav(ws, url)
            out[pg]['density-' + den] = ev(ws, MEASURE)
        # 外观：文字色/字号/字体
        for label, patch in [
            ('appear-text-red', "cur.text.color_mode='custom'; cur.text.color='#ff0000'"),
            ('appear-size-20', "cur.text.font_size=20"),
            ('appear-font-kaiti', "cur.text.font_family='kaiti'"),
        ]:
            reset(ws)
            ev(ws, """(() => {
                const cur = JSON.parse(localStorage.getItem('ws.ui.appearance') || 'null') || {};
                cur.text = cur.text || {}; %s;
                localStorage.setItem('ws.ui.appearance', JSON.stringify(cur)); return 'ok';
            })()""" % patch)
            nav(ws, url)
            out[pg][label] = ev(ws, MEASURE)
        print('  done', flush=True)
    json.dump(out, open('/tmp/inherit_audit2.json', 'w'), ensure_ascii=False, indent=1)
    print('DONE')


if __name__ == '__main__':
    main()
