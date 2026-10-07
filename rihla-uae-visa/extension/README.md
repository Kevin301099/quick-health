# Rihla Filler

A browser extension (Chrome, Edge, Brave) that fills official UAE visa forms with the details a traveller prepared in Rihla. The traveller stays the applicant:

- **The traveller** signs in, answers the declarations, pays and presses Submit.
- **The extension** types and attaches. Nothing else.

## How it works

1. **Hand-off.** In Rihla, the traveller presses **Send to Rihla Filler**. The page downloads their documents and passes the details and files to the extension, inside the browser. The extension only listens on Rihla's own address (`RIHLA_APP_ORIGINS`).
2. **Filling.** On the official site, the traveller signs in, then clicks the toolbar icon and **Fill this page**, or presses **Alt+Shift+F**, on each page of the form.
   - The extension reads each field's label, placeholder, name and nearby text, in English and Arabic. It then fills what it recognises: names, passport details, dates in whatever format the field asks for, dropdowns, radio buttons and file uploads.
   - It also handles a date split into day, month and year, framework-driven forms (React, Angular), and fields revealed by an earlier choice.
3. **Review.** A panel on the page lists what was filled, what to check (amber), and what to do yourself. **Undo** puts the page back.

### What it never does

- Fill a password, a one-time code, a captcha or a card field.
- Tick a checkbox (declarations are the traveller's).
- Click any button, submit, or pay.
- Read a page the traveller did not ask it to fill. It has no host permissions and uses `activeTab`.
- Send anything anywhere. Details stay in the browser and are deleted after 24 hours, when the traveller presses **Forget my details**, or when they tell Rihla they submitted.

## Build and test

```bash
npm ci
npm run typecheck
npm test                                              # loads the real extension in Chromium against three replica forms
RIHLA_APP_ORIGINS=https://rihla.example npm run build # dist/ is the extension
```

`npm test` needs a Chromium. Set `CHROME_PATH`, or install Playwright's build of Chromium. Set `SHOTS=<folder>` to save screenshots.

The test forms in `test/fixtures` imitate what the filler meets on real sites:

| Form | Imitates |
|---|---|
| `gov.html` | A government e-service: a table layout with labels not tied to their inputs, ASP.NET-style ids, English and Arabic labels, a login box, a one-time code, a captcha and a declaration. |
| `airline.html` | An airline's two-step form: framework-controlled inputs, a split date of birth, a native date field and a card payment section. |
| `arabic.html` | An Arabic-only, right-to-left form. |

To try it by hand:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select `dist/`.
3. Run Rihla locally (`http://localhost:3000` is allowed by default) and send an application to the filler.
4. Open the official form and click the icon.

## Publishing (Chrome Web Store)

1. Build with your production address: `RIHLA_APP_ORIGINS=https://your-domain npm run build`.
2. Zip the contents of `dist/` and upload them in the Chrome Web Store developer dashboard.
3. Set the web app's `NEXT_PUBLIC_FILLER_URL` to the listing, so the application page links to it. Edge Add-ons takes the same zip.

For the review:

- **Single purpose:** fills official visa application forms with details the user prepared in Rihla.
- **Permissions:**

  | Permission | Why |
  |---|---|
  | `activeTab` | Only the tab the user clicks the icon on. |
  | `scripting` | To type into that tab. |
  | `storage`, `unlimitedStorage` | The user's details and documents, on the device, for at most 24 hours. |
  | `alarms` | The 24-hour deletion. |

- **No remote code, and no data collection:** nothing leaves the device.

## Limits

The filler recognises fields by what they say, so it does not depend on a site's layout. It has been tested against replicas, not against the live GDRFA, ICP or airline sites, which need a signed-in account.

Before launch, apply once for real, page by page, and add any label it misses to the vocabulary in `src/match.ts`. Sites change: the green and amber marks and the review panel are there so the traveller always checks before submitting.
