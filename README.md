# AddEvent ATC Link

Chrome extension that creates an AddEvent event from a popup and gives back a public add-to-calendar landing page link to copy.

## How it works
1. User fills in title, start, end (defaults to start + 1 hr), location, and description
2. Extension creates the event via `POST https://api.addevent.com/calevent/v2/events`
3. Extension builds a landing page URL with the event details in the query string
4. User copies the link

The landing page (`docs/index.html`) is a single static page, same design as easy-event-share. It reads the event from the URL, so it only needs to be hosted once. Each event is just a different link.

## Setup
1. **Host the landing page:** publish `docs/index.html` somewhere public (e.g. a new GitHub Pages repo, like easy-event-share's `seanvandril-ae.github.io/meet`)
2. **Fill in `extension/.env`:** `ADDEVENT_API_KEY`, `PAGE_URL` (the hosted page), and optionally `ADDEVENT_CALENDAR_ID`
3. **Load in Chrome:** `chrome://extensions` > Developer mode > Load unpacked > select the `extension` folder
4. After editing `.env`, click reload on the extension's card

## Landing page URL params
- `t` title, `s` start (UTC, `YYYYMMDDTHHMMZ`), `e` end (UTC), `l` location (optional), `n` description (optional)
- Times display in the viewer's own time zone

## Files
- `extension/manifest.json`: name, permissions, API host
- `extension/popup.html` / `popup.js`: form, API call, link builder, copy button
- `extension/.env`: API key and page URL (gitignored)
- `docs/index.html`: landing page

## Notes
- The API key is bundled in the extension, which is fine for internal use. Shipping to customers would need a per-user key or login.
- Events use the browser's time zone.
