// School Browser SPA — stores tabs, history, and settings in localStorage
(() => {
  const STORAGE_KEYS = {
    tabs: 'school_browser_tabs_v1',
    history: 'school_browser_history_v1',
    settings: 'school_browser_settings_v1'
  };

  // Default settings
  const defaultSettings = {
    defaultEngine: 'duckduckgo',
    safeSearch: true,
    bgColor: '#f5f7fb',
    bgImage: null, // data URL
  };

  const engines = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=', safeParam: '&safe=active' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', safeParam: '&adlt=strict' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', safeParam: '&kp=-2' } // note: kp param may adjust filtering
  };

  // UI elements
  const engineSelect = document.getElementById('engineSelect');
  const addressInput = document.getElementById('addressInput');
  const goBtn = document.getElementById('goBtn');
  const newTabBtn = document.getElementById('newTabBtn');
  const tabsContainer = document.getElementById('tabsContainer');
  const pages = document.getElementById('pages');
  const historyBtn = document.getElementById('historyBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const settingsSection = document.getElementById('settingsSection');
  const defaultEngineEl = document.getElementById('defaultEngine');
  const safeSearchToggle = document.getElementById('safeSearchToggle');
  const bgColorEl = document.getElementById('bgColor');
  const bgImageFile = document.getElementById('bgImageFile');
  const applySettingsBtn = document.getElementById('applySettings');
  const resetSettingsBtn = document.getElementById('resetSettings');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const downloadHistoryBtn = document.getElementById('downloadHistory');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');

  // State
  let tabs = load(STORAGE_KEYS.tabs) || [];
  let history = load(STORAGE_KEYS.history) || [];
  let settings = load(STORAGE_KEYS.settings) || defaultSettings;

  // Helpers
  function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function load(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function nowISO(){ return (new Date()).toISOString() }

  // Tab functions
  function createTab({title = 'New tab', url = '', active = true} = {}) {
    const id = 'tab_' + Math.random().toString(36).slice(2,9);
    const tab = { id, title, url, createdAt: nowISO() };
    tabs.push(tab);
    save(STORAGE_KEYS.tabs, tabs);
    renderTabs();
    if (active) activateTab(id);
    return tab;
  }

  function activateTab(id) {
    document.querySelectorAll('.tab-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    // remove from state
    tabs.splice(idx,1);
    save(STORAGE_KEYS.tabs, tabs);
    // remove DOM
    const tabEl = document.querySelector(`.tab-item[data-id="${id}"]`);
    if (tabEl) tabEl.remove();
    const pageEl = document.querySelector(`.page[data-id="${id}"]`);
    if (pageEl) pageEl.remove();
    // activate the last tab if any
    if (tabs.length) {
      activateTab(tabs[tabs.length-1].id);
    }
  }

  function openUrlInTab(id, url) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    tab.url = url;
    tab.title = url;
    save(STORAGE_KEYS.tabs, tabs);
    // update iframe src
    const pageEl = document.querySelector(`.page[data-id="${id}"]`);
    if (pageEl) {
      let iframe = pageEl.querySelector('iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        pageEl.appendChild(iframe);
      }
      // attempt to load in iframe; if blocked, will open in new window on error/timeouts
      iframe.src = url;
      // record history
      addHistory({title: url, url});
    }
  }

  // History
  function addHistory(entry){
    entry.timestamp = nowISO();
    history.unshift(entry);
    if (history.length > 1000) history.length = 1000; // cap
    save(STORAGE_KEYS.history, history);
    renderHistory();
  }

  // Render
  function renderTabs(){
    // clear and re-create
    tabsContainer.innerHTML = '';
    pages.innerHTML = '';
    tabs.forEach((t, idx) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item' + (idx === tabs.length-1 ? ' active' : '');
      tabEl.dataset.id = t.id;
      tabEl.innerHTML = `<div class="title">${escapeHTML(t.title)}</div><div class="controls"><button class="closeBtn" title="Close">✕</button></div>`;
      tabEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('closeBtn')) return;
        activateTab(t.id);
      });
      tabEl.querySelector('.closeBtn').addEventListener('click', (e)=>{
        e.stopPropagation();
        closeTab(t.id);
      });
      tabsContainer.appendChild(tabEl);

      const page = document.createElement('div');
      page.className = 'page' + (idx === tabs.length-1 ? ' active' : '');
      page.dataset.id = t.id;
      // create iframe only if url present
      if (t.url) {
        const iframe = document.createElement('iframe');
        iframe.src = t.url;
        iframe.loading = 'lazy';
        iframe.addEventListener('load', () => {
          // optional: record title if possible (cross-origin may block)
          try {
            const docTitle = iframe.contentDocument && iframe.contentDocument.title;
            if (docTitle) {
              t.title = docTitle;
              save(STORAGE_KEYS.tabs, tabs);
              renderTabs();
            }
          } catch (e) {}
        });
        page.appendChild(iframe);
      } else {
        page.innerHTML = `<div class="blank" style="padding:18px;color:var(--muted)">New blank tab. Use the address/search bar to load a site or search.</div>`;
      }
      pages.appendChild(page);
    });
  }

  function renderHistory(){
    historyList.innerHTML = '';
    if (!history.length) {
      historyList.innerHTML = `<div class="empty" style="color:var(--muted)">No history yet.</div>`;
      return;
    }
    history.forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-row';
      const t = new Date(h.timestamp).toLocaleString();
      row.innerHTML = `<div class="h-title"><a href="#" data-url="${escapeHTMLAttr(h.url)}">${escapeHTML(h.title || h.url)}</a></div><div class="h-meta">${t}</div>`;
      row.querySelector('a').addEventListener('click', (e)=>{
        e.preventDefault();
        // open in new tab
        const newTab = createTab({title: h.title || h.url, url: h.url, active:true});
        renderTabs();
        activateTab(newTab.id);
      });
      historyList.appendChild(row);
    });
  }

  // Settings UI
  function applySettingsToUI(){
    defaultEngineEl.value = settings.defaultEngine || defaultSettings.defaultEngine;
    safeSearchToggle.checked = !!settings.safeSearch;
    bgColorEl.value = settings.bgColor || defaultSettings.bgColor;
    // background image not set in file input (can't populate)
    applyBackground();
  }

  function applyBackground(){
    if (settings.bgImage) {
      document.body.style.backgroundImage = `url(${settings.bgImage})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = '';
    }
    document.body.style.backgroundColor = settings.bgColor || defaultSettings.bgColor;
  }

  // Actions
  function performSearchOrGo(text, engineKey = null, openInNewTab = true){
    if (!text) return;
    const isUrl = looksLikeUrl(text);
    const engine = engineKey || settings.defaultEngine || defaultSettings.defaultEngine;
    let url;
    if (isUrl) {
      url = normalizeUrl(text);
    } else {
      const e = engines[engine] || engines.duckduckgo;
      url = e.url + encodeURIComponent(text);
      if (settings.safeSearch && e.safeParam) url += e.safeParam;
    }

    // Try to open in active tab; detect active tab id
    const activePage = document.querySelector('.page.active');
    if (activePage && !openInNewTab) {
      openUrlInTab(activePage.dataset.id, url);
      return;
    }

    // open new tab and attempt to load in iframe (many sites block embedding). If blocked, fallback to window.open
    const newT = createTab({title: url, url, active: true});
    renderTabs();
    activateTab(newT.id);

    // Add to history
    addHistory({ title: text, url });
  }

  // Utilities
  function looksLikeUrl(s){
    // quick heuristic
    return s.includes('.') || s.startsWith('http') || s.startsWith('www.');
  }
  function normalizeUrl(s){
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return 'https://' + s;
  }
  function escapeHTML(s){ return String(s).replace(/[&<>\