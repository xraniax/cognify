import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { aiLimiter } from '../middlewares/rateLimiter.middleware.js';
import ExamController from '../controllers/exam.controller.js';
import { generateExamSchema, saveAttemptSchema, submitExamSchema } from '../middlewares/exam.validator.js';

const router = express.Router();

router.use(protect);

router.post('/generate', aiLimiter, validate(generateExamSchema), ExamController.generate);
router.post('/attempts/save', validate(saveAttemptSchema), ExamController.saveAttempt);
router.get('/attempts/:examId', ExamController.getAttempt);
router.post('/submit', aiLimiter, validate(submitExamSchema), ExamController.submit);

export default router;
