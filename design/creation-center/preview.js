(() => {
  const params = new URLSearchParams(window.location.search);
  const variants = ['a', 'b', 'c'];
  const variant = variants.includes(params.get('variant')) ? params.get('variant') : 'a';
  let lang = params.get('lang') === 'en' ? 'en' : 'zh';

  document.body.classList.remove('variant-a', 'variant-b', 'variant-c');
  document.body.classList.add(`variant-${variant}`);
  document.body.classList.toggle('bare', params.get('bare') === '1');

  const buttons = Array.from(document.querySelectorAll('[data-variant]'));
  const syncButtons = () => {
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.variant === variant);
    });
  };
  syncButtons();

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.variant;
      if (!variants.includes(next)) return;
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set('variant', next);
      window.location.search = nextParams.toString();
    });
  });

  const applyLanguage = () => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-zh][data-en]').forEach((node) => {
      const value = node.getAttribute(lang === 'en' ? 'data-en' : 'data-zh');
      if (value !== null) node.textContent = value;
    });
    document.querySelectorAll('[data-zh-placeholder][data-en-placeholder]').forEach((node) => {
      const value = node.getAttribute(lang === 'en' ? 'data-en-placeholder' : 'data-zh-placeholder');
      if (value !== null) node.setAttribute('placeholder', value);
    });
    document.title = lang === 'en' ? 'Creation Center · Visual directions' : '创作中心首页 · 三套视觉方案';
  };

  applyLanguage();

  const languageToggle = document.getElementById('languageToggle');
  languageToggle?.addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    applyLanguage();
    const nextParams = new URLSearchParams(window.location.search);
    if (lang === 'en') nextParams.set('lang', 'en');
    else nextParams.delete('lang');
    window.history.replaceState(null, '', `${window.location.pathname}?${nextParams.toString()}`);
  });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === '1' || event.key === '2' || event.key === '3') {
      const next = variants[Number(event.key) - 1];
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set('variant', next);
      window.location.search = nextParams.toString();
    }
  });
})();

// 供本地视觉审查使用：?audit=1 时把布局测量结果写入隐藏节点，不影响截图。
if (new URLSearchParams(window.location.search).get('audit') === '1') {
  window.requestAnimationFrame(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        x: Math.round(box.x), y: Math.round(box.y),
        width: Math.round(box.width), height: Math.round(box.height),
        scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight,
        clippedX: node.scrollWidth > node.clientWidth + 1,
        clippedY: node.scrollHeight > node.clientHeight + 1,
      };
    };
    const toolNames = Array.from(document.querySelectorAll('.tool-name')).map((node) => ({
      text: node.textContent.trim(),
      width: Math.round(node.getBoundingClientRect().width),
      scrollWidth: node.scrollWidth,
      clipped: node.scrollWidth > node.clientWidth + 1,
    }));
    const result = {
      variant: document.body.className,
      lang: document.documentElement.lang,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
      topbar: rect('.topbar'),
      content: rect('.content'),
      hero: rect('.hero'),
      scenes: rect('.scenes-grid'),
      sceneCards: Array.from(document.querySelectorAll('.scene-card')).map((node) => {
        const box = node.getBoundingClientRect();
        return { width: Math.round(box.width), height: Math.round(box.height) };
      }),
      toolsSection: rect('.section'),
      toolsPanel: rect('.tools-panel'),
      toolNames,
      assetsPanel: rect('.assets-panel'),
      assetItems: Array.from(document.querySelectorAll('.asset')).map((node) => {
        const box = node.getBoundingClientRect();
        return { width: Math.round(box.width), height: Math.round(box.height) };
      }),
      cloud: rect('.cloud-launcher'),
    };
    const pre = document.createElement('pre');
    pre.id = 'layout-audit';
    pre.style.display = 'none';
    pre.textContent = JSON.stringify(result);
    document.body.appendChild(pre);
  });
}
