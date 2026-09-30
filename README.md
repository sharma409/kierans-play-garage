# Kieran’s Play Garage

A static website with a scrollable garage tour and 46 birthday gift ideas. This repository contains only the website and its current assets.

## Edit the site

- `dist/content.json`: introduction, closing note, item names, descriptions, example links, and scene positions.
- `dist/index.html`: page structure.
- `dist/styles.css`: visual styling and responsive layout.
- `dist/app.js`: desktop tour, collection, and item details.
- `dist/mobile-tour.js`: mobile room tour.
- `dist/assets/`: images used by the site.

After editing content, run `python3 sync-content.py` to validate the item and scene data and regenerate `dist/content.js` and `dist/gift-ideas.html`.

## Preview locally

Run `python3 -m http.server 9001 --directory dist`, then open `http://localhost:9001`.

## Publish

GitHub Pages serves this site. Pushing to `main` runs the workflow in `.github/workflows/pages.yml`, validates the content, and publishes the `dist` directory. The workflow can also be run manually from the Actions tab. No API keys, database, or application server are required.

The site uses relative asset URLs, so it can also be served from another static hosting provider.
