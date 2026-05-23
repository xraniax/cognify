import Goal, { StudySession, StudyPlan } from '../models/goal.model.js';
import { engineClient } from './engine.client.js';
import { query } from '../utils/config/db.js';

class GoalService {

    // ── CRUD ────────────────────────────────────────────────────────────────

    static async createGoal(userId, goalData) {
        this.validateGoalData(goalData);

        if (goalData.subjectId) {
            const existing = await Goal.findByUserId(userId, {
                status: 'active',
                subjectId: goalData.subjectId
            });
            const duplicate = existing.find(g =>
                g.goal_type === goalData.goalType &&
                g.goal_period === goalData.goalPeriod
            );
            if (duplicate) {
                const err = new Error(
                    `You already have an active ${goalData.goalPeriod} ${goalData.goalType} goal for this subject`
                );
                err.code = 'DUPLICATE_GOAL';
                throw err;
            }
        }

        const goal = await Goal.create(userId, goalData);
        return this.formatGoalResponse(goal);
    }

    static async getUserGoals(userId, filters = {}) {
        const goals = await Goal.findByUserId(userId, filters);
        return goals.map(g => this.formatGoalResponse(g));
    }

    static async getGoalById(goalId, userId) {
        const goal = await Goal.findById(goalId, userId);
        if (!goal) {
            const err = new Error('Goal not found');
            err.code = 'GOAL_NOT_FOUND';
            throw err;
        }
        return this.formatGoalResponse(goal);
    }

    static async updateGoal(goalId, userId, updates) {
        const existing = await Goal.findById(goalId, userId);
        if (!existing) {
            const err = new Error('Goal not found');
            err.code = 'GOAL_NOT_FOUND';
            throw err;
        }
        // Reset progress if target shifts more than 50 % on an active goal
        if (
            updates.targetValue &&
            existing.status === 'active' &&
            Math.abs(updates.targetValue - existing.target_value) > existing.target_value * 0.5
        ) {
            updates.currentValue = 0;
        }
        const goal = await Goal.update(goalId, userId, updates);
        return this.formatGoalResponse(goal);
    }

    static async deleteGoal(goalId, userId) {
        const deleted = await Goal.delete(goalId, userId);
        if (!deleted) {
            const err = new Error('Goal not found');
            err.code = 'GOAL_NOT_FOUND';
            throw err;
        }
        return { success: true };
    }

    // ── Stats ───────────────────────────────────────────────────────────────

    static async getGoalStats(userId) {
        const stats = await Goal.getStats(userId);
        const weeklyProgress = await Goal.getWeeklyProgress(userId);
        return {
            ...stats,
            weeklyProgress: weeklyProgress.map(g => ({
                id: g.id,
                title: g.title,
                type: g.goal_type,
                target: g.target_value,
                current: g.current_value,
                percentage: Math.min(100, parseInt(g.percentage)),
                streak: g.streak_count,
                subject: g.subject_name
            }))
        };
    }

    // ── Sessions ────────────────────────────────────────────────────────────

    static async getActiveSession(userId) {
        const session = await StudySession.getActive(userId);
        if (!session) return null;
        return {
            sessionId: session.id,
            goalId: session.goal_id,
            subjectId: session.subject_id,
            startedAt: session.started_at
        };
    }

    static async startStudySession(userId, sessionData) {
        const session = await StudySession.start(userId, sessionData);
        return {
            sessionId: session.id,
            startedAt: session.started_at,
            message: 'Study session started'
        };
    }

    static async endStudySession(sessionId, userId, sessionData) {
        const session = await StudySession.end(sessionId, userId, sessionData);
        if (!session) {
            const err = new Error('Session not found');
            err.code = 'SESSION_NOT_FOUND';
            throw err;
        }

        const activeGoals = await Goal.findByUserId(userId, { status: 'active' });
        return {
            session: {
                id: session.id,
                duration: Math.round(session.duration_minutes),
                endedAt: session.ended_at
            },
            affectedGoals: activeGoals
                .filter(g => g.current_value > 0)
                .map(g => ({
                    id: g.id,
                    title: g.title,
                    progress: Math.min(100, Math.round((g.current_value / g.target_value) * 100))
                }))
        };
    }

    static async getStudyHistory(userId, filters = {}) {
        const { days = 30 } = filters;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        const fromStr = fromDate.toISOString().split('T')[0];
        const toStr   = new Date().toISOString().split('T')[0];

        const [sessions, dailyTime, totalTime] = await Promise.all([
            StudySession.findByUserId(userId, { fromDate: fromStr, limit: 100 }),
            StudySession.getDailyStudyTime(userId, days),
            StudySession.getTotalStudyTime(userId, fromStr, toStr)
        ]);

        return {
            totalMinutes: totalTime,
            dailyBreakdown: dailyTime,
            recentSessions: sessions.map(s => ({
                id: s.id,
                type: s.session_type,
                duration: s.duration_minutes,
                subject: s.subject_name,
                goal: s.goal_title,
                startedAt: s.started_at,
                notes: s.notes_taken
            }))
        };
    }

    static async getStudyStreak(userId) {
        const streak = await StudySession.getStudyStreak(userId);
        return { streak };
    }

    /**
     * Log study time without live session tracking.
     * Uses a single atomic INSERT so the goal-progress trigger fires once
     * with the correct duration (fixes the old start→end→patch ordering bug).
     */
    static async logStudyTime(userId, minutes, subjectId = null) {
        const session = await StudySession.logManual(userId, { minutes, subjectId });
        return { success: true, minutesLogged: minutes, sessionId: session.id };
    }

    // ── Reminders (admin/cron) ───────────────────────────────────────────────

    static async getGoalsNeedingReminders() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);
        const dayOfWeek = now.getDay() || 7;
        const goals = await Goal.findGoalsNeedingReminders(currentTime, dayOfWeek);
        return goals.map(goal => ({
            goalId: goal.id,
            userId: goal.user_id,
            userEmail: goal.email,
            userName: goal.user_name,
            title: goal.title,
            target: goal.target_value,
            current: goal.current_value,
            period: goal.goal_period,
            percentage: goal.target_value > 0
                ? Math.round((goal.current_value / goal.target_value) * 100)
                : 0
        }));
    }

    static async markReminderSent(goalId) {
        await Goal.markReminderSent(goalId);
    }

    // ── Study Plan ──────────────────────────────────────────────────────────

    /**
     * Retrieve the stored study plan for a user, or null if none exists.
     */
    static async getCurrentPlan(userId) {
        const row = await StudyPlan.getLatest(userId);
        if (!row) return null;
        return {
            plan: row.plan_data,
            generatedAt: row.generated_at
        };
    }

    /**
     * Generate a fresh study plan.
     *
     * The backend owns all data fetching — goals, weak concepts from the
     * forgetting-curve table, recent study activity, and per-subject mastery.
     * The frontend only passes optional scheduling preferences.
     *
     * The result is persisted to user_study_plans so it survives page refreshes.
     */
    static async generateStudyPlan(userId, prefs = {}) {
        const daysPerWeek  = prefs.days_per_week  ?? 5;
        const hoursPerDay  = prefs.hours_per_day  ?? 2;

        // Fetch everything in parallel
        const [activeGoals, weakConcepts, recentActivity, subjectMastery] =
            await Promise.all([
                Goal.findByUserId(userId, { status: 'active' }),
                this.#fetchWeakConcepts(userId),
                this.#fetchRecentActivity(userId),
                this.#fetchSubjectMastery(userId)
            ]);

        if (activeGoals.length === 0) {
            const err = new Error('No active goals — create a goal first');
            err.code = 'NO_ACTIVE_GOALS';
            throw err;
        }

        // Build engine payload
        const payload = {
            goals: activeGoals.map(g => ({
                id: String(g.id),
                title: g.title,
                type: g.goal_type,
                target: g.target_value,
                period: g.goal_period,
                subject: g.subject_name || null,
                progress_pct: g.target_value > 0
                    ? Math.round((g.current_value / g.target_value) * 100)
                    : 0
            })),
            days_per_week:          daysPerWeek,
            hours_per_day:          hoursPerDay,
            weak_concepts_context:  weakConcepts,
            recent_activity_context: recentActivity,
            subject_mastery_context: subjectMastery
        };

        let planData;
        try {
            const response = await engineClient.post('/generate-plan', payload);
            planData = response.data;
        } catch (error) {
            console.error('[GoalService] Engine plan generation failed:', error?.response?.data || error.message);
            throw new Error('Failed to generate study plan from AI engine');
        }

        // Persist so the frontend can reload it without regenerating
        await StudyPlan.save(userId, planData);

        return {
            plan: planData,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Activate a plan — currently a no-op acknowledgement.
     * Future: could create calendar events or schedule reminders.
     */
    static async activateStudyPlan(userId, planData) {
        return { success: true, plan: planData };
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Return a human-readable string of the user's weak concepts
     * (mastery < 60) ordered by lowest mastery first.
     */
    static async #fetchWeakConcepts(userId) {
        try {
            const res = await query(
                `SELECT ucm.topic_name, ROUND(ucm.mastery_score)::int AS mastery,
                        s.name AS subject_name, ucm.last_activity_at
                 FROM user_concept_mastery ucm
                 JOIN subjects s ON ucm.subject_id = s.id
                 WHERE ucm.user_id = $1 AND ucm.mastery_score < 60
                 ORDER BY ucm.mastery_score ASC
                 LIMIT 12`,
                [userId]
            );
            if (res.rows.length === 0) return null;
            return res.rows.map(r => {
                const days = r.last_activity_at
                    ? Math.floor((Date.now() - new Date(r.last_activity_at)) / 86_400_000)
                    : null;
                const ago = days === null ? 'never reviewed'
                    : days === 0 ? 'reviewed today'
                    : `last reviewed ${days}d ago`;
                return `"${r.topic_name}" in ${r.subject_name} (mastery ${r.mastery}%, ${ago})`;
            }).join('; ');
        } catch (e) {
            console.warn('[GoalService] fetchWeakConcepts failed:', e.message);
            return null;
        }
    }

    /**
     * Return a summary of recent study activity (last 14 days).
     */
    static async #fetchRecentActivity(userId) {
        try {
            const res = await query(
                `SELECT COALESCE(SUM(duration_minutes), 0)::int AS total_minutes,
                        COUNT(*)::int AS session_count,
                        ROUND(AVG(duration_minutes))::int AS avg_session_minutes
                 FROM study_sessions
                 WHERE user_id = $1
                   AND ended_at IS NOT NULL
                   AND started_at >= NOW() - INTERVAL '14 days'`,
                [userId]
            );
            const r = res.rows[0];
            if (!r || r.session_count === 0) return null;
            return `Over the last 2 weeks: ${r.session_count} sessions, ` +
                   `${r.total_minutes} min total, avg ${r.avg_session_minutes} min/session`;
        } catch (e) {
            console.warn('[GoalService] fetchRecentActivity failed:', e.message);
            return null;
        }
    }

    /**
     * Return a summary of per-subject mastery levels.
     */
    static async #fetchSubjectMastery(userId) {
        try {
            const res = await query(
                `SELECT s.name, ROUND(AVG(ucm.mastery_score))::int AS avg_mastery
                 FROM user_concept_mastery ucm
                 JOIN subjects s ON ucm.subject_id = s.id
                 WHERE ucm.user_id = $1
                 GROUP BY s.name
                 ORDER BY avg_mastery ASC
                 LIMIT 8`,
                [userId]
            );
            if (res.rows.length === 0) return null;
            return res.rows
                .map(r => `${r.name}: ${r.avg_mastery}% mastery`)
                .join(', ');
        } catch (e) {
            console.warn('[GoalService] fetchSubjectMastery failed:', e.message);
            return null;
        }
    }

    // ── Validation & formatting ──────────────────────────────────────────────

    static validateGoalData(goalData) {
        const { title, goalType, goalPeriod, targetValue } = goalData;

        if (!title || title.trim().length < 3) {
            const err = new Error('Goal title must be at least 3 characters');
            err.code = 'INVALID_TITLE';
            throw err;
        }
        if (!['study_time', 'material_completion', 'quiz_completion', 'exam_score'].includes(goalType)) {
            const err = new Error('Invalid goal type');
            err.code = 'INVALID_GOAL_TYPE';
            throw err;
        }
        if (!['daily', 'weekly', 'monthly'].includes(goalPeriod)) {
            const err = new Error('Invalid goal period');
            err.code = 'INVALID_GOAL_PERIOD';
            throw err;
        }
        if (!targetValue || targetValue < 1 || targetValue > 10000) {
            const err = new Error('Target value must be between 1 and 10000');
            err.code = 'INVALID_TARGET';
            throw err;
        }
        if (goalData.reminderDays) {
            if (!Array.isArray(goalData.reminderDays) ||
                !goalData.reminderDays.every(d => d >= 1 && d <= 7)) {
                const err = new Error('Reminder days must be an array of numbers 1–7');
                err.code = 'INVALID_REMINDER_DAYS';
                throw err;
            }
        }
    }

    static formatGoalResponse(goal) {
        if (!goal) return null;
        return {
            id:                   goal.id,
            userId:               goal.user_id,
            subjectId:            goal.subject_id,
            subjectName:          goal.subject_name,
            title:                goal.title,
            description:          goal.description,
            goalType:             goal.goal_type,
            goalPeriod:           goal.goal_period,
            status:               goal.status,
            targetValue:          goal.target_value,
            targetScore:          goal.target_score,
            currentValue:         goal.current_value,
            completionPercentage: Math.min(100, parseInt(goal.completion_percentage || 0)),
            streakCount:          goal.streak_count,
            longestStreak:        goal.longest_streak,
            reminderTime:         goal.reminder_time,
            reminderDays:         goal.reminder_days,
            startDate:            goal.start_date,
            endDate:              goal.end_date,
            completedAt:          goal.completed_at,
            createdAt:            goal.created_at,
            updatedAt:            goal.updated_at
        };
    }
}

export default GoalService;
