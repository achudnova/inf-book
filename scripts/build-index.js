#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const INDEX_PATH = path.join(CONTENT_DIR, 'index.json');

async function loadExistingSectionTitles() {
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf8');
    const data = JSON.parse(raw);
    const map = new Map();

    for (const [sectionTitle, entries] of Object.entries(data)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || typeof entry.file !== 'string') continue;
        const parts = entry.file.split(/[\\/]/);
        if (parts.length < 2) continue;
        const folder = parts[1];
        if (!map.has(folder)) {
          map.set(folder, sectionTitle);
        }
      }
    }

    return map;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return new Map();
    }
    throw error;
  }
}

async function deriveTitle(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^#\s+(.+?)\s*$/);
    if (match) {
      return match[1];
    }
  }

  const base = path.basename(filePath, path.extname(filePath));
  return base
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

async function collectSectionData(folderName, existingTitles) {
  const dirPath = path.join(CONTENT_DIR, folderName);
  const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });

  const markdownFiles = dirEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  if (markdownFiles.length === 0) {
    return null;
  }

  const sectionTitle = existingTitles.get(folderName) ?? folderName;

  const entries = [];
  for (const filename of markdownFiles) {
    const absolutePath = path.join(dirPath, filename);
    const title = await deriveTitle(absolutePath);
    const filePath = path.posix.join('content', folderName, filename);
    entries.push({ title, file: filePath });
  }

  return [sectionTitle, entries];
}

async function buildIndex() {
  const existingTitles = await loadExistingSectionTitles();
  const dirEntries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });

  const sections = [];
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const result = await collectSectionData(entry.name, existingTitles);
    if (result) {
      sections.push(result);
    }
  }

  sections.sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));

  const indexData = {};
  for (const [sectionTitle, entries] of sections) {
    indexData[sectionTitle] = entries;
  }

  const json = JSON.stringify(indexData, null, 2);
  await fs.writeFile(INDEX_PATH, json + '\n', 'utf8');
}

buildIndex().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
