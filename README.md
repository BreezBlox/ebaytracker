# eBay Sales Tracker

Static personal dashboard for importing eBay sales CSV exports and getting a cleaner view of revenue, earnings, costs, profit, top items, and monthly trends.

## What it does

- imports the CSV export format shown in the sample data
- tolerates the blank junk row before the actual header
- keeps imported data in browser `localStorage`
- filters by date window and item-title search
- shows summary metrics, top items, and recent orders
- deploys cleanly to GitHub Pages

## Local use

Because this is a plain static site, you can open [`index.html`](./index.html) directly or serve the repo locally with any simple static server.

## GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, enable GitHub Pages with the GitHub Actions source.
3. The included workflow will publish the site from the default branch after each push.

## Privacy note

This version stores imported CSV data only in the local browser where you load it. It does not send the file to a backend.
