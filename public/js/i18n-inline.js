/* Minimal i18n bootstrap for legacy HTML pages.
   Loads only the active locale file: /locales/<lang>.js
*/
(function () {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\\/\+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setCookie(name, value, days) {
    const maxAge = days ? '; Max-Age=' + String(days * 24 * 60 * 60) : '';
    document.cookie = name + '=' + encodeURIComponent(value) + maxAge + '; Path=/; SameSite=Lax';
  }

  const url = new URL(window.location.href);
  const urlLang = (url.searchParams.get('lang') || '').toLowerCase();
  const savedLang = (localStorage.getItem('language') || '').toLowerCase();
  const cookieLang = (getCookie('lang') || '').toLowerCase();

  const supported = (window.SUPPORTED_LANGS && typeof window.SUPPORTED_LANGS === 'object') ? Object.keys(window.SUPPORTED_LANGS) : [];
  const fallback = 'en';

  function isValid(code) {
    if (!code) return false;
    if (!supported.length) return true;
    return supported.includes(code);
  }

  const lang = isValid(urlLang) ? urlLang : (isValid(savedLang) ? savedLang : (isValid(cookieLang) ? cookieLang : fallback));

  try { localStorage.setItem('language', lang); } catch (_) {}
  setCookie('lang', lang, 365);

  const rtl = (window.RTL_LANGS || ['fa','ar','he']).includes(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';

  // Load locale without blocking HTML parsing.
  // NOTE: this file must NOT be loaded with `defer` because it uses document.write during parse.
  const localeSrc = '/locales/' + lang + '.js';
  try {
    document.write('<link rel="preload" as="script" href="' + localeSrc + '">');
  } catch (_) {}
  document.write('<script src="' + localeSrc + '" defer><\/script>');
})();