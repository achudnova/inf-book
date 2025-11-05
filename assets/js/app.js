const STORAGE_KEY = 'inf-book:state';

const state = {
  categories: {},
  currentCategory: null,
  currentChapter: null,
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
      })
    );
  } catch (error) {
    console.warn('Status konnte nicht gespeichert werden.', error);
  }
}

const elements = {
  categoryBar: document.querySelector('[data-category-bar]'),
  chapterList: document.querySelector('[data-chapter-list]'),
  chapterHeading: document.querySelector('[data-chapter-heading]'),
  content: document.querySelector('[data-content]'),
};

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
    setContent(html);
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

    const savedState = loadSavedState() ?? {};
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
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

