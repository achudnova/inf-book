const STORAGE_KEY = 'inf-book:state';

document.documentElement.classList.add('is-loading');

const state = {
  categories: {},
  currentCategory: null,
  currentChapter: null,
  isSidebarHidden: false,
  isTopbarHidden: false,
  theme: 'dark',
};

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Gespeicherter Status konnte nicht geladen werden.', error);
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentCategory: state.currentCategory,
        currentChapter: state.currentChapter,
        isSidebarHidden: state.isSidebarHidden,
        isTopbarHidden: state.isTopbarHidden,
        theme: state.theme,
      })
    );
  } catch (error) {
    console.warn('Status konnte nicht gespeichert werden.', error);
  }
}

const persistedState = loadSavedState() ?? {};

if (persistedState.theme === 'light' || persistedState.theme === 'dark') {
  state.theme = persistedState.theme;
}

if (typeof persistedState.isSidebarHidden === 'boolean') {
  state.isSidebarHidden = persistedState.isSidebarHidden;
}

if (typeof persistedState.isTopbarHidden === 'boolean') {
  state.isTopbarHidden = persistedState.isTopbarHidden;
}

const elements = {
  categoryBar: document.querySelector('[data-category-bar]'),
  chapterList: document.querySelector('[data-chapter-list]'),
  chapterHeading: document.querySelector('[data-chapter-heading]'),
  content: document.querySelector('[data-content]'),
  sidebarToggle: document.querySelector('[data-sidebar-toggle]'),
  topbarToggles: Array.from(document.querySelectorAll('[data-topbar-toggle]')),
  themeToggle: document.querySelector('[data-theme-toggle]'),
};

function updateThemeToggle(theme) {
  const button = elements.themeToggle;
  if (!button) {
    return;
  }

  const isDark = theme === 'dark';
  const labelKey = isDark ? 'darkLabel' : 'lightLabel';
  const fallbackLabel = isDark ? '🌙 Dunkel' : '✨ Hell';
  button.textContent = button.dataset?.[labelKey] || fallbackLabel;

  const switchLabelKey = isDark ? 'switchToLightLabel' : 'switchToDarkLabel';
  const fallbackSwitchLabel = isDark
    ? 'Zu hellem Thema wechseln'
    : 'Zu dunklem Thema wechseln';

  button.setAttribute(
    'aria-label',
    button.dataset?.[switchLabelKey] || fallbackSwitchLabel
  );
  button.setAttribute('aria-pressed', String(isDark));
}

function setTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  state.theme = normalized;

  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add(`theme-${normalized}`);
  document.body.setAttribute('data-theme', normalized);

  updateThemeToggle(normalized);
}

function getSidebarToggleLabel(hidden) {
  const toggle = elements.sidebarToggle;
  if (!toggle) {
    return '';
  }

  const datasetKey = hidden ? 'showLabel' : 'hideLabel';
  const fallback = hidden ? 'Sidebar anzeigen' : 'Sidebar ausblenden';
  return toggle.dataset?.[datasetKey] || fallback;
}

function setSidebarHidden(hidden) {
  state.isSidebarHidden = hidden;
  document.body.classList.toggle('sidebar-hidden', hidden);

  if (elements.sidebarToggle) {
    const label = getSidebarToggleLabel(hidden);
    const labelElement = elements.sidebarToggle.querySelector(
      '[data-sidebar-label]'
    );
    if (labelElement) {
      labelElement.textContent = label;
    }
    elements.sidebarToggle.setAttribute('aria-label', label);
    elements.sidebarToggle.setAttribute('aria-expanded', String(!hidden));
  }
}

elements.sidebarToggle?.addEventListener('click', () => {
  setSidebarHidden(!state.isSidebarHidden);
  saveState();
});

function getTopbarLabel(toggle, hidden) {
  if (!toggle) {
    return hidden ? 'Top-Bar anzeigen' : 'Top-Bar ausblenden';
  }

  const datasetKey = hidden ? 'showLabel' : 'hideLabel';
  const fallback = hidden ? 'Top-Bar anzeigen' : 'Top-Bar ausblenden';
  return toggle.dataset?.[datasetKey] || fallback;
}

function setTopbarHidden(hidden) {
  state.isTopbarHidden = hidden;
  document.body.classList.toggle('topbar-hidden', hidden);

  elements.topbarToggles.forEach((toggle) => {
    const label = getTopbarLabel(toggle, hidden);
    const labelElement = toggle.querySelector('[data-topbar-label]');
    if (labelElement) {
      labelElement.textContent = label;
    } else {
      toggle.textContent = label;
    }

    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-expanded', String(!hidden));
  });
}

elements.topbarToggles.forEach((toggle) => {
  toggle.addEventListener('click', () => {
    setTopbarHidden(!state.isTopbarHidden);
    saveState();
  });
});

elements.themeToggle?.addEventListener('click', () => {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
  saveState();
});

setTheme(state.theme);
setSidebarHidden(state.isSidebarHidden);
setTopbarHidden(state.isTopbarHidden);

if (window.marked) {
  window.marked.setOptions({
    langPrefix: 'hljs language-',
    highlight(code, language) {
      if (!window.hljs) {
        return code;
      }

      if (language && window.hljs.getLanguage(language)) {
        return window.hljs.highlight(code, { language }).value;
      }

      return window.hljs.highlightAuto(code).value;
    },
  });
}

function createButton({ text, classes = [], onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.classList.add(...classes);
  button.addEventListener('click', onClick);
  return button;
}

function clearActiveButtons(selector) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.remove('active');
  });
}

function setContent(html, sourcePath = '') {
  elements.content.innerHTML = '';
  const article = document.createElement('article');
  article.innerHTML = html;
  resolveMediaSources(article, sourcePath);
  restoreLatexLineBreaks(article);
  applySyntaxHighlighting(article);
  applyMathTypesetting(article);
  elements.content.appendChild(article);
}

function resolveMediaSources(rootElement, sourcePath) {
  if (!sourcePath) {
    return;
  }

  const basePath = sourcePath.replace(/[^/]*$/, '');

  if (!basePath) {
    return;
  }

  rootElement.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src');
    if (src) {
      const resolved = resolveRelativePath(src, basePath);
      if (resolved) {
        image.src = resolved;
      }
    }

    const srcset = image.getAttribute('srcset');
    if (srcset) {
      const resolvedSet = resolveSrcset(srcset, basePath);
      if (resolvedSet) {
        image.setAttribute('srcset', resolvedSet);
      }
    }

    if (!image.hasAttribute('loading')) {
      image.loading = 'lazy';
    }
  });
}

function resolveRelativePath(path, basePath) {
  if (!path || isExternalPath(path) || path.startsWith('/')) {
    return path;
  }

  try {
    const baseUrl = new URL(basePath, `${window.location.origin}/`);
    const resolvedUrl = new URL(path, baseUrl);
    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch (error) {
    console.warn('Bildpfad konnte nicht aufgelöst werden:', path, error);
    return path;
  }
}

function resolveSrcset(srcset, basePath) {
  const entries = srcset
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!entries.length) {
    return srcset;
  }

  return entries
    .map((entry) => {
      const [url, descriptor] = entry.split(/\s+/, 2);
      if (!url) {
        return entry;
      }

      const resolved = resolveRelativePath(url, basePath);
      return descriptor ? `${resolved} ${descriptor}` : resolved;
    })
    .join(', ');
}

function isExternalPath(value) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value) || value.startsWith('//');
}

function applySyntaxHighlighting(rootElement) {
  if (!window.hljs) {
    return;
  }

  rootElement.querySelectorAll('pre code').forEach((block) => {
    window.hljs.highlightElement(block);
  });
}

function applyMathTypesetting(rootElement) {
  if (!window.renderMathInElement) {
    return;
  }

  try {
    window.renderMathInElement(rootElement, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  } catch (error) {
    console.warn('Mathematische Formeln konnten nicht gerendert werden.', error);
  }
}

function restoreLatexLineBreaks(rootElement) {
  const potentialContainers = rootElement.querySelectorAll(
    'p, div, span, li, td, th'
  );

  potentialContainers.forEach((element) => {
    const originalHtml = element.innerHTML;

    if (!originalHtml || !originalHtml.includes('<br')) {
      return;
    }

    const updatedHtml = originalHtml.replace(
      /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g,
      (match) =>
        match.replace(/<br\s*\/?>(?:\n)?/gi, () => {
          return '\\' + '\n';
        })
    );

    if (updatedHtml !== originalHtml) {
      element.innerHTML = updatedHtml;
    }
  });
}

function showEmptyState(message) {
  elements.content.innerHTML = `<div class="empty-state">${message}</div>`;
}

async function loadMarkdown(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Datei konnte nicht geladen werden: ${response.status}`);
    }
    const markdown = await response.text();
    if (!window.marked?.parse) {
      throw new Error('Markdown-Renderer konnte nicht initialisiert werden.');
    }
    return window.marked.parse(markdown);
  } catch (error) {
    console.error(error);
    showEmptyState('Dieses Kapitel konnte nicht geladen werden.');
    return null;
  }
}

function renderCategories() {
  elements.categoryBar.innerHTML = '';
  Object.keys(state.categories).forEach((categoryName) => {
    const button = createButton({
      text: categoryName,
      classes: ['category-button'],
      onClick: () => selectCategory(categoryName, button),
    });
    button.dataset.category = categoryName;
    if (categoryName === state.currentCategory) {
      button.classList.add('active');
    }
    elements.categoryBar.appendChild(button);
  });
}

function renderChapters() {
  elements.chapterList.innerHTML = '';
  const chapters = state.categories[state.currentCategory] || [];
  elements.chapterHeading.textContent = state.currentCategory || 'Kapitel';

  if (!chapters.length) {
    showEmptyState('Noch keine Kapitel in dieser Kategorie.');
    return;
  }

  chapters.forEach(({ title, file }) => {
    const button = createButton({
      text: title,
      classes: ['chapter-button'],
      onClick: () => selectChapter(title, file, button),
    });
    button.dataset.file = file;
    if (state.currentChapter && state.currentChapter.file === file) {
      button.classList.add('active');
    }
    elements.chapterList.appendChild(button);
  });
}

async function selectCategory(categoryName, button, options = {}) {
  const { preserveChapter = false } = options;
  state.currentCategory = categoryName;

  const chapters = state.categories[categoryName] || [];

  if (preserveChapter && state.currentChapter) {
    const matchingChapter = chapters.find(
      ({ file }) => file === state.currentChapter.file
    );
    state.currentChapter = matchingChapter
      ? { title: matchingChapter.title, file: matchingChapter.file }
      : null;
  } else {
    state.currentChapter = null;
  }

  clearActiveButtons('.category-button');
  const categoryButton =
    button ??
    elements.categoryBar.querySelector(
      `.category-button[data-category="${CSS.escape(categoryName)}"]`
    );
  categoryButton?.classList.add('active');

  renderChapters();

  if (!chapters.length) {
    saveState();
    return;
  }

  const targetChapter = state.currentChapter || chapters[0] || null;

  if (!targetChapter) {
    showEmptyState('Noch keine Kapitel in dieser Kategorie.');
    saveState();
    return;
  }

  const targetButton = elements.chapterList.querySelector(
    `.chapter-button[data-file="${CSS.escape(targetChapter.file)}"]`
  );

  if (targetButton) {
    if (!state.currentChapter) {
      state.currentChapter = { title: targetChapter.title, file: targetChapter.file };
    }
    targetButton.click();
  } else {
    saveState();
  }
}

async function selectChapter(title, file, button) {
  state.currentChapter = { title, file };
  clearActiveButtons('.chapter-button');
  button?.classList.add('active');

  const html = await loadMarkdown(file);
  if (html) {
    setContent(html, file);
  }

  saveState();
}

async function bootstrap() {
  try {
    const response = await fetch('content/index.json');
    if (!response.ok) {
      throw new Error('Inhaltsverzeichnis konnte nicht geladen werden.');
    }
    state.categories = await response.json();

    const savedState = persistedState;
    const availableCategories = Object.keys(state.categories);

    if (
      savedState.currentCategory &&
      availableCategories.includes(savedState.currentCategory)
    ) {
      state.currentCategory = savedState.currentCategory;
      const chapters = state.categories[state.currentCategory] || [];
      const matchingChapter = chapters.find(
        ({ file }) => savedState.currentChapter?.file === file
      );
      if (matchingChapter) {
        state.currentChapter = {
          title: matchingChapter.title,
          file: matchingChapter.file,
        };
      } else {
        state.currentChapter = null;
      }
    } else {
      state.currentCategory = availableCategories[0] ?? null;
      state.currentChapter = null;
    }

    renderCategories();

    if (state.currentCategory) {
      selectCategory(state.currentCategory, null, {
        preserveChapter: Boolean(state.currentChapter),
      });
    } else {
      showEmptyState('Füge Markdown-Dateien hinzu, um zu starten.');
    }
  } catch (error) {
    console.error(error);
    showEmptyState('Inhalte konnten nicht geladen werden.');
  } finally {
    document.documentElement.classList.remove('is-loading');
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

