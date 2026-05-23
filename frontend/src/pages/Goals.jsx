import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Target, Plus, Search, MoreVertical, Edit2, Trash2, Play,
    Clock, Sparkles, ChevronDown, CalendarDays, RotateCcw,
    ListTodo, X, Check, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/AuthContext';
import { useSubjectStore } from '@/store/useSubjectStore';
import { goalService, getProgressColor, goalTypeLabels } from '@/services/GoalService';
import { GoalSettingModal } from '@/features/goals';
import toast from 'react-hot-toast';

// ── Todos helpers (localStorage per user) ────────────────────────────────────

const TODOS_KEY = (uid) => `cognify_todos_${uid}`;

const loadTodos = (uid) => {
    try { return JSON.parse(localStorage.getItem(TODOS_KEY(uid)) || '[]'); }
    catch { return []; }
};

const saveTodos = (uid, todos) => {
    try { localStorage.setItem(TODOS_KEY(uid), JSON.stringify(todos)); } catch {}
};

// ── Plan session day ordering ─────────────────────────────────────────────────

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── Goals page ────────────────────────────────────────────────────────────────

const Goals = () => {
    const { user } = useAuth();
    const subjects     = useSubjectStore(s => s.data.subjects);
    const fetchSubjects = useSubjectStore(s => s.actions.fetchSubjects);

    // goals
    const [goals, setGoals]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [stats, setStats]           = useState(null);
    const [showModal, setShowModal]   = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [sessionTimer, setSessionTimer]   = useState(0);
    const [filter, setFilter]         = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // todos
    const [todos, setTodos]           = useState([]);
    const [newTodo, setNewTodo]       = useState('');
    const [showTodoInput, setShowTodoInput] = useState(false);

    // study plan
    const [plan, setPlan]             = useState(null);       // { plan, generatedAt }
    const [planLoading, setPlanLoading] = useState(false);
    const [showPlanSessions, setShowPlanSessions] = useState(true);

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [goalsRes, statsRes, sessionRes, planRes] = await Promise.all([
                goalService.getGoals(),
                goalService.getStats(),
                goalService.getActiveSession(),
                goalService.getCurrentPlan(),
            ]);

            setGoals(goalsRes.data?.data ?? []);
            setStats(statsRes.data?.data ?? null);

            const session = sessionRes.data?.data ?? null;
            if (session) {
                setActiveSession(session);
                setSessionTimer(Math.max(0,
                    Math.floor((Date.now() - new Date(session.startedAt)) / 1000)
                ));
            } else {
                setActiveSession(null);
                setSessionTimer(0);
            }

            // Load stored plan — no regeneration needed on mount
            const storedPlan = planRes.data?.data ?? null;
            if (storedPlan) setPlan(storedPlan);

        } catch {
            toast.error('Failed to load goals');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchSubjects();
    }, [fetchData]);

    useEffect(() => {
        if (user?.id) setTodos(loadTodos(user.id));
    }, [user?.id]);

    useEffect(() => {
        if (!activeSession) return;
        const id = setInterval(() => setSessionTimer(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [activeSession]);

    const formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // ── Goal handlers ─────────────────────────────────────────────────────────

    const handleCreateGoal = () => { setEditingGoal(null); setShowModal(true); };
    const handleEditGoal   = (g) => { setEditingGoal(g); setShowModal(true); };

    const handleToggleStatus = async (goal) => {
        try {
            const next = goal.status === 'active' ? 'paused' : 'active';
            await goalService.updateGoal(goal.id, { status: next });
            toast.success(`Goal ${next}`);
            fetchData();
        } catch { toast.error('Failed to update goal'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this goal?')) return;
        try {
            await goalService.deleteGoal(id);
            toast.success('Goal deleted');
            fetchData();
        } catch { toast.error('Failed to delete goal'); }
    };

    const handleStartSession = async (goalId) => {
        try {
            const res = await goalService.startSession({ goalId });
            const session = res.data?.data ?? null;
            if (session) { setActiveSession(session); setSessionTimer(0); toast.success('Session started'); }
        } catch { toast.error('Failed to start session'); }
    };

    const handleEndSession = async () => {
        if (!activeSession?.sessionId) return;
        try {
            await goalService.endSession(activeSession.sessionId);
            setActiveSession(null);
            setSessionTimer(0);
            toast.success('Session saved');
            fetchData();
        } catch { toast.error('Failed to end session'); }
    };

    const filteredGoals = useMemo(() => goals.filter(goal => {
        if (filter === 'active'    && goal.status !== 'active')    return false;
        if (filter === 'completed' && goal.status !== 'completed') return false;
        if (searchQuery && !goal.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    }), [goals, filter, searchQuery]);

    // ── Todo handlers ─────────────────────────────────────────────────────────

    const persistTodos = (next) => {
        setTodos(next);
        if (user?.id) saveTodos(user.id, next);
    };

    const handleAddTodo = () => {
        const text = newTodo.trim();
        if (!text) return;
        persistTodos([...todos, { id: Date.now(), text, done: false }]);
        setNewTodo('');
        setShowTodoInput(false);
    };

    const handleToggleTodo = (id) =>
        persistTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));

    const handleDeleteTodo = (id) =>
        persistTodos(todos.filter(t => t.id !== id));

    // ── Study plan handler ────────────────────────────────────────────────────

    const handleGeneratePlan = async () => {
        const hasActiveGoals = goals.some(g => g.status === 'active');
        if (!hasActiveGoals) {
            toast.error('Create at least one active goal first');
            return;
        }
        setPlanLoading(true);
        try {
            // Backend owns all data fetching — we only pass scheduling prefs
            const res = await goalService.generatePlan({ days_per_week: 5, hours_per_day: 2 });
            const result = res.data?.data ?? null;
            if (result) {
                setPlan(result);
                setShowPlanSessions(true);
                toast.success('Study plan updated');
            }
        } catch {
            toast.error('Failed to generate study plan');
        } finally {
            setPlanLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const planSessions = plan?.plan?.content?.sessions ?? [];
    const planSummary  = plan?.plan?.content?.summary  ?? null;
    const planDate     = plan?.generatedAt
        ? new Date(plan.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'var(--c-canvas)' }}>
            <div className="max-w-4xl mx-auto px-8 py-10 space-y-10">

                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Goals</h1>
                        </div>
                        <p className="text-sm text-gray-400 font-medium ml-[52px]">
                            {stats?.active_goals ?? 0} active
                        </p>
                    </div>

                    {stats && (
                        <div className="hidden sm:flex items-center gap-4">
                            <div className="text-center px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-xl font-black text-indigo-600">{stats.total_goals ?? 0}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                            </div>
                            <div className="text-center px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-xl font-black text-emerald-600">{stats.completed_goals ?? 0}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Done</p>
                            </div>
                            {(stats.current_streak ?? 0) > 0 && (
                                <div className="text-center px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-xl font-black text-orange-500">{stats.current_streak}🔥</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Streak</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Goals list ───────────────────────────────────────────── */}
                <section>
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search goals…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 focus:border-indigo-300 rounded-2xl text-sm font-medium transition-all outline-none shadow-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
                            {['all','active','completed'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                                        filter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                >{f}</button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
                            {[1,2,3,4].map(i => <div key={i} className="h-44 bg-white/60 rounded-[2rem] border border-white" />)}
                        </div>
                    ) : filteredGoals.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filteredGoals.map(goal => {
                                const isActive = activeSession?.goalId === goal.id;
                                return (
                                    <motion.div
                                        key={goal.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        whileHover={{ y: -4, scale: 1.01 }}
                                        className={`group relative overflow-hidden rounded-[2rem] border-2 transition-all duration-300 ${
                                            goal.status === 'active'
                                                ? 'border-white bg-white/70 backdrop-blur-md shadow-lg hover:shadow-indigo-500/10'
                                                : 'border-gray-100 bg-gray-50/50 opacity-60'
                                        }`}
                                    >
                                        <div className="relative p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`font-black text-lg tracking-tight leading-tight mb-1 truncate ${goal.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                        {goal.title}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ring-1 ${goal.goalType === 'study_time' ? 'bg-blue-50 text-blue-600 ring-blue-100' : 'bg-purple-50 text-purple-600 ring-purple-100'}`}>
                                                            {goalTypeLabels[goal.goalType]}
                                                        </span>
                                                        {goal.subjectName && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-gray-500 bg-gray-100">
                                                                {goal.subjectName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="relative group/menu">
                                                    <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-100 rounded-2xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-30 overflow-hidden p-1">
                                                        <button onClick={() => handleEditGoal(goal)} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2">
                                                            <Edit2 className="w-3.5 h-3.5" /> Edit
                                                        </button>
                                                        <button onClick={() => handleToggleStatus(goal)} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                                                            <RotateCcw className="w-3.5 h-3.5" /> {goal.status === 'active' ? 'Pause' : 'Resume'}
                                                        </button>
                                                        <button onClick={() => handleDelete(goal.id)} className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progress</span>
                                                    <span className={`text-sm font-black ${getProgressColor(goal.completionPercentage)}`}>{goal.completionPercentage}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.min(100, goal.completionPercentage)}%` }}
                                                        className={`h-full rounded-full ${goal.completionPercentage >= 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                                                    />
                                                </div>
                                            </div>

                                            {!isActive && goal.status === 'active' && (
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleStartSession(goal.id)}
                                                    className="mt-4 w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-black transition-all"
                                                >
                                                    <Play className="w-3 h-3 fill-current" /> Start Session
                                                </motion.button>
                                            )}

                                            {isActive && (
                                                <div className="mt-4 p-2.5 bg-emerald-50 rounded-xl flex items-center justify-between border border-emerald-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                        <span className="text-[10px] font-black text-emerald-700 uppercase tabular-nums">{formatTimer(sessionTimer)}</span>
                                                    </div>
                                                    <button onClick={handleEndSession} className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg">Done</button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 px-6">
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-5 border border-gray-100 shadow-sm">
                                <Target className="w-10 h-10 text-gray-200" />
                            </div>
                            <h3 className="font-black text-xl text-gray-900 mb-2">No goals yet</h3>
                            <p className="text-sm text-gray-400 mb-6">Set a goal to start tracking your progress.</p>
                            <button onClick={handleCreateGoal} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:scale-[1.02] transition-transform">
                                <Plus className="w-4 h-4" /> Add Goal
                            </button>
                        </div>
                    )}
                </section>

                {/* ── Study Plan ────────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-purple-600" />
                            <h2 className="text-lg font-black text-gray-900">Study Plan</h2>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-black rounded-full uppercase tracking-wide">AI</span>
                            {planDate && !planLoading && (
                                <span className="text-[10px] text-gray-400 font-medium">· generated {planDate}</span>
                            )}
                        </div>
                        <button
                            onClick={handleGeneratePlan}
                            disabled={planLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {planLoading
                                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                                : <><Sparkles className="w-3.5 h-3.5" /> {plan ? 'Regenerate' : 'Generate'}</>
                            }
                        </button>
                    </div>

                    {planLoading && (
                        <div className="py-10 text-center">
                            <div className="w-8 h-8 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-sm text-gray-400">Analysing your goals, mastery levels, and weak concepts…</p>
                        </div>
                    )}

                    {!planLoading && !plan && (
                        <div className="text-center py-10 bg-white/50 rounded-2xl border border-gray-100">
                            <CalendarDays className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                            <p className="text-sm text-gray-500 mb-1 font-medium">No plan yet</p>
                            <p className="text-xs text-gray-300">
                                Click Generate — the AI will use your goals and forgetting-curve data to build a personalised schedule.
                            </p>
                        </div>
                    )}

                    {!planLoading && plan && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {planSummary && (
                                <div className="px-5 py-4 border-b border-gray-50 bg-purple-50/40">
                                    <p className="text-sm text-gray-700 leading-relaxed">{planSummary}</p>
                                </div>
                            )}

                            <button
                                onClick={() => setShowPlanSessions(v => !v)}
                                className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <span>{planSessions.length} session{planSessions.length !== 1 ? 's' : ''} this week</span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showPlanSessions ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showPlanSessions && planSessions.length > 0 && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="divide-y divide-gray-50">
                                            {[...planSessions]
                                                .sort((a, b) => {
                                                    const ai = DAY_ORDER.indexOf(a.day_of_week);
                                                    const bi = DAY_ORDER.indexOf(b.day_of_week);
                                                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                                                })
                                                .map((s, i) => (
                                                    <div key={i} className="flex items-center gap-4 px-5 py-3 group/row hover:bg-purple-50/30 transition-colors">
                                                        <div className="w-16 text-[11px] font-black text-purple-600 uppercase tracking-wide flex-shrink-0">
                                                            {s.day_of_week?.slice(0, 3) ?? '—'}
                                                        </div>
                                                        <div className="flex-1 text-sm text-gray-700 font-medium">{s.focus_topic}</div>
                                                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold flex-shrink-0">
                                                            <Clock className="w-3 h-3" />{s.duration_minutes}m
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </section>

                {/* ── Todos ────────────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ListTodo className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-lg font-black text-gray-900">To-Do</h2>
                            {todos.length > 0 && (
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full">
                                    {todos.filter(t => !t.done).length} left
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setShowTodoInput(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                    </div>

                    <AnimatePresence>
                        {showTodoInput && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-3 overflow-hidden"
                            >
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newTodo}
                                        onChange={e => setNewTodo(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddTodo(); if (e.key === 'Escape') setShowTodoInput(false); }}
                                        placeholder="What do you need to do?"
                                        className="flex-1 px-4 py-2.5 bg-white border border-gray-200 focus:border-indigo-300 rounded-xl text-sm outline-none shadow-sm"
                                    />
                                    <button onClick={handleAddTodo} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
                                        Add
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {todos.length === 0 ? (
                        <div className="text-center py-8 bg-white/50 rounded-2xl border border-gray-100">
                            <p className="text-sm text-gray-400">No todos yet. Add one above.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <AnimatePresence initial={false}>
                                {todos.map(todo => (
                                    <motion.div
                                        key={todo.id}
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                        className={`flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border shadow-sm group ${todo.done ? 'border-gray-100 opacity-50' : 'border-gray-200'}`}
                                    >
                                        <button
                                            onClick={() => handleToggleTodo(todo.id)}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${todo.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-indigo-400'}`}
                                        >
                                            {todo.done && <Check className="w-3 h-3 text-white" />}
                                        </button>
                                        <span className={`flex-1 text-sm font-medium ${todo.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                            {todo.text}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteTodo(todo.id)}
                                            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </section>

            </div>

            {/* FAB */}
            {!loading && (
                <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={handleCreateGoal}
                    className="fixed bottom-8 right-8 flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-200 z-20"
                >
                    <Plus className="w-4 h-4" /> New Goal
                </motion.button>
            )}

            <GoalSettingModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingGoal(null); }}
                subjects={subjects}
                initialData={editingGoal}
                onGoalCreated={() => { fetchData(); setShowModal(false); setEditingGoal(null); }}
            />
        </div>
    );
};

export default Goals;
