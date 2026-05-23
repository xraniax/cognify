import GoalService from '../services/goal.service.js';

class GoalController {

    // ── CRUD ────────────────────────────────────────────────────────────────

    static async createGoal(req, res, next) {
        try {
            const goal = await GoalService.createGoal(req.user.id, req.body);
            res.status(201).json({ status: 'success', message: 'Goal created', data: goal });
        } catch (err) { next(err); }
    }

    static async getUserGoals(req, res, next) {
        try {
            const filters = {
                status:    req.query.status,
                subjectId: req.query.subjectId,
                limit:     parseInt(req.query.limit)  || 50,
                offset:    parseInt(req.query.offset) || 0
            };
            const goals = await GoalService.getUserGoals(req.user.id, filters);
            res.status(200).json({ status: 'success', data: goals, count: goals.length });
        } catch (err) { next(err); }
    }

    static async getGoalById(req, res, next) {
        try {
            const goal = await GoalService.getGoalById(req.params.id, req.user.id);
            res.status(200).json({ status: 'success', data: goal });
        } catch (err) { next(err); }
    }

    static async updateGoal(req, res, next) {
        try {
            const goal = await GoalService.updateGoal(req.params.id, req.user.id, req.body);
            res.status(200).json({ status: 'success', message: 'Goal updated', data: goal });
        } catch (err) { next(err); }
    }

    static async deleteGoal(req, res, next) {
        try {
            await GoalService.deleteGoal(req.params.id, req.user.id);
            res.status(200).json({ status: 'success', message: 'Goal deleted' });
        } catch (err) { next(err); }
    }

    // ── Stats ───────────────────────────────────────────────────────────────

    static async getGoalStats(req, res, next) {
        try {
            const stats = await GoalService.getGoalStats(req.user.id);
            res.status(200).json({ status: 'success', data: stats });
        } catch (err) { next(err); }
    }

    static async getStudyStreak(req, res, next) {
        try {
            const streak = await GoalService.getStudyStreak(req.user.id);
            res.status(200).json({ status: 'success', data: streak });
        } catch (err) { next(err); }
    }

    // ── Sessions ────────────────────────────────────────────────────────────

    static async getActiveSession(req, res, next) {
        try {
            const session = await GoalService.getActiveSession(req.user.id);
            res.status(200).json({ status: 'success', data: session });
        } catch (err) { next(err); }
    }

    static async startStudySession(req, res, next) {
        try {
            const session = await GoalService.startStudySession(req.user.id, req.body);
            res.status(201).json({ status: 'success', message: 'Session started', data: session });
        } catch (err) { next(err); }
    }

    static async endStudySession(req, res, next) {
        try {
            const result = await GoalService.endStudySession(req.params.id, req.user.id, req.body);
            res.status(200).json({ status: 'success', message: 'Session ended', data: result });
        } catch (err) { next(err); }
    }

    static async getStudyHistory(req, res, next) {
        try {
            const filters = { days: parseInt(req.query.days) || 30 };
            const history = await GoalService.getStudyHistory(req.user.id, filters);
            res.status(200).json({ status: 'success', data: history });
        } catch (err) { next(err); }
    }

    static async logStudyTime(req, res, next) {
        try {
            const { minutes, subjectId } = req.body;
            if (!minutes || minutes < 1 || minutes > 480) {
                return res.status(400).json({
                    status: 'error',
                    message: 'minutes must be between 1 and 480'
                });
            }
            const result = await GoalService.logStudyTime(req.user.id, minutes, subjectId);
            res.status(200).json({ status: 'success', message: `${minutes} minutes logged`, data: result });
        } catch (err) { next(err); }
    }

    // ── Study Plan ──────────────────────────────────────────────────────────

    /**
     * GET /api/goals/plan/current
     * Return the stored plan for this user, or null.
     */
    static async getCurrentPlan(req, res, next) {
        try {
            const result = await GoalService.getCurrentPlan(req.user.id);
            res.status(200).json({ status: 'success', data: result });
        } catch (err) { next(err); }
    }

    /**
     * POST /api/goals/plan/generate
     * Backend fetches all needed data; frontend may pass optional scheduling prefs.
     */
    static async generateStudyPlan(req, res, next) {
        try {
            const result = await GoalService.generateStudyPlan(req.user.id, req.body ?? {});
            res.status(200).json({ status: 'success', data: result });
        } catch (err) { next(err); }
    }

    static async activateStudyPlan(req, res, next) {
        try {
            const result = await GoalService.activateStudyPlan(req.user.id, req.body);
            res.status(200).json({ status: 'success', message: 'Plan activated', data: result });
        } catch (err) { next(err); }
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    static async getGoalsNeedingReminders(req, res, next) {
        try {
            const goals = await GoalService.getGoalsNeedingReminders();
            res.status(200).json({ status: 'success', data: goals, count: goals.length });
        } catch (err) { next(err); }
    }

    static async markReminderSent(req, res, next) {
        try {
            await GoalService.markReminderSent(req.params.id);
            res.status(200).json({ status: 'success', message: 'Reminder marked as sent' });
        } catch (err) { next(err); }
    }
}

export default GoalController;
