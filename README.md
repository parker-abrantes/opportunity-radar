# Opportunity Radar

Opportunity Radar is a local-first dashboard for finding, ranking, and triaging
career opportunities without living inside a dozen browser tabs.

It was built for a workflow where internships, research programs, scholarships,
conference travel grants, and fellowships are all treated as one ranked queue.
The dashboard helps separate high-signal opportunities from low-value searching,
then promotes strong internship or research fits into an application tracker.

## What It Does

- Displays a ranked opportunity queue from CSV data.
- Scores opportunities across role alignment, sector fit, eligibility, leverage,
  funding, deadline urgency, and effort-to-value.
- Filters for verified items, monitor items, strong fits, nuclear, systems,
  research, local roles, travel grants, and rejected opportunities.
- Promotes internship and research opportunities into a downstream tracker.
- Lets you pass on expired, weak-fit, or not-applying opportunities while keeping
  an audit trail.
- Runs entirely on your laptop with Node.js and local files.

## Why I Built It

The goal is not to apply to everything. The goal is to make the search process
calm, repeatable, and selective.

Instead of manually checking company pages, research programs, scholarship
pages, and conference grant portals from scratch each time, Opportunity Radar
creates a place where those leads can be ranked, reviewed, accepted, rejected,
and connected to a real application pipeline.

## Run Locally

Install [Node.js](https://nodejs.org/), then run:

```powershell
npm start
```

Open:

```text
http://127.0.0.1:4173
```

On Windows, you can also double-click:

```text
Launch Opportunity Radar.cmd
```

## Run on Your Phone

For same-Wi-Fi phone access, double-click:

```text
Launch Opportunity Radar Phone Mode.cmd
```

The launcher prints a phone URL like:

```text
http://192.168.x.x:4173
```

Open that URL from your phone while your laptop is awake and connected to the
same Wi-Fi network.

To install it like an app:

- iPhone: open the phone URL in Safari, then Share -> Add to Home Screen.
- Android: open the phone URL in Chrome, then menu -> Install app or Add to Home
  screen.

This repo includes PWA metadata, a manifest, icon, and service worker. A full
installable PWA experience is most reliable after HTTPS deployment because
mobile browsers restrict service workers on plain local-network HTTP.

## Personal Data

This repository ships with sample CSVs only.

To connect your own private files, copy `config.example.json` to
`config.local.json` and point it at your local CSV paths:

```json
{
  "radarFile": "data/radar_opportunities.csv",
  "searchLogFile": "data/search_run_log.csv",
  "internshipFile": "C:/path/to/your/private/internship_tracker.csv"
}
```

`config.local.json` is ignored by Git so private tracker paths and data stay off
GitHub.

## Project Shape

```text
public/
  index.html
  styles.css
  app.js
data/
  radar_opportunities.csv
  internship_tracker.csv
  search_run_log.csv
server.js
config.example.json
```

## Roadmap

- Add scheduled search runs that write newly verified opportunities into the
  radar queue.
- Add separate downstream workflows for scholarships and conference travel
  grants.
- Add richer source verification metadata.
- Add export views for weekly application planning.
