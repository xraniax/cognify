/**
 * PDF Extraction Service
 *
 * Handles text extraction from uploaded PDF files with two strategies:
 *   1. Text-based PDFs  → extract text directly using `pdf-parse`
 *   2. Image-based PDFs → render pages to images then OCR with `tesseract.js`
 *
 * This module is the single source of truth for all PDF content extraction.
 * The controller simply calls `extractTextFromPdf(filePath)` and gets back a string.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// --- Constants ---

/**
 * Minimum character count that must be extracted for a PDF to be
 * considered "text-based". Below this threshold, we fall back to OCR.
 * This catches PDFs that have only whitespace or a few stray characters.
 */
const TEXT_THRESHOLD = 50;

// --- Helpers ---

/**
 * Safely remove a file from disk without throwing.
 */
const safeUnlink = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.warn(`[pdfExtractor] Could not delete temp file (${filePath}):`, err.message);
    }
};

/**
 * Validate that the file at `filePath` is actually a PDF by checking its magic bytes.
 * Returns true if the file starts with the PDF magic number (%PDF).
 */
const isPdfMagicBytes = (filePath) => {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        return buf.toString('ascii') === '%PDF';
    } catch {
        return false;
    }
};

/**
 * Perform OCR on a PDF by:
 *   1. Converting each page to a PNG image via pdf2pic
 *   2. Running Tesseract OCR on each image
 *   3. Returning the combined text
 *
 * @param {string} filePath - Absolute path to the PDF file.
 * @returns {Promise<string>} Extracted text from all pages.
 */
const extractViaOCR = async (filePath) => {
    console.log('[pdfExtractor] Falling back to OCR for image-based PDF:', path.basename(filePath));

    // Dynamically import ESM-compatible modules
    const { fromPath } = await import('pdf2pic');
    const Tesseract = await import('tesseract.js');

    // Use a temp directory to write page images
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cognify-ocr-'));

    try {
        const convert = fromPath(filePath, {
            density: 200,          // DPI – higher = more accurate OCR, slower
            savePath: tempDir,
            saveFilename: 'page',
            format: 'png',
            width: 1654,
            height: 2339,
        });

        // Get page count from pdf-parse metadata
        const buffer = fs.readFileSync(filePath);
        const pdfMeta = await pdfParse(buffer, { max: 0 }); // max:0 skips content parsing
        const pageCount = Math.min(pdfMeta.numpages, 20); // cap at 20 pages for performance

        if (pageCount === 0) {
            throw new Error('PDF has no pages.');
        }

        const texts = [];

        for (let i = 1; i <= pageCount; i++) {
            let imagePath;
            try {
                const result = await convert(i, { responseType: 'image' });
                imagePath = result.path;

                const { data } = await Tesseract.recognize(imagePath, 'eng', {
                    logger: () => { }, // suppress per-word progress logs
                });

                texts.push(data.text);
            } catch (pageErr) {
                console.warn(`[pdfExtractor] OCR failed on page ${i}:`, pageErr.message);
            } finally {
                safeUnlink(imagePath);
            }
        }

        const combined = texts.join('\n\n').trim();
        if (!combined) {
            throw new Error('OCR produced no readable text from this PDF.');
        }

        return combined;
    } finally {
        // Clean up temp image directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Non-critical
        }
    }
};

// --- Main Export ---

/**
 * Extract readable text from a PDF file.
 *
 * Strategy:
 *   - First, attempt direct text extraction with pdf-parse.
 *   - If the extracted text is too short (likely a scanned/image PDF),
 *     fall back to OCR via tesseract.js.
 *
 * @param {string} filePath - Absolute path to the validated PDF file.
 * @returns {Promise<{ text: string, method: 'text' | 'ocr' }>}
 * @throws {Error} If extraction fails entirely (corrupted, password-protected, etc.)
 */
export const extractTextFromPdf = async (filePath) => {
    // 1. Sanity check: magic bytes confirm this is actually a PDF
    if (!isPdfMagicBytes(filePath)) {
        throw Object.assign(
            new Error('The uploaded file is not a valid PDF (magic bytes check failed).'),
            { statusCode: 422 }
        );
    }

    let pdfBuffer;
    try {
        pdfBuffer = fs.readFileSync(filePath);
    } catch (err) {
        throw Object.assign(
            new Error('Could not read the uploaded file from disk.'),
            { statusCode: 500 }
        );
    }

    // 2. Attempt direct text extraction
    let parsedText = '';
    try {
        const parsed = await pdfParse(pdfBuffer);
        parsedText = (parsed.text || '').trim();
    } catch (err) {
        console.warn('[pdfExtractor] pdf-parse failed, will attempt OCR:', err.message);
        // parsedText stays empty → OCR will be triggered below
    }

    // 3. If sufficient text was found, return it directly
    if (parsedText.length >= TEXT_THRESHOLD) {
        console.log(`[pdfExtractor] Text extraction successful (${parsedText.length} chars).`);
        return { text: parsedText, method: 'text' };
    }

    // 4. OCR fallback for image-based (scanned) PDFs
    console.log(`[pdfExtractor] Text too short (${parsedText.length} chars). Attempting OCR...`);
    try {
        const ocrText = await extractViaOCR(filePath);
        return { text: ocrText, method: 'ocr' };
    } catch (ocrErr) {
        console.error('[pdfExtractor] OCR also failed:', ocrErr.message);
        throw Object.assign(
            new Error(
                ocrErr.message.includes('no readable text')
                    ? 'No readable text could be extracted from this PDF. It may be blank, corrupted, or password-protected.'
                    : 'Failed to process this PDF. The file may be corrupted or password-protected.'
            ),
            { statusCode: 422 }
        );
    }
};
