import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { aiLimiter } from '../middlewares/rateLimiter.middleware.js';
import QuizController from '../controllers/quiz.controller.js';

const router = express.Router();

router.use(protect);

router.post('/next', aiLimiter, QuizController.next);
router.post('/submit-answer', aiLimiter, QuizController.submitAnswer);

export default router;
