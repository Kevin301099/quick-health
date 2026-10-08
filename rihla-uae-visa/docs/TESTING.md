# Testing Rihla on your computer

Three parts:

1. **On your computer** (about 20 minutes). Nothing real is sent anywhere.
2. **On the real official website** (the one that matters). Use your own passport, and stop before paying.
3. **The automated tests**, for developers.

## What you need

- A computer (Windows, Mac or Linux) with **Google Chrome**. Microsoft Edge or Brave work too.
- **Node.js**: the LTS version from [nodejs.org](https://nodejs.org). Install it, then close and reopen your terminal.
- The project folder: the `rihla-uae-visa` ZIP, unzipped, or a copy cloned with git.

## Part 1: On your computer

### Start everything (one command)

Open a terminal in the `rihla-uae-visa` folder:

- **Windows:** open the folder in File Explorer, click the address bar, type `cmd` and press Enter. Use Command Prompt rather than PowerShell, which often refuses to run `npm`.
- **Mac:** open the Terminal app, type `cd ` (with a space), drag the `rihla-uae-visa` folder into the window, and press Enter.

Then run:

```
npm run try
```

The first time, it installs packages (a few minutes). Wait for **Rihla is running**. Keep this window open: your sign-in codes appear in it. To stop everything later, press **Ctrl+C**.

What is running:

| Address | What it is |
|---|---|
| http://localhost:3000 | The Rihla website |
| http://localhost:4000 | Test forms that look like official visa forms |
| http://localhost:8787 | The API (you do not open this one) |

Payments are a test page (no card is charged), and filing is a sandbox. Passport reading is off unless you add a key; see the end of Part 1.

### Add Rihla Filler to Chrome (once)

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the folder `rihla-uae-visa/extension/dist`. The terminal prints the full path.
4. Click the puzzle-piece icon in the toolbar and **pin** Rihla Filler, so its icon is always visible.

### Test the free 5-year visa route

| Do this | You should see |
|---|---|
| Open http://localhost:3000 and press **Start your application** | "Your trip to the UAE" |
| Nationality **India**, residence permit **No** | "Visa needed · You need a visa before you fly" |
| Choose **5-year multiple-entry tourist visa** and tick **I have all three** | The right-hand card says **AED 0** to Rihla. Your first trip's dates appear. |
| Sign in with any email address | The six-digit code appears in the terminal window, as "Sign-in code for …" |
| Press **Continue to documents** and upload five files: passport page, photo, bank statements, insurance, ticket | Each shows its size. The photo shows four checks (shape, background, resolution, file size). Any PDF works for the last three. |
| Type your details (given names, surname, date of birth, sex, passport number, expiry, mobile) and press **Save details** | "Saved" |
| Scroll to **Apply on GDRFA Dubai** | Step 1 shows "Installed". If it says "Looking for Rihla Filler", see *If something goes wrong*. |
| Press **Send to Rihla Filler** | "Sent. Kept only in this browser…" |
| Open http://localhost:4000, then **Government e-service**. Click the Rihla icon, then **Fill this page**. | See below. |

What a correct fill of the government test form looks like:

- **Filled, in green:** names (first and middle split), gender, date of birth as `dd/mm/yyyy`, nationality, passport type, passport number, issue and expiry dates, email and confirm email, mobile, address.
- **Attached:** all five documents.
- **Amber (to check):** "Issuing country".
- **Empty:** username, password, OTP, captcha, the declaration tick-box, Father Name and First Name (Arabic).
- **On the page:** a panel at the bottom right listing everything. **Undo** clears what was filled.

Then try the other test forms:

- **Airline form:** fill, press **Continue**, fill again. The documents attach, and the card fields stay empty.
- **Arabic-only form:** fills from the Arabic labels.
- **Pick-from-list form:** Nationality is typed and marked amber ("Choose “India” from the list that opens"). Date of birth is listed under "Fill these yourself", because that box only takes a calendar pick.

Finish the 5-year visa route back in Rihla:

| Do this | You should see |
|---|---|
| Back in Rihla, type any reference and press **I submitted it** | "Submitted on GDRFA Dubai" |
| Click the Rihla icon | "Nothing to fill yet": the extension forgot your details |

### Also try

- **Airline route:** choose **Visa through your airline**, then Emirates.
- **Paid route:** choose **Tourist visa filed for you**. Sign, then pay on the test checkout (no real card). About 20 seconds later you see "Your visa is ready", with a sample PDF.
- **Ops console:** open http://localhost:3000/#ops and sign in as `ops@rihla.test`.
- **Automatic passport reading** uses your own Anthropic key, about US$0.02 per passport. Stop with Ctrl+C, then start again with the key:

  Mac or Linux:

  ```
  ANTHROPIC_API_KEY=sk-ant-... npm run try
  ```

  Windows (Command Prompt), two lines:

  ```
  set "ANTHROPIC_API_KEY=sk-ant-..."
  npm run try
  ```

## Part 2: On the real official website

Rihla Filler was tested on copies of these forms, not on the real sites, which need a signed-in account. Do this once, with your own passport, before real travellers use it.

1. **Prepare in Rihla.** Keep `npm run try` running. In Rihla, prepare a 5-year visa application with your real documents, then press **Send to Rihla Filler**.
2. **Open the official site** and sign in yourself:
   - https://www.gdrfad.gov.ae for Dubai, with UAE PASS or by registering as an individual;
   - https://icp.gov.ae for the other emirates.

   Start the 5-year tourism entry permit.
3. **On every page of their form:** click the Rihla icon, then **Fill this page**, and read the panel.
4. **Write down, for each page:**
   - the page's name;
   - every field left empty that Rihla has, with its label exactly as shown;
   - anything filled wrongly;
   - any document not attached.

   A screenshot of the page and the panel is best.
5. **Stop before paying,** unless you really want this visa. It costs real money; reports say about AED 3,700, including a refundable deposit. Do not submit a test application.
6. **Send the list to your developer** (or paste it into Claude). Missing labels are added to `extension/src/match.ts`.

For an airline's visa form you need a real booking with that airline. The same rule applies: stop before paying.

## Part 3: Automated tests (for developers)

```
cd backend && npm test                 # API: 29 tests (add TEST_DATABASE_URL=postgres://… to run on Postgres)
cd ../extension && npm test            # loads the real extension in Chromium against 4 test forms
cd .. && npm run typecheck             # web app
```

The extension tests need Chromium. They find Playwright's copy, or the one at `CHROME_PATH`.

## If something goes wrong

- **"Port 3000 is already in use".** Close the other program, or the earlier `npm run try` window, and run it again.
- **"Looking for Rihla Filler" never changes.** Open `chrome://extensions` and check that Rihla Filler is on. Make sure you chose the `extension/dist` folder, the one with `manifest.json` in it. Then reload the Rihla page.
- **"This page does not allow extensions to fill it".** Browsers block extensions on some pages, such as other extensions' pages and the browser's own pages. Use **Copy your details** in Rihla instead.
- **No sign-in email.** The code is printed in the terminal window, not sent to your inbox.
- **`npm` is not recognised.** Node.js is not installed, or the terminal was opened before you installed it. Install it and open a new terminal.
- **"running scripts is disabled on this system"** (Windows PowerShell). Use Command Prompt instead: type `cmd` in the folder's address bar.
