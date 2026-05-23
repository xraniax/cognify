import { Router } from 'express';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import GoalController from '../controllers/goal.controller.js';

const router = Router();

router.use(protect);

// ── Goal CRUD ────────────────────────────────────────────────────────────────
router.post('/',        GoalController.createGoal);
router.get('/',         GoalController.getUserGoals);
router.get('/stats',    GoalController.getGoalStats);
router.get('/streak',   GoalController.getStudyStreak);

// ── Study Plan ───────────────────────────────────────────────────────────────
// All plan routes must be before /:id so Express doesn't treat "plan" as an id
router.get('/plan/current',   GoalController.getCurrentPlan);
router.post('/plan/generate', GoalController.generateStudyPlan);
router.post('/plan/activate', GoalController.activateStudyPlan);

// ── Study Sessions ───────────────────────────────────────────────────────────
router.get('/sessions/active',     GoalController.getActiveSession);
router.post('/sessions/start',     GoalController.startStudySession);
router.post('/sessions/:id/end',   GoalController.endStudySession);
router.get('/sessions/history',    GoalController.getStudyHistory);

// ── Quick Time Logging ───────────────────────────────────────────────────────
router.post('/log-time', GoalController.logStudyTime);

// ── Admin Routes (before /:id to avoid param collision) ─────────────────────
router.get('/admin/reminders',           adminOnly, GoalController.getGoalsNeedingReminders);
router.post('/admin/reminders/:id/sent', adminOnly, GoalController.markReminderSent);

// ── Single Goal — must be last (catch-all param) ─────────────────────────────
router.get('/:id',    GoalController.getGoalById);
router.patch('/:id',  GoalController.updateGoal);
router.delete('/:id', GoalController.deleteGoal);

export default router;
