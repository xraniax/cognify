import MaterialService from '../services/material.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createRequire } from 'module';
import fs from 'fs';

// Use createRequire to load the CommonJS `pdf-parse` package inside an ESM context
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Helper: safely delete a file if it exists on disk.
 */
const safeDelete = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (deleteErr) {
        console.warn(`[Upload] Could not clean up temp file ${filePath}:`, deleteErr.message);
    }
};

class MaterialController {
    /**
     * Upload a material via PDF file and/or raw text content.
     * Both inputs are optional but at least one must be provided.
     */
    static upload = asyncHandler(async (req, res) => {
        const { title, content, type, subjectId } = req.body;
        const file = req.file;

        // Capture original filename before any deletion occurs
        const originalFilename = file?.originalname;

        let finalContent = content || '';

        // If a PDF was uploaded, parse and append its text to any provided raw content
        if (file) {
            if (file.mimetype !== 'application/pdf') {
                safeDelete(file.path);
                res.status(400);
                throw new Error('Only PDF files are accepted. Please upload a valid .pdf file.');
            }

            try {
                const dataBuffer = fs.readFileSync(file.path);
                const parsed = await pdfParse(dataBuffer);

                if (!parsed.text || parsed.text.trim().length === 0) {
                    safeDelete(file.path);
                    res.status(422);
                    throw new Error('The uploaded PDF appears to be empty or unreadable.');
                }

                // Combine PDF text with any additional text the user provided
                finalContent = [finalContent, parsed.text].filter(Boolean).join('\n\n');
                safeDelete(file.path);
            } catch (err) {
                safeDelete(file.path);

                // Re-throw operational errors (400/422) as-is
                if (res.statusCode !== 200) throw err;

                // Log unexpected parsing errors for debugging then return a user-friendly message
                console.error('[Upload] PDF parse error:', err.message);
                res.status(500);
                throw new Error('Failed to extract text from the PDF. The file may be corrupted or password-protected.');
            }
        }

        finalContent = finalContent.trim();

        if (!finalContent || !type) {
            res.status(400);
            throw new Error('Content is required (upload a PDF or provide text), along with a task type.');
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
