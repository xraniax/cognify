import path from 'path';
import fs from 'fs';
import asyncHandler from '../utils/asyncHandler.js';
import FileService from '../services/file.service.js';

// Resolved once at startup — all stored paths must be children of this directory.
const UPLOAD_BASE = path.resolve(process.env.PDF_STORAGE_PATH || '/app/data/uploads');

// Loose UUID v4 check — prevents obviously bad input from hitting the DB.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const download = asyncHandler(async (req, res) => {
    const { document_id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    console.log(`[files] request document_id=${document_id} user_id=${userId}`);

    if (!UUID_RE.test(document_id)) {
        return res.status(404).json({ message: 'Document not found' });
    }

    const record = await FileService.getFile(document_id);

    if (!record) {
        console.log(`[files] 404 document_id=${document_id} user_id=${userId} reason=not_found`);
        return res.status(404).json({ message: 'Document not found' });
    }

    if (!isAdmin && record.owner_id !== userId) {
        console.log(`[files] 403 document_id=${document_id} user_id=${userId} reason=ownership`);
        return res.status(403).json({ message: 'Access denied' });
    }

    const encodedName = encodeURIComponent(
        record.original_name || 'document'
    );
    res.setHeader('Content-Type', record.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);

    if (record.drive_file_id) {
        console.log(`[files] { "document_id": "${document_id}", "storage_type": "drive", "drive_file_id": "${record.drive_file_id}" }`);
        try {
            const driveStream = await record.getStream();
            driveStream.on('error', (streamErr) => {
                console.error(`[files] Drive stream error mid-pipe document_id=${document_id}: ${streamErr.message}`);
                if (!res.headersSent) {
                    res.status(503).json({ message: 'Service Unavailable' });
                }
            });
            driveStream.on('end', () => {
                console.log(`[files] 200 document_id=${document_id} user_id=${userId} storage_type=drive`);
            });
            return driveStream.pipe(res);
        } catch (error) {
            console.error(`[files] Drive stream failed for document_id=${document_id} - ${error.message}`);
            if (error.code === 404 || error.status === 404 || error.message.includes('not found')) {
                return res.status(404).json({ message: 'File not found in Drive' });
            }
            return res.status(503).json({ message: 'Service Unavailable' });
        }
    }

    console.log(`[files] { "document_id": "${document_id}", "storage_type": "local" }`);

    // Resolve the stored path and confirm it is strictly inside UPLOAD_BASE.
    // path.resolve handles any embedded "../" sequences before the check.
    const resolvedPath = path.resolve(record.path);
    if (!resolvedPath.startsWith(UPLOAD_BASE + path.sep)) {
        console.error(
            `[files] path_escape document_id=${document_id} stored_path=${record.path} resolved=${resolvedPath}`
        );
        return res.status(503).json({ message: 'Service Unavailable' });
    }

    if (!fs.existsSync(resolvedPath)) {
        console.log(`[files] 404 document_id=${document_id} user_id=${userId} reason=missing_on_disk`);
        return res.status(404).json({ message: 'File not found' });
    }

    console.log(`[files] 200 document_id=${document_id} user_id=${userId} path=${resolvedPath}`);

    res.sendFile(resolvedPath);
});

export default { download };
