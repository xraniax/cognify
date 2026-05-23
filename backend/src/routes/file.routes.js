import express from 'express';
import FileController from '../controllers/file.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Binary file responses (PDF/image bytes) don't need a CSP — the CSP directives
// (frame-ancestors, script-src, etc.) only make sense for HTML documents.
// Removing them here prevents Edge/Chrome from blocking the file in an iframe due
// to a CSP header that references the wrong origin context.
// X-Frame-Options is also removed; framing is controlled by the JWT auth requirement.
router.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    next();
});

router.use(protect);

router.get('/:document_id', FileController.download);

export default router;
