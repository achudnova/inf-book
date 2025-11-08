# INF Book

This repository contains course materials in Markdown under the `content/` directory and a generated `content/index.json` file that keeps the navigation structure in sync.

## Updating the content index

Run the local helper script to rebuild the index whenever you add or rename Markdown files:

```bash
npm install
npm run build:index
```

On pushes to the `main` branch the **Build content index** workflow repeats the same steps and commits any changes to `content/index.json` automatically. Simply push your Markdown updates and the action will keep the index current.
