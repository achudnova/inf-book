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

async function selectCategory(categoryName, button) {
  state.currentCategory = categoryName;
  state.currentChapter = null;
  clearActiveButtons('.category-button');
  button?.classList.add('active');
  renderChapters();

  const firstChapter = state.categories[categoryName]?.[0];
  if (firstChapter) {
    const firstButton = elements.chapterList.querySelector(
      `.chapter-button[data-file="${CSS.escape(firstChapter.file)}"]`
    );
    if (firstButton) {
      firstButton.click();
    }
  } else {
    showEmptyState('Noch keine Kapitel in dieser Kategorie.');
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
}

async function bootstrap() {
  try {
    const response = await fetch('content/index.json');
    if (!response.ok) {
      throw new Error('Inhaltsverzeichnis konnte nicht geladen werden.');
    }
    state.categories = await response.json();
    state.currentCategory = Object.keys(state.categories)[0] ?? null;
    renderCategories();
    renderChapters();

    const firstCategoryButton = elements.categoryBar.querySelector('.category-button');
    if (firstCategoryButton) {
      firstCategoryButton.click();
    } else {
      showEmptyState('Füge Markdown-Dateien hinzu, um zu starten.');
    }
  } catch (error) {
    console.error(error);
    showEmptyState('Inhalte konnten nicht geladen werden.');
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

