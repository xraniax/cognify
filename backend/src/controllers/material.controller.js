import MaterialService from '../services/material.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import fs from 'fs';
import { extractTextFromPdf } from '../services/pdfExtractor.service.js';

/**
 * Safely delete a temp file without throwing.
 * Used to ensure uploaded files are cleaned up even if processing fails.
 */
const safeDelete = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.warn(`[MaterialController] Could not clean up temp file (${filePath}):`, err.message);
    }
};

class MaterialController {
    /**
     * Upload endpoint: accepts a PDF file and/or raw text content.
     *
     * Processing pipeline:
     *   1. If a PDF is supplied, delegate text extraction to pdfExtractor.service.js
     *      (auto-detects text vs scanned PDFs, applies OCR where needed).
     *   2. Combine extracted text with any manually provided text.
     *   3. Forward the final content to the AI engine via MaterialService.
     *
     * The subjectId is passed as a form field; when uploading from a Subject view,
     * the frontend automatically pre-fills this with the current subject's ID.
     */
    static upload = asyncHandler(async (req, res) => {
        const { title, content, type, subjectId } = req.body;
        const file = req.file;

        // Capture filename before possible deletion
        const originalFilename = file?.originalname;

        let finalContent = content || '';

        if (file) {
            try {
                // Delegate all PDF intelligence to the extractor service
                const { text: pdfText, method } = await extractTextFromPdf(file.path);

                console.log(
                    `[MaterialController] Extracted ${pdfText.length} chars from "${originalFilename}" via ${method}.`
                );

                // Merge PDF text with any additional manually provided text
                finalContent = [finalContent, pdfText].filter(Boolean).join('\n\n');
            } catch (err) {
                safeDelete(file.path);

                // pdfExtractor attaches a `statusCode` to operational errors
                const status = err.statusCode || 500;
                if (status < 500) {
                    console.warn(`[MaterialController] PDF rejected (${status}):`, err.message);
                } else {
                    console.error('[MaterialController] Unexpected PDF extraction error:', err.message);
                }

                res.status(status);
                throw err; // Pass clean error message to errorHandler
            } finally {
                safeDelete(file.path);
            }
        }

        finalContent = finalContent.trim();

        if (!finalContent || !type) {
            res.status(400);
            throw new Error(
                'Content is required — upload a PDF or paste text — along with a task type.'
            );
        }

        const material = await MaterialService.processMaterial(
            req.user.id,
            title || originalFilename || 'Untitled',
            finalContent,
            type,
            subjectId
        );

        res.status(201).json({
            status: 'success',
            data: material,
        });
    });


    static getHistory = asyncHandler(async (req, res) => {
        const history = await MaterialService.getUserHistory(req.user.id);
        res.status(200).json({
            status: 'success',
            data: history
        });
    });

    static chatCombined = asyncHandler(async (req, res) => {
        const { materialIds, question } = req.body;
        if (!materialIds || !question) {
            res.status(400);
            throw new Error('materialIds and question are required');
        }

        const result = await MaterialService.chatWithContext(req.user.id, materialIds, question);
        res.status(200).json({ status: 'success', data: result });
    });

    static generateCombined = asyncHandler(async (req, res) => {
        const { materialIds, taskType } = req.body;
        if (!materialIds || !taskType) {
            res.status(400);
            throw new Error('materialIds and taskType are required');
        }

        const result = await MaterialService.generateWithContext(req.user.id, materialIds, taskType);
        res.status(200).json({ status: 'success', data: result });
    });
}

export default MaterialController;
