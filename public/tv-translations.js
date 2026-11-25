// Real-time TV panel translation for Croatian, German, English and Italian.
// Stores the selected language locally and translates visible text on demand.
(function () {
  const SUPPORTED = ['hr', 'de', 'en', 'it'];
  const LABELS = { hr: 'HR', de: 'DE', en: 'EN', it: 'IT' };
  const TRANSLATION_URL = 'https://api.mymemory.translated.net/get';
  const CACHE_PREFIX = 'tvTextTranslation:';
  const originalText = new WeakMap();
  let activeLanguage = getInitialLanguage();
  let translateQueue = Promise.resolve();

  function getInitialLanguage() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('lang');
    if (fromUrl === 'bs') return 'hr';
    if (SUPPORTED.includes(fromUrl)) return fromUrl;
    const saved = localStorage.getItem('tvLanguage');
    if (saved === 'bs') return 'hr';
    return SUPPORTED.includes(saved) ? saved : 'hr';
  }

  function addLanguageToUrl(url) {
    try {
      const target = new URL(url, window.location.href);
      if (activeLanguage !== 'hr') target.searchParams.set('lang', activeLanguage);
      else target.searchParams.delete('lang');
      return target.toString();
    } catch (_) {
      return url;
    }
  }

  function cacheKey(text, source, target) {
    return CACHE_PREFIX + source + ':' + target + ':' + text;
  }

  async function translateText(text, target) {
    const source = 'hr';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned || target === source) return text;

    const key = cacheKey(cleaned, source, target);
    const cached = localStorage.getItem(key);
    if (cached) return cached;

    try {
      const response = await fetch(`${TRANSLATION_URL}?q=${encodeURIComponent(cleaned)}&langpair=${source}|${target}`);
      if (!response.ok) throw new Error(`Translation API returned ${response.status}`);
      const data = await response.json();
      const translated = data?.responseData?.translatedText;
      if (!translated) return text;
      localStorage.setItem(key, translated);
      return translated;
    } catch (error) {
      console.warn('[TV Translation] Failed to translate:', cleaned, error);
      return text;
    }
  }

  function shouldSkip(node) {
    const element = node.parentElement;
    if (!element) return true;
    if (element.closest('script, style, code, pre, input, textarea, select, [contenteditable="true"]')) return true;
    return element.closest('[aria-hidden="true"]') !== null;
  }

  function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent.trim() || shouldSkip(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  async function applyLanguage(language) {
    activeLanguage = language;
    localStorage.setItem('tvLanguage', language);

    document.documentElement.lang = language;
    const params = new URLSearchParams(window.location.search);
    if (language === 'hr') params.delete('lang');
    else params.set('lang', language);
    const nextUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);

    const nodes = collectTextNodes(document.body);

    translateQueue = translateQueue.then(async () => {
      if (language === 'hr') {
        nodes.forEach((node) => {
          const original = originalText.get(node);
          if (original !== undefined) node.textContent = original;
        });
        return;
      }

      const pending = [];
      for (const node of nodes) {
        if (!originalText.has(node)) originalText.set(node, node.textContent);
        const original = originalText.get(node);
        pending.push(translateText(original, language).then((translated) => {
          if (activeLanguage === language) node.textContent = translated;
        }));
      }
      await Promise.all(pending);
    });
  }

  function injectSelector() {
    if (document.getElementById('tvLanguageSelector')) return;

    const style = document.createElement('style');
    style.textContent = `
      #tvLanguageSelector {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 1000;
        display: flex;
        gap: 6px;
        padding: 6px;
        border: 1px solid rgba(212,175,55,.38);
        border-radius: 999px;
        background: rgba(7,17,29,.96);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
      }
      #tvLanguageSelector button {
        min-width: 42px;
        height: 36px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #b8c2cf;
        font: 700 12px Inter, Arial, sans-serif;
        cursor: pointer;
      }
      #tvLanguageSelector button.active {
        background: linear-gradient(135deg,#d4af37,#bd9230);
        color: #101820;
      }
      #tvLanguageSelector button:focus-visible {
        outline: 3px solid #d4af37;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);

    const selector = document.createElement('nav');
    selector.id = 'tvLanguageSelector';
    selector.setAttribute('aria-label', 'Odabir jezika / Language');

    SUPPORTED.forEach((language) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = LABELS[language];
      button.dataset.language = language;
      button.className = language === activeLanguage ? 'active' : '';
      button.setAttribute('aria-label', {
        hr: 'Hrvatski', de: 'Deutsch', en: 'English', it: 'Italiano'
      }[language]);
      button.addEventListener('click', () => {
        selector.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        applyLanguage(language);
      });
      selector.appendChild(button);
    });

    document.body.appendChild(selector);
  }

  window.tvTranslationAddLanguageToUrl = addLanguageToUrl;

  const observer = new MutationObserver(() => {
    if (activeLanguage === 'hr') return;
    clearTimeout(window.__tvTranslationTimer);
    window.__tvTranslationTimer = setTimeout(() => applyLanguage(activeLanguage), 180);
  });

  injectSelector();
  if (activeLanguage !== 'hr') applyLanguage(activeLanguage);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
