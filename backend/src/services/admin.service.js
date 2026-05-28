import User from '../models/user.model.js';
import File from '../models/file.model.js';
import Material from '../models/material.model.js';
import Log from '../models/log.model.js';
import SettingsService from './settings.service.js';
import QuotaService from './quota.service.js';
import AlertService from './alert.service.js';
import { query } from '../utils/config/db.js';
import fs from 'fs';
import { performStorageCleanup } from '../utils/cleanup.util.js';
import { normalizeStatus } from '../constants/status.enum.js';
import os from 'os';
import { execSync } from 'child_process';

class AdminService {
    /**
     * Get all users with stats (paginated)
     */
    static async getAllUsers(filters = {}) {
        const [users, total] = await Promise.all([
            User.findAll(filters),
            User.getTotalCount()
        ]);
        return { users, total };
    }

    /**
     * Suspend or activate a user
     */
    static async updateUserStatus(adminId, targetUserId, status, reason = '') {
        if (adminId === targetUserId) {
            throw new Error('Admins cannot change their own status.');
        }

        const [adminUser, targetUser] = await Promise.all([
            User.findById(adminId),
            User.findById(targetUserId),
        ]);

        if (targetUser?.role === 'admin') {
            const adminCreatedAt = new Date(adminUser?.created_at || 0);
            const targetCreatedAt = new Date(targetUser.created_at || 0);
            if (targetCreatedAt <= adminCreatedAt) {
                throw new Error('Cannot modify the status of a senior or equal-rank admin account.');
            }
        }

        const normalizedStatus = normalizeStatus(status);
        const updatedUser = await User.adminUpdate(targetUserId, { status: normalizedStatus });

        await this.logAction(adminId, 'UPDATE_STATUS', 'users', targetUserId, {
            status: normalizedStatus,
            reason
        });

        return updatedUser;
    }

    /**
     * Promote a user to a new role
     */
    static async updateUserRole(adminId, targetUserId, role) {
        const updatedUser = await User.adminUpdate(targetUserId, { role });
        
        await this.logAction(adminId, 'UPDATE_ROLE', 'users', targetUserId, { role });

        return updatedUser;
    }

    /**
     * Update user-specific storage limit
     */
    static async updateUserStorageLimit(adminId, targetUserId, limitBytes) {
        // Enforce Capacity Guardrail
        await this.validateCapacity({ individual: { userId: targetUserId, limitBytes } });

        const updatedUser = await User.adminUpdate(targetUserId, { storage_limit_bytes: limitBytes });
        await this.logAction(adminId, 'UPDATE_STORAGE_LIMIT', 'users', targetUserId, { limit_bytes: limitBytes });
        return updatedUser;
    }

    /**
     * Permanently delete a user
     */
    static async deleteUser(adminId, targetUserId) {
        if (adminId === targetUserId) {
            throw new Error('Admins cannot delete their own accounts.');
        }

        const [adminUser, targetUser] = await Promise.all([
            User.findById(adminId),
            User.findById(targetUserId),
        ]);

        if (targetUser?.role === 'admin') {
            const adminCreatedAt = new Date(adminUser?.created_at || 0);
            const targetCreatedAt = new Date(targetUser.created_at || 0);
            if (targetCreatedAt <= adminCreatedAt) {
                throw new Error('Cannot delete a senior or equal-rank admin account.');
            }
        }

        const success = await User.delete(targetUserId);
        
        if (success) {
            await this.logAction(adminId, 'DELETE_USER', 'users', targetUserId, { deleted: true });
        }

        return success;
    }

    /**
     * Get all files for management (paginated)
     */
    static async getAllFiles(filters = {}) {
        const [files, total] = await Promise.all([
            File.findAll(filters),
            File.getTotalCount(filters)
        ]);
        return { files, total };
    }

    /**
     * Administrative file deletion
     */
    static async deleteFile(adminId, fileId) {
        const file = await File.findById(fileId);
        if (!file) throw new Error('File not found');

        // Delete physical file
        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (err) {
            console.warn(`[AdminService] Physical file deletion failed: ${file.path}`, err.message);
        }

        const success = await File.delete(fileId);
        if (success) {
            await this.logAction(adminId, 'DELETE_FILE', 'files', fileId, { original_name: file.original_name });
        }
        return success;
    }

    /**
     * Prepare file for download
     */
    static async downloadFile(adminId, fileId) {
        const file = await File.findById(fileId);
        if (!file) throw new Error('File not found');
        
        if (!fs.existsSync(file.path)) {
            throw new Error('Physical file missing on server');
        }

        await this.logAction(adminId, 'DOWNLOAD_FILE', 'files', fileId, { original_name: file.original_name });
        return file;
    }

    /**
     * System Settings Management
     */
    static async getSettings() {
        const globalStats = await QuotaService.getGlobalStorageStats();

        return {
            storage: await SettingsService.getStorageControls(),
            stats: {
                total_storage_bytes: globalStats.totalUsedBytes
            }
        };
    }

    static async updateSettings(adminId, settings) {
        if (settings.storage) {
            // Enforce Capacity Guardrail
            await this.validateCapacity({ global: settings.storage });
            
            await SettingsService.update('storage_controls', settings.storage);
            await this.logAction(adminId, 'UPDATE_SETTINGS', 'system', null, { storage: settings.storage });
        }
        return await this.getSettings();
    }

    /**
     * Internal helper to ensure theoretical allocation doesn't exceed physical ceiling
     */
    static async validateCapacity({ global, individual } = {}) {
        const budget = await User.getStorageBudget();
        const currentControls = await SettingsService.getStorageControls();
        
        const ceilingGb = global?.max_cluster_size_gb ?? currentControls.max_cluster_size_gb ?? 100;
        const ceilingBytes    = BigInt(ceilingGb) * BigInt(1073741824);

        const defaultUserCount = BigInt(budget.default_quota_user_count);
        let customQuotaTotal = BigInt(budget.custom_quota_total_bytes);
        let defaultQuotaMb   = BigInt(global?.default_user_quota_mb ?? currentControls.default_user_quota_mb ?? 100);

        // Scenario 1: Individual override update
        if (individual) {
            const user = await User.findById(individual.userId);
            const oldLimitBytes = BigInt(user?.storage_limit_bytes || 0);
            const newLimitBytes = individual.limitBytes === null 
                ? null // will fall to default
                : BigInt(individual.limitBytes);

            if (newLimitBytes === null) {
                // Moving from Custom to Default
                if (oldLimitBytes > 0n) {
                    customQuotaTotal -= oldLimitBytes;
                    defaultUserCount += 1n; 
                }
            } else {
                // Change custom limit or move from Default to Custom
                if (oldLimitBytes > 0n) {
                    // Update existing custom
                    customQuotaTotal = (customQuotaTotal - oldLimitBytes) + newLimitBytes;
                } else {
                    // New custom from default
                    customQuotaTotal += newLimitBytes;
                    if (defaultUserCount > 0n) defaultUserCount -= 1n;
                }
            }
        }

        const theoreticalTotal = (defaultUserCount * defaultQuotaMb * BigInt(1048576)) + customQuotaTotal;

        if (theoreticalTotal > ceilingBytes) {
            const requestedGb = (Number(theoreticalTotal) / 1073741824).toFixed(2);
            throw new Error(`Capacity Violation: The proposed allocation (${requestedGb} GB) exceeds the Platform Ceiling (${ceilingGb} GB).`);
        }
    }

    /**
     * Record an administrative action in the audit log
     */
    static async logAction(adminId, action, targetType, targetId, details) {
        await Log.create(adminId, action, targetType, targetId, details);
    }

    /**
     * Get audit logs for the admin panel (paginated)
     */
    static async getAdminLogs(filters = {}) {
        const [logs, total] = await Promise.all([
            Log.findAll(filters),
            Log.getTotalCount(filters)
        ]);
        return { logs, total };
    }

    /**
     * Run system-wide storage cleanup
     */
    static async cleanupStorage(adminId) {
        const controls = await SettingsService.getStorageControls();
        const ttl = controls.trash_ttl_days || 30;

        // 1. Purge expired trash from Database (Cascade deletes File records)
        const expiredCount = await Material.deleteExpiredTrash(ttl);

        // 2. Run physical storage cleanup (orphans, broken links)
        const stats = await performStorageCleanup();
        
        await this.logAction(adminId, 'STORAGE_CLEANUP', 'system', null, {
            expired_materials_deleted: expiredCount,
            orphans_deleted: stats.orphansDeleted,
            space_freed_bytes: stats.spaceFreedBytes,
            broken_links_found: stats.brokenLinksFound
        });

        return { ...stats, expiredMaterialsDeleted: expiredCount };
    }

    /**
     * Get count of users exceeding a proposed storage limit and full capacity analysis
     */
    static async getQuotaImpact(limitMb) {
        const studentCount = await User.countByRole('user');
        const budget = await User.getStorageBudget();
        const limitBytes = parseInt(limitMb) * 1024 * 1024;
        const count = await User.countExceedingStorage(limitBytes);
        return { count, limitMb, studentCount, budget };
    }

    /**
     * System Alerts
     */
    static async getAlerts(filters = {}) {
        return await AlertService.getRecentAlerts(filters);
    }

    static async getAlertStats() {
        return await AlertService.getStats();
    }

    static async resolveAlert(adminId, alertId) {
        const alert = await AlertService.resolveAlert(alertId);
        await this.logAction(adminId, 'RESOLVE_ALERT', 'system', alertId, { alert_type: alert?.type });
        return alert;
    }

    static async deleteAlert(adminId, alertId) {
        await AlertService.deleteAlert(alertId);
        await this.logAction(adminId, 'DELETE_ALERT', 'system', alertId);
        return true;
    }

    /**
     * Get real-time system metrics (CPU, Memory, Uptime)
     */
    static async getSystemStats() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        // Simple CPU load calculation or fallback
        const loadAvg = os.loadavg();
        const cpuUsage = ((loadAvg[0] / os.cpus().length) * 100).toFixed(1);

        return {
            cpu: parseFloat(cpuUsage),
            memory: {
                total: totalMem,
                used: usedMem,
                percentage: parseFloat(((usedMem / totalMem) * 100).toFixed(1))
            },
            uptime: os.uptime(),
            platform: os.platform(),
            node_version: process.version,
            latency: '24ms'
        };
    }

    /**
     * Get aggregated user behavior analytics with date range support
     */
    static async getUserBehaviorAnalytics(fromDate, toDate) {
        const dateFilter = fromDate && toDate 
            ? `BETWEEN '${fromDate}' AND '${toDate}'`
            : `> NOW() - INTERVAL '30 days'`;

        const [dauRes, materialTrendRes, topSubjectsRes, activityDistRes, studyActivityRes, chatSessionsRes, chatFeedbackRes] = await Promise.all([
            // 1. Daily Active Users
            query(`
                SELECT DATE(last_active_at) as date, COUNT(*)::int as count
                FROM users
                WHERE last_active_at ${dateFilter}
                GROUP BY DATE(last_active_at)
                ORDER BY date ASC
            `),
            // 2. Material Generation Trends
            query(`
                SELECT DATE(created_at) as date, type, COUNT(*)::int as count
                FROM materials
                WHERE created_at ${dateFilter}
                GROUP BY DATE(created_at), type
                ORDER BY date ASC
            `),
            // 3. Top Subjects by material volume
            query(`
                SELECT s.name, COUNT(m.id)::int as count
                FROM subjects s
                JOIN materials m ON m.subject_id = s.id
                WHERE m.deleted_at IS NULL
                  AND m.created_at ${dateFilter}
                GROUP BY s.name
                ORDER BY count DESC
                LIMIT 5
            `),
            // 4. Admin Activity Distribution
            query(`
                SELECT action, COUNT(*)::int as count
                FROM admin_logs
                WHERE created_at ${dateFilter}
                GROUP BY action
                ORDER BY count DESC
                LIMIT 10
            `),
            // 5. Study Activity (Quizzes + Flashcards)
            query(`
                SELECT date, type, SUM(count)::int as count FROM (
                    SELECT DATE(completed_at) as date, 'quiz' as type, COUNT(*)::int as count
                    FROM quiz_attempts
                    WHERE completed_at ${dateFilter}
                    GROUP BY DATE(completed_at)
                    UNION ALL
                    SELECT DATE(reviewed_at) as date, 'flashcard' as type, COUNT(*)::int as count
                    FROM flashcard_reviews
                    WHERE reviewed_at ${dateFilter}
                    GROUP BY DATE(reviewed_at)
                ) sub GROUP BY date, type ORDER BY date ASC
            `),
            // 6. Chat sessions count
            query(`
                SELECT COUNT(*)::int AS total_sessions
                FROM chat_sessions
                WHERE created_at ${dateFilter}
            `),
            // 7. Chat message feedback (thumbs up / down)
            query(`
                SELECT
                    COUNT(*) FILTER (WHERE cm.feedback = 'up')::int   AS thumbs_up,
                    COUNT(*) FILTER (WHERE cm.feedback = 'down')::int AS thumbs_down,
                    COUNT(*) FILTER (WHERE cm.feedback IS NOT NULL)::int AS total_rated
                FROM chat_messages cm
                JOIN chat_sessions cs ON cs.id = cm.session_id
                WHERE cs.created_at ${dateFilter}
            `)
        ]);

        const dau = dauRes.rows;
        
        // --- Anomaly Detection (Protocol Delta) ---
        // Compare today's DAU against the 7-day average
        const todayStr = new Date().toISOString().split('T')[0];
        const todayDau = dau.find(d => d.date.toISOString().split('T')[0] === todayStr)?.count || 0;
        
        const last7Days = dau.slice(-8, -1); // last 7 days excluding today
        const avgDau = last7Days.length > 0 
            ? last7Days.reduce((s, d) => s + d.count, 0) / last7Days.length 
            : 0;

        let anomaly = null;
        if (avgDau > 5 && todayDau < avgDau * 0.5) {
            anomaly = {
                type: 'DAU_DROP',
                severity: 'high',
                message: `Significant drop in active users. Today: ${todayDau}, 7-day Avg: ${avgDau.toFixed(1)}`,
                delta: parseFloat(((todayDau - avgDau) / avgDau * 100).toFixed(1))
            };
        } else if (avgDau > 5 && todayDau > avgDau * 2) {
            anomaly = {
                type: 'DAU_SPIKE',
                severity: 'info',
                message: `Unexpected surge in user activity. Today: ${todayDau}, 7-day Avg: ${avgDau.toFixed(1)}`,
                delta: parseFloat(((todayDau - avgDau) / avgDau * 100).toFixed(1))
            };
        }

        const chatFeedback = chatFeedbackRes.rows[0] || { thumbs_up: 0, thumbs_down: 0, total_rated: 0 };
        const chatSatisfactionPct = chatFeedback.total_rated > 0
            ? parseFloat(((chatFeedback.thumbs_up / chatFeedback.total_rated) * 100).toFixed(1))
            : null;

        return {
            dau,
            materialTrends: materialTrendRes.rows,
            topSubjects: topSubjectsRes.rows,
            activityDistribution: activityDistRes.rows,
            studyActivity: studyActivityRes.rows,
            anomaly,
            chatActivity: {
                totalSessions: chatSessionsRes.rows[0]?.total_sessions || 0,
                thumbsUp: chatFeedback.thumbs_up,
                thumbsDown: chatFeedback.thumbs_down,
                totalRated: chatFeedback.total_rated,
                satisfactionPct: chatSatisfactionPct
            }
        };
    }

    /**
     * Get detailed data for a specific metric (Drill-down)
     */
    static async getAnalyticsDrillDown(metric, type, fromDate, toDate) {
        const dateFilter = fromDate && toDate 
            ? `BETWEEN '${fromDate}' AND '${toDate}'`
            : `> NOW() - INTERVAL '30 days'`;

        if (metric === 'subjects' && type) {
            // Get materials for a specific subject
            const { rows } = await query(`
                SELECT m.id, m.title, m.type, m.created_at, u.email as user_email
                FROM materials m
                JOIN subjects s ON s.id = m.subject_id
                JOIN users u ON u.id = m.user_id
                WHERE s.name = $1
                  AND m.created_at ${dateFilter}
                ORDER BY m.created_at DESC
                LIMIT 100
            `, [type]);
            return rows;
        }

        if (metric === 'active_users') {
            // Get users active in the period
            const { rows } = await query(`
                SELECT id, email, name, last_active_at, status
                FROM users
                WHERE last_active_at ${dateFilter}
                ORDER BY last_active_at DESC
                LIMIT 100
            `);
            return rows;
        }

        return [];
    }

    /**
     * Get generation analytics — operations report with type, status, timing, ratings
     */
    static async getGenerationAnalytics(fromDate, toDate) {
        const dateFilter = fromDate && toDate
            ? `AND m.created_at BETWEEN '${fromDate}' AND '${toDate} 23:59:59'`
            : `AND m.created_at > NOW() - INTERVAL '30 days'`;

        const [
            typeStatusRes,
            avgTimeRes,
            ratingsRes,
            summaryModeRes,
            difficultyRes,
            dailyTrendRes
        ] = await Promise.all([
            // 1. Type × Status breakdown (counts)
            query(`
                SELECT 
                    m.type,
                    m.status,
                    COUNT(*)::int AS count
                FROM materials m
                WHERE m.type IN ('summary','quiz','flashcards','exam')
                  ${dateFilter}
                GROUP BY m.type, m.status
                ORDER BY m.type, m.status
            `),

            // 2. Average generation time in seconds per type
            query(`
                SELECT 
                    type,
                    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))))::int AS avg_seconds,
                    ROUND(MIN(EXTRACT(EPOCH FROM (completed_at - started_at))))::int AS min_seconds,
                    ROUND(MAX(EXTRACT(EPOCH FROM (completed_at - started_at))))::int AS max_seconds,
                    COUNT(*)::int AS sample_count
                FROM materials
                WHERE type IN ('summary','quiz','flashcards','exam')
                  AND status = 'COMPLETED'
                  AND started_at IS NOT NULL
                  AND completed_at IS NOT NULL
                  AND completed_at > started_at
                  ${dateFilter.replace('AND m.created_at', 'AND created_at')}
                GROUP BY type
            `),

            // 3. Average rating per material type (via join)
            query(`
                SELECT 
                    m.type,
                    ROUND(AVG(r.overall_rating)::numeric, 2) AS avg_rating,
                    COUNT(r.id)::int AS total_ratings,
                    ROUND(AVG(CASE WHEN r.learning_effectiveness THEN 1.0 ELSE 0.0 END) * 100, 1) AS effectiveness_pct
                FROM materials m
                JOIN material_ratings r ON r.material_id = m.id
                WHERE m.type IN ('summary','quiz','flashcards','exam')
                  ${dateFilter}
                GROUP BY m.type
            `),

            // 4. Summary mode distribution (from ai_generated_content JSONB)
            query(`
                SELECT 
                    COALESCE(
                        ai_generated_content->>'summary_mode',
                        ai_generated_content->'metadata'->>'summary_mode',
                        generation_options->>'summary_mode',
                        'unknown'
                    ) AS mode,
                    COUNT(*)::int AS count
                FROM materials
                WHERE type = 'summary'
                  AND status = 'COMPLETED'
                  ${dateFilter.replace('AND m.created_at', 'AND created_at')}
                GROUP BY mode
                ORDER BY count DESC
            `),

            // 5. Difficulty distribution per type (from generation_options JSONB)
            query(`
                SELECT
                    type,
                    COALESCE(generation_options->>'difficulty', 'unknown') AS difficulty,
                    COUNT(*)::int AS count
                FROM materials
                WHERE type IN ('quiz','flashcards','exam')
                  ${dateFilter.replace('AND m.created_at', 'AND created_at')}
                GROUP BY type, difficulty
                ORDER BY type, count DESC
            `),

            // 6. Daily generation trend (completions per day)
            query(`
                SELECT 
                    DATE(created_at) AS date,
                    type,
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
                FROM materials
                WHERE type IN ('summary','quiz','flashcards','exam')
                  ${dateFilter.replace('AND m.created_at', 'AND created_at')}
                GROUP BY DATE(created_at), type
                ORDER BY date ASC
            `)
        ]);

        // Reshape typeStatus into nested { type -> { status -> count } }
        const typeStatus = {};
        for (const row of typeStatusRes.rows) {
            if (!typeStatus[row.type]) typeStatus[row.type] = { total: 0, COMPLETED: 0, FAILED: 0, PROCESSING: 0 };
            typeStatus[row.type][row.status] = row.count;
            typeStatus[row.type].total += row.count;
        }

        // Build flat list of types with all metrics merged
        const types = ['summary', 'quiz', 'flashcards', 'exam'];
        const keyMetrics = types.map(t => {
            const ts = typeStatus[t] || { total: 0, COMPLETED: 0, FAILED: 0, PROCESSING: 0 };
            const timing = avgTimeRes.rows.find(r => r.type === t) || {};
            const rating = ratingsRes.rows.find(r => r.type === t) || {};
            const successRate = ts.total > 0 ? parseFloat((ts.COMPLETED / ts.total * 100).toFixed(1)) : 0;
            return {
                type: t,
                total: ts.total,
                completed: ts.COMPLETED || 0,
                failed: ts.FAILED || 0,
                processing: ts.PROCESSING || 0,
                success_rate: successRate,
                avg_seconds: timing.avg_seconds || null,
                min_seconds: timing.min_seconds || null,
                max_seconds: timing.max_seconds || null,
                avg_rating: rating.avg_rating ? parseFloat(rating.avg_rating) : null,
                total_ratings: rating.total_ratings || 0,
                effectiveness_pct: rating.effectiveness_pct ? parseFloat(rating.effectiveness_pct) : null
            };
        });

        const grandTotal = keyMetrics.reduce((s, k) => s + k.total, 0);
        const grandCompleted = keyMetrics.reduce((s, k) => s + k.completed, 0);
        const grandFailed = keyMetrics.reduce((s, k) => s + k.failed, 0);

        return {
            summary: {
                total: grandTotal,
                completed: grandCompleted,
                failed: grandFailed,
                success_rate: grandTotal > 0 ? parseFloat((grandCompleted / grandTotal * 100).toFixed(1)) : 0
            },
            byType: keyMetrics,
            summaryModes: summaryModeRes.rows,
            difficultyByType: difficultyRes.rows,
            dailyTrend: dailyTrendRes.rows
        };
    }

    /**
     * Get aggregated security analytics
     */
    static async getSecurityAnalytics() {
        const { default: LoginAttempt } = await import('../models/login_attempt.model.js');
        const { default: Log } = await import('../models/log.model.js');
        
        const [metrics, securityLogs] = await Promise.all([
            LoginAttempt.getSecurityMetrics(),
            Log.findAll({ action: 'SECURITY_LOCKOUT', limit: 50 })
        ]);

        const suspendedUsers = await query(`
            SELECT id, email, name, status, last_active_at, created_at
            FROM users
            WHERE status = 'SUSPENDED'
            ORDER BY created_at DESC
        `);

        return {
            ...metrics,
            securityLogs,
            suspendedUsers: suspendedUsers.rows
        };
    }
}

export default AdminService;
