#!/usr/bin/env python3
"""全站令牌继承动态审计：真实设置 -> 重载 -> 实测业务页面计算样式。

验证全局设置（主题/字号/密度/皮肤/玻璃/外观）能否从 Tokens 传递到业务页面。
"""
import json, sys, time, urllib.request
sys.path.insert(0, '/Users/a1-6/Documents/world-simulator/.verify')
from cdp_shot import WS, ORIGIN

PORT = 9231
TOKEN = open('/tmp/dev_token.txt').read().strip()
API = 'http://127.0.0.1:8000/api'

PAGES = [
    ('creation-center', '/'),
    ('experience-center', '/?page=experience-center'),
    ('community', '/?page=community'),
    ('user-center', '/?page=user-center'),
    ('business', '/?page=business'),
    ('creator-assets', '/?page=creator-assets'),
]

# 中性基线
NEUTRAL_PREFS = {'theme': 'light', 'font_size': 'medium', 'density': 'comfortable'}

# 场景：(id, 类型, 变更)
SCENARIOS = [
    ('theme-light',  'prefs',     {'theme': 'light'}),
    ('theme-dark',   'prefs',     {'theme': 'dark'}),
    ('font-small',   'prefs',     {'font_size': 'small'}),
    ('font-medium',  'prefs',     {'font_size': 'medium'}),
    ('font-large',   'prefs',     {'font_size': 'large'}),
    ('density-compact',  'prefs', {'density': 'compact'}),
    ('density-spacious', 'prefs', {'density': 'spacious'}),
    ('skin-aurora',  'ls',        {'ws.ui.skin': 'aurora'}),
    ('skin-sand',    'ls',        {'ws.ui.skin': 'sand'}),
    ('glass-low',    'ls',        {'ws.ui.glass': 'low'}),
    ('glass-high',   'ls',        {'ws.ui.glass': 'high'}),
    ('appear-text-red',   'appearance', {'text.color': '#ff0000'}),
    ('appear-size-20',    'appearance', {'text.font_size': 20}),
    ('appear-font-kaiti', 'appearance', {'text.font_family': 'kaiti'}),
]


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


def reset_all(ws):
    """恢复中性基线：偏好 + 皮肤/玻璃 + 外观。"""
    api('/settings', 'PATCH', {'preferences': NEUTRAL_PREFS})
    ev(ws, "localStorage.setItem('ws.ui.skin','default'); delete localStorage['ws.ui.glass']; 'ok'")
    # 外观恢复为默认（保留背景为空）
    ev(ws, """(() => {
        const cur = JSON.parse(localStorage.getItem('ws.ui.appearance') || 'null');
        const base = cur || {};
        base.background_url = '';
        base.text = Object.assign({color_mode:'auto',color:'#ffffff',opacity:100,font_family:'auto',
            font_size:15,weight:400,italic:false,stroke:0,shadow:0,letter_spacing:0,offset:0,
            line_height:1.72,background_enabled:false,background_auto:true,background_color:'#ffffff',
            background_opacity:88,background_thickness:8,background_blur:18,background_radius:10}, base.text || {});
        localStorage.setItem('ws.ui.appearance', JSON.stringify(base));
        return 'ok';
    })()""")


def apply_scenario(ws, kind, change):
    if kind == 'prefs':
        api('/settings', 'PATCH', {'preferences': change})
    elif kind == 'ls':
        for k, v in change.items():
            ev(ws, "localStorage.setItem(%s, %s)" % (json.dumps(k), json.dumps(v)))
    elif kind == 'appearance':
        ev(ws, """(() => {
            const cur = JSON.parse(localStorage.getItem('ws.ui.appearance') || 'null') || {};
            cur.text = cur.text || {};
            %s
            localStorage.setItem('ws.ui.appearance', JSON.stringify(cur));
            return 'ok';
        })()""" % ' '.join("cur.text.%s = %s;" % (k.replace('.', '.'), json.dumps(v)) for k, v in change.items()))


MEASURE = r"""(() => {
  const root = getComputedStyle(document.documentElement);
  const out = {
    body: { bg: '', color: '' },
    card: { cls: '', bg: '' },
    tokens: {
      leading: root.getPropertyValue('--leading-body').trim(),
      glassBlur: root.getPropertyValue('--glass-blur').trim(),
      glassOpacity: root.getPropertyValue('--glass-opacity').trim(),
      textBase: root.getPropertyValue('--text-base').trim(),
      textXs: root.getPropertyValue('--text-xs').trim(),
      wsTextColor: root.getPropertyValue('--ws-text-color').trim(),
    },
    textSizes: [],
    totalLeaves: 0,
  };
  const bs = getComputedStyle(document.body);
  out.body.bg = bs.backgroundColor; out.body.color = bs.color;
  const card = document.querySelector('[class*="card"]') || document.querySelector('main, article, section');
  if (card) {
    out.card.cls = (card.className || '').toString().slice(0, 40);
    out.card.bg = getComputedStyle(card).backgroundColor;
  }
  let leaves = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length !== 0) continue;
    if (!el.textContent || !el.textContent.trim()) continue;
    leaves += 1;
    if (out.textSizes.length < 400 && el.getClientRects().length > 0) {
      out.textSizes.push(Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10);
    }
  }
  out.totalLeaves = leaves;
  return out;
})()"""


def navigate(ws, url, wait=3.2):
    ws.call('Page.navigate', {'url': ORIGIN + url})
    time.sleep(wait)
    # 等应用挂载完成（有 body 子节点且根属性就绪）
    for _ in range(20):
        try:
            ready = ev(ws, "document.body && document.body.children.length > 0 && document.body.innerText.length > 0")
            if ready:
                break
        except Exception:
            pass
        time.sleep(0.4)
    time.sleep(0.6)


def main():
    with urllib.request.urlopen('http://127.0.0.1:%d/json/list' % PORT, timeout=10) as r:
        pages = json.load(r)
    ws = WS(next(p for p in pages if p.get('type') == 'page')['webSocketDebuggerUrl'])
    ws.call('Page.enable')
    ws.call('Runtime.enable')
    # seed
    ws.call('Page.navigate', {'url': ORIGIN + '/'})
    time.sleep(2.5)
    ev(ws, "localStorage.setItem('ws.authToken', %s); localStorage.setItem('ws.authUser', %s); 'seeded'"
       % (json.dumps(TOKEN), json.dumps({"id": "local", "username": "兰哆哆", "display_name": "兰哆哆", "is_owner": True})))

    report = {}
    for name, url in PAGES:
        print('PAGE', name, flush=True)
        report[name] = {}
        for sid, kind, change in SCENARIOS:
            reset_all(ws)
            apply_scenario(ws, kind, change)
            navigate(ws, url)
            m = ev(ws, MEASURE)
            report[name][sid] = m
            print('   ', sid, 'ok', flush=True)
    json.dump(report, open('/tmp/inherit_audit.json', 'w'), ensure_ascii=False, indent=1)
    print('DONE -> /tmp/inherit_audit.json')


if __name__ == '__main__':
    main()
