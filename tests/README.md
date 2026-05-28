# Cognify – Selenium E2E Test Suite

End-to-end tests for the **Cognify** adaptive e-learning platform using
[Selenium WebDriver](https://www.selenium.dev/) + [Mocha](https://mochajs.org/).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Tests](#running-the-tests)
5. [Test Structure](#test-structure)
6. [Fixtures](#fixtures)
7. [Reports & Screenshots](#reports--screenshots)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | `node -v` |
| npm | ≥ 9 | `npm -v` |
| Google Chrome | latest stable | Must be installed |
| ChromeDriver | matching Chrome | See below |
| Docker + Docker Compose | any | To run Cognify itself |

### ChromeDriver setup

ChromeDriver must match your installed Chrome version.

**Option A – Automatic (recommended):**
`selenium-webdriver` ≥ 4.11 ships with **Selenium Manager**, which downloads
the correct ChromeDriver automatically on first run. No extra steps needed.

**Option B – Manual:**
1. Check your Chrome version: `chrome://version`
2. Download the matching driver from https://googlechromelabs.github.io/chrome-for-testing/
3. Add the directory to your `PATH`

---

## Installation

```bash
# From the project root
cd tests
npm install
```

---

## Configuration

Default settings live in `selenium/utils/config.js`.
Override any value via environment variables:

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:5173` | Cognify frontend URL |
| `TEST_EMAIL` | `test@cognify.app` | Existing test user email |
| `TEST_PASSWORD` | `TestPass123!` | Test user password |
| `HEADLESS` | `true` | Set to `false` to watch the browser |

Example – run with a visible browser against a custom URL:
```bash
HEADLESS=false BASE_URL=http://localhost:5173 npm run test:auth
```

> **Important:** Create a dedicated test user account in Cognify before running
> authentication tests. The email/password must match `TEST_EMAIL` / `TEST_PASSWORD`.

---

## Running the Tests

### Start Cognify first

```bash
# From the project root
docker compose up -d
```

Wait for the frontend to be available at `http://localhost:5173`.

### Run individual suites

```bash
cd tests

npm run test:auth          # Login, register, protected routes
npm run test:materials     # Material upload & history
npm run test:summaries     # AI summary generation
npm run test:plans         # Study plan generation (Goals page)
npm run test:quizzes       # Quiz start, answer, adaptive difficulty
npm run test:exams         # Mock exam generation & submission
npm run test:analytics     # Dashboard analytics & CRS scores
npm run test:integration   # Full adaptive learning pipeline (flagship test)
```

### Run the full suite

```bash
npm run test:all
```

---

## Test Structure

```
tests/
├── package.json
├── README.md
└── selenium/
    ├── auth/
    │   ├── login.test.js            # Login form, validation, session persistence
    │   ├── register.test.js         # Registration flow & validation
    │   └── protectedRoute.test.js   # Route guards for unauthenticated users
    │
    ├── materials/
    │   └── uploadMaterial.test.js   # PDF upload, history, file-type validation
    │
    ├── summaries/
    │   └── generateSummary.test.js  # AI summary generation from uploaded material
    │
    ├── studyPlans/
    │   └── generateStudyPlan.test.js # Adaptive study plan on the Goals page
    │
    ├── quizzes/
    │   ├── startQuiz.test.js        # Quiz start, question render, answer & next
    │   └── adaptiveDifficulty.test.js # Difficulty progression, mastery update
    │
    ├── mockExams/
    │   └── generateMockExam.test.js # Exam generation, multi-type questions, submit
    │
    ├── analytics/
    │   └── dashboardAnalytics.test.js # CRS scores, charts, activity, navigation
    │
    ├── integration/
    │   └── adaptiveLearningFlow.test.js # ⭐ Full 9-step end-to-end pipeline
    │
    ├── utils/
    │   ├── config.js          # Base URL, credentials, timeouts
    │   ├── driver.js          # ChromeDriver builder (headless + options)
    │   ├── loginHelper.js     # Reusable login / logout helpers
    │   ├── waitHelpers.js     # Explicit waits (element, URL, text, clickable)
    │   └── screenshotHelper.js # Auto-save PNG on failure
    │
    ├── fixtures/
    │   └── sample.pdf         # ← YOU must add this file (see Fixtures section)
    │
    └── reports/
        └── screenshots/       # Failure screenshots saved here automatically
```

---

## Fixtures

Tests that upload a PDF to Cognify require a real file at:

```
tests/selenium/fixtures/sample.pdf
```

Any PDF ≤ 10 MB works. The affected tests skip automatically when the file is
missing, so the rest of the suite still runs.

See `tests/selenium/fixtures/README.md` for details.

---

## Reports & Screenshots

When a test fails, `screenshotHelper.js` automatically saves a timestamped PNG to:

```
tests/selenium/reports/screenshots/<test-name>_<timestamp>.png
```

Review these images to diagnose selector failures or unexpected UI states.

---

## Troubleshooting

### `SessionNotCreatedException` – ChromeDriver version mismatch

Selenium Manager (bundled with `selenium-webdriver` ≥ 4.11) handles this automatically.
If you see this error, update to the latest selenium-webdriver:

```bash
npm install selenium-webdriver@latest
```

### Tests fail immediately with `ERR_CONNECTION_REFUSED`

Cognify is not running or the port is wrong:
```bash
docker compose up -d
# Confirm frontend is reachable:
curl http://localhost:5173
```

### Login tests fail with "invalid credentials"

The test user does not exist or the password is wrong. Create the account manually
in Cognify, then set `TEST_EMAIL` and `TEST_PASSWORD` to match.

### `element not interactable` on file input

The file input is hidden via CSS. The tests already work around this with:
```js
await driver.executeScript("arguments[0].style.display = 'block';", fileInput);
```
If this still fails, confirm that `input[type="file"]` exists in the DOM.

### AI generation tests timeout

`aiGeneration` timeout is set to **90 seconds** by default. If your machine is slow
or the LLM service is under load, increase it in `selenium/utils/config.js`:
```js
timeouts: {
  aiGeneration: 180000, // 3 minutes
}
```

### Tests open and close the browser too quickly (headless)

Run with a visible browser for debugging:
```bash
HEADLESS=false npm run test:integration
```

### `StaleElementReferenceException`

The page re-rendered between finding and clicking an element. This is normal with
React's reconciliation. The tests use explicit waits to minimise this, but if it
recurs on a specific test, increase the `sleep()` delay before the failing action.

---

## Notes for PFE / Academic Presentation

- The **integration test** (`adaptiveLearningFlow.test.js`) is the flagship test.
  Run it alone with `npm run test:integration` for a clean demo.
- Use `HEADLESS=false` during live presentations so reviewers can see the browser.
- Screenshots of every failure are saved automatically — useful for test evidence.
- All tests use `async/await`, explicit waits, and `try/catch/finally` patterns
  as required by best-practice Selenium guidelines.
