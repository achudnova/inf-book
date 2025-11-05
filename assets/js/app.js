const state = {
  categories: {},
  currentCategory: null,
  currentChapter: null,
};

const elements = {
  categoryBar: document.querySelector('[data-category-bar]'),
  chapterList: document.querySelector('[data-chapter-list]'),
  chapterHeading: document.querySelector('[data-chapter-heading]'),
  content: document.querySelector('[data-content]'),
  uploadTrigger: document.querySelector('[data-upload-trigger]'),
  folderInput: document.querySelector('[data-folder-input]'),
};

function createButton({ text, classes = [], onClick, dataset = {} }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.classList.add(...classes);
  Object.entries(dataset).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  button.addEventListener('click', onClick);
  return button;
}

function clearActiveButtons(selector) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.remove('active');
  });
}

function setContent(html) {
  elements.content.innerHTML = '';
  const article = document.createElement('article');
  article.innerHTML = html;
  elements.content.appendChild(article);
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
    return window.marked.parse(markdown);
  } catch (error) {
    console.error(error);
    showEmptyState('Dieses Kapitel konnte nicht geladen werden.');
    return null;
  }
}

function normalizeManifest(manifest) {
  const categories = {};
  Object.entries(manifest).forEach(([category, chapters = []]) => {
    categories[category] = chapters.map((chapter) => ({
      id: `${category}-${chapter.file}`,
      title: chapter.title,
      file: chapter.file,
      source: 'remote',
    }));
  });
  return categories;
}

function renderCategories() {
  elements.categoryBar.innerHTML = '';
  const categoryNames = Object.keys(state.categories);

  if (!categoryNames.length) {
    return;
  }

  categoryNames.forEach((categoryName) => {
    const button = createButton({
      text: categoryName,
      classes: ['category-button'],
      onClick: () => selectCategory(categoryName, button),
      dataset: { category: categoryName },
    });
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

  if (!state.currentCategory) {
    showEmptyState('Wähle eine Kategorie oder lade Inhalte hoch.');
    return;
  }

  if (!chapters.length) {
    showEmptyState('Noch keine Kapitel in dieser Kategorie.');
    return;
  }

  chapters.forEach((chapter) => {
    const button = createButton({
      text: chapter.title,
      classes: ['chapter-button'],
      onClick: () => selectChapter(chapter, button),
      dataset: { file: chapter.file || chapter.title },
    });
    if (state.currentChapter && state.currentChapter.id === chapter.id) {
      button.classList.add('active');
    }
    elements.chapterList.appendChild(button);
  });
}

async function selectCategory(categoryName, button) {
  state.currentCategory = categoryName;
  state.currentChapter = null;
  clearActiveButtons('.category-button');
  button?.classList.add('active');
  renderChapters();

  const firstChapter = state.categories[categoryName]?.[0];
  if (firstChapter) {
    const firstButton = elements.chapterList.querySelector('.chapter-button');
    firstButton?.click();
  } else {
    showEmptyState('Noch keine Kapitel in dieser Kategorie.');
  }
}

async function loadChapterContent(chapter) {
  if (chapter.html) {
    return chapter.html;
  }

  if (chapter.source === 'local' && chapter.markdown) {
    chapter.html = window.marked.parse(chapter.markdown);
    return chapter.html;
  }

  if (chapter.source === 'remote' && chapter.file) {
    const html = await loadMarkdown(chapter.file);
    if (html) {
      chapter.html = html;
    }
    return chapter.html;
  }

  return null;
}

async function selectChapter(chapter, button) {
  state.currentChapter = chapter;
  clearActiveButtons('.chapter-button');
  button?.classList.add('active');

  const html = await loadChapterContent(chapter);
  if (html) {
    setContent(html);
  }
}

function resetNavigation() {
  renderCategories();
  renderChapters();

  const firstCategoryButton = elements.categoryBar.querySelector('.category-button');
  firstCategoryButton?.click();
}

function formatTitleFromFilename(filename) {
  return filename
    .replace(/\.md$/i, '')
    .split(/[\-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

async function handleFolderUpload(event) {
  const files = Array.from(event.target.files || []).filter((file) =>
    file.name.toLowerCase().endsWith('.md'),
  );

  if (!files.length) {
    showEmptyState('Keine Markdown-Dateien im ausgewählten Ordner gefunden.');
    return;
  }

  const categories = {};

  await Promise.all(
    files.map(async (file) => {
      const relativePath = file.webkitRelativePath || file.name;
      const segments = relativePath.split('/').filter(Boolean);
      if (segments.length < 1) {
        return;
      }

      const categoryName = segments[0];
      const chapterId = relativePath;
      const title = formatTitleFromFilename(segments[segments.length - 1]);
      const markdown = await file.text();

      if (!categories[categoryName]) {
        categories[categoryName] = [];
      }

      categories[categoryName].push({
        id: chapterId,
        title,
        file: relativePath,
        source: 'local',
        markdown,
      });
    }),
  );

  Object.values(categories).forEach((chapters) => {
    chapters.sort((a, b) => (a.file || a.title).localeCompare(b.file || b.title, 'de'));
  });

  const mergedCategories = { ...state.categories };

  Object.entries(categories).forEach(([categoryName, newChapters]) => {
    const existingChapters = mergedCategories[categoryName] ? [...mergedCategories[categoryName]] : [];
    const chapterMap = new Map(existingChapters.map((chapter) => [chapter.id ?? chapter.file, chapter]));

    newChapters.forEach((chapter) => {
      chapterMap.set(chapter.id ?? chapter.file, chapter);
    });

    mergedCategories[categoryName] = Array.from(chapterMap.values()).sort((a, b) => {
      const keyA = (a.file || a.title || '').toLowerCase();
      const keyB = (b.file || b.title || '').toLowerCase();
      return keyA.localeCompare(keyB, 'de');
    });
  });

  const sortedCategoryEntries = Object.entries(mergedCategories)
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([categoryName, chapters]) => [
      categoryName,
      [...chapters].sort((a, b) => {
        const keyA = (a.file || a.title || '').toLowerCase();
        const keyB = (b.file || b.title || '').toLowerCase();
        return keyA.localeCompare(keyB, 'de');
      }),
    ]);

  state.categories = Object.fromEntries(sortedCategoryEntries);

  if (!state.currentCategory || !state.categories[state.currentCategory]) {
    state.currentCategory = Object.keys(state.categories)[0] || null;
  }

  state.currentChapter = null;
  resetNavigation();
  elements.folderInput.value = '';
}

function initializeUploadHandling() {
  elements.uploadTrigger?.addEventListener('click', () => {
    elements.folderInput?.click();
  });

  elements.folderInput?.addEventListener('change', handleFolderUpload);
}

async function bootstrap() {
  initializeUploadHandling();

  if (window.location.protocol === 'file:') {
    showEmptyState('Nutze „Ordner hochladen“, um Inhalte anzuzeigen.');
    return;
  }

  try {
    const response = await fetch('content/index.json');
    if (!response.ok) {
      throw new Error('Inhaltsverzeichnis konnte nicht geladen werden.');
    }
    const manifest = await response.json();
    state.categories = normalizeManifest(manifest);
    state.currentCategory = Object.keys(state.categories)[0] ?? null;
    resetNavigation();
  } catch (error) {
    console.error(error);
    showEmptyState(
      'Inhalte konnten nicht geladen werden. Lade stattdessen einen Ordner hoch.',
    );
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
