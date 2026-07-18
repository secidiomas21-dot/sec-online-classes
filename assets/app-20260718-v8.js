(() => {
  const catalog = window.SEC_CATALOG;
  const levels = catalog.levels;
  const $ = (selector) => document.querySelector(selector);
  const pages = [...document.querySelectorAll('.page')];
  let current = { level: null, category: null, item: null, query: '' };

  function icon(name) {
    const icons = { back: '←', book: '▣', audio: '▶', open: '↗' };
    return icons[name] || '';
  }

  function show(id) {
    pages.forEach((page) => page.classList.toggle('active', page.id === id));
    window.scrollTo(0, 0);
  }

  function applyTheme(levelKey) {
    const level = levels[levelKey];
    if (!level) return;
    document.documentElement.style.setProperty('--level', level.color);
    document.documentElement.style.setProperty('--level-bg1', level.gradient[0]);
    document.documentElement.style.setProperty('--level-bg2', level.gradient[1]);
  }

  function buildHome() {
    const grid = $('#levels-grid');
    grid.innerHTML = '';
    Object.entries(levels).forEach(([key, level]) => {
      const button = document.createElement('button');
      button.className = 'level-card';
      button.style.setProperty('--c1', level.gradient[0]);
      button.style.setProperty('--c2', level.gradient[1]);
      button.style.setProperty('--level', level.color);
      button.disabled = !level.available;
      const labels = Object.values(level.categories).map((category) => category.label).join(' · ');
      button.innerHTML = `<div class="level-icon">${icon('book')}</div><h2>${level.label}</h2><p>${labels}</p>`;
      if (level.available) button.onclick = () => openLevel(key);
      grid.appendChild(button);
    });
  }

  function openLevel(levelKey, category) {
    const level = levels[levelKey];
    if (!level || !level.available) return;
    applyTheme(levelKey);
    current.level = levelKey;
    current.category = category && level.categories[category] ? category : Object.keys(level.categories)[0];
    current.item = null;
    current.query = '';
    $('#level-badge').textContent = level.label;
    $('#level-title').textContent = level.label;

    const tabs = $('#category-tabs');
    tabs.innerHTML = '';
    Object.entries(level.categories).forEach(([key, categoryData]) => {
      const button = document.createElement('button');
      button.className = `tab${key === current.category ? ' active' : ''}`;
      button.textContent = categoryData.label;
      button.onclick = () => {
        current.category = key;
            current.query = '';
        renderLevel();
        location.hash = `#/${levelKey}/${key}`;
      };
      tabs.appendChild(button);
    });

    renderLevel();
    show('library-page');
    const desired = `#/${levelKey}/${current.category}`;
    if (location.hash !== desired) location.hash = desired;
  }

  function renderLevel() {
    const level = levels[current.level];
    applyTheme(current.level);
    [...document.querySelectorAll('.tab')].forEach((button, index) => {
      button.classList.toggle('active', Object.keys(level.categories)[index] === current.category);
    });

    const resource = $('#resource-slot');
    resource.innerHTML = '';
    if (current.category === 'unit' && level.resource) {
      const audio = level.resource.media.find((media) => media.type === 'audio');
      resource.innerHTML = `<div class="resource-card"><strong>${level.resource.label}</strong><audio controls preload="metadata" src="${audio.path}"></audio></div>`;
    }

    const input = $('#search-input');
    input.value = '';
    input.placeholder = `Search ${level.categories[current.category].label.toLowerCase()}...`;
    input.oninput = () => {
      current.query = input.value;
        renderCards(current.query);
    };
    renderCards('');
  }

  function renderCards(query) {
    const category = levels[current.level].categories[current.category];
    const normalizedQuery = query.trim().toLowerCase();
    const visibleItems = category.items.filter((item) => {
      return !normalizedQuery || `${item.number} ${item.title}`.toLowerCase().includes(normalizedQuery);
    });

    const grid = $('#items-grid');
    grid.innerHTML = '';
    visibleItems.forEach((item) => {
      const button = document.createElement('button');
      button.className = 'item-card';
      button.disabled = !item.available;
      button.innerHTML = `<span class="item-kicker">${item.label}</span><span class="item-number">${String(item.number).padStart(2, '0')}</span><span class="item-title">${item.title}</span>${!item.available ? '<span class="pending">Unavailable</span>' : ''}`;
      if (item.available) button.onclick = () => openItem(current.level, current.category, item.id);
      grid.appendChild(button);
    });
    if (!visibleItems.length) grid.innerHTML = '<div class="empty-state">No results.</div>';
  }

  function openItem(levelKey, category, id) {
    const level = levels[levelKey];
    const categoryData = level?.categories[category];
    const item = categoryData?.items.find((entry) => String(entry.id) === String(id));
    if (!item) return;

    applyTheme(levelKey);
    current.level = levelKey;
    current.category = category;
    current.item = item;
    $('#viewer-badge').textContent = `${level.label} · ${item.label} ${String(item.number).padStart(2, '0')}`;
    $('#viewer-title').textContent = item.title;

    const stack = $('#media-stack');
    stack.innerHTML = '';
    const audios = item.media.filter((media) => media.type === 'audio');
    const pdfs = item.media.filter((media) => media.type === 'pdf');

    audios.forEach((media) => {
      const card = document.createElement('section');
      card.className = 'media-card';
      card.innerHTML = `<h2>${media.label}</h2><audio class="audio-player" controls preload="metadata" src="${media.path}"></audio>`;
      stack.appendChild(card);
    });
    pdfs.forEach((media) => {
      const card = document.createElement('section');
      card.className = 'media-card';
      card.innerHTML = `<h2>${media.label}</h2><div class="pdf-actions"><a class="primary-link" href="${media.path}" target="_blank" rel="noopener">Open PDF ${icon('open')}</a></div><iframe class="pdf-frame" src="${media.path}#view=FitH" title="${item.title}"></iframe>`;
      stack.appendChild(card);
    });
    if (!item.media.length) stack.innerHTML = '<div class="empty-state">Unavailable.</div>';
    show('viewer-page');
    const desired = `#/${levelKey}/${category}/${id}`;
    if (location.hash !== desired) location.hash = desired;
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) {
      show('home-page');
      return;
    }
    const [level, category, id] = parts;
    if (id) openItem(level, category, id);
    else openLevel(level, category);
  }

  $('#home-back').onclick = () => { location.hash = '#/'; };
  $('#viewer-back').onclick = () => { location.hash = `#/${current.level}/${current.category}`; };
  window.addEventListener('hashchange', route);
  buildHome();
  route();
})();
