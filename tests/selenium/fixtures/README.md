# Test Fixtures

Place a real PDF file here named **`sample.pdf`** before running the upload and integration tests.

## Why is this needed?

The `uploadMaterial.test.js` and `adaptiveLearningFlow.test.js` tests upload a PDF to Cognify.
Selenium's `sendKeys()` on a file input requires an absolute path to a real file on disk.

## Requirements

| Property | Value |
|---|---|
| Filename | `sample.pdf` |
| Format | PDF (application/pdf) |
| Max size | 10 MB (Cognify's upload limit) |
| Min size | Any – even a 1-page doc works |

## Quick options

- Export any lecture slide or document as PDF and rename it `sample.pdf`
- Use a 1-page summary PDF from your own study materials
- Generate a minimal PDF with any online tool

## Tests that use this fixture

- `tests/selenium/materials/uploadMaterial.test.js`
- `tests/selenium/integration/adaptiveLearningFlow.test.js`

Both tests call `this.skip()` automatically when the file is missing,
so the rest of the suite still runs without it.
