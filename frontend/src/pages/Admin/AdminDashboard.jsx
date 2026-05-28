import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { motion } from 'framer-motion';
import {
    Users, Activity, Target, TrendingUp, Smile,
    Download, ChevronRight, X, AlertTriangle, ArrowUpRight, ArrowDownRight,
    MessageSquare, ThumbsUp, ThumbsDown, Zap, Brain,
    BrainCircuit, BarChart3, Clock, CheckCircle2, XCircle,
    RefreshCw, Star, BookOpen, ClipboardList, CreditCard, GraduationCap, Sliders, Sparkles
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import Skeleton from '@/components/ui/Skeleton';
import ActivityStream from '@/components/Admin/ActivityStream';

// ── App color palette ───────────────────────────────────────────────────────
// Primary:   indigo-600  #4f46e5   brand, nav, main actions
// Accent:    violet-600  #7c3aed   AI / engine features
// Success:   emerald-500 #10b981
// Warning:   amber-500   #f59e0b
// Danger:    rose-500    #f43f5e
// Info:      sky-500     #0ea5e9
// Users:     fuchsia-500 #d946ef

const TYPE_COLORS = {
    summary:    '#0ea5e9',   // sky-500
    quiz:       '#f59e0b',   // amber-500
    flashcards: '#8b5cf6',   // violet-500
    exam:       '#10b981',   // emerald-500
};

const TYPE_META = {
    summary:    { icon: BookOpen,      label: 'Summaries',  color: '#0ea5e9', bg: 'bg-sky-50',    text: 'text-sky-600',    border: 'border-sky-100'    },
    quiz:       { icon: ClipboardList, label: 'Quizzes',    color: '#f59e0b', bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-100'  },
    flashcards: { icon: CreditCard,    label: 'Flashcards', color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
    exam:       { icon: GraduationCap, label: 'Exams',      color: '#10b981', bg: 'bg-emerald-50',text: 'text-emerald-600',border: 'border-emerald-100'},
};

const DIFFICULTY_COLORS = {
    introductory: '#10b981',
    intermediate: '#f59e0b',
    advanced:     '#ef4444',
    unknown:      '#94a3b8',
};

const formatTime = (seconds) => {
    if (seconds == null) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};

// ── Palette for KPI cards ───────────────────────────────────────────────────
const PALETTE = {
    fuchsia: { strip: 'bg-fuchsia-500', icon: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100', tag: 'text-fuchsia-500' },
    indigo:  { strip: 'bg-indigo-500',  icon: 'bg-indigo-50 text-indigo-600 border-indigo-100',    tag: 'text-indigo-500'  },
    emerald: { strip: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600 border-emerald-100', tag: 'text-emerald-500' },
    amber:   { strip: 'bg-amber-500',   icon: 'bg-amber-50 text-amber-600 border-amber-100',       tag: 'text-amber-500'   },
    violet:  { strip: 'bg-violet-500',  icon: 'bg-violet-50 text-violet-600 border-violet-100',    tag: 'text-violet-500'  },
    sky:     { strip: 'bg-sky-500',     icon: 'bg-sky-50 text-sky-600 border-sky-100',             tag: 'text-sky-500'     },
    rose:    { strip: 'bg-rose-500',    icon: 'bg-rose-50 text-rose-600 border-rose-100',          tag: 'text-rose-500'    },
};

// ── Shared sub-components ───────────────────────────────────────────────────
const CircleGauge = ({ value = 0, color = '#8b5cf6', size = 56 }) => {
    const r = size / 2 - 7;
    const circ = 2 * Math.PI * r;
    const dash = Math.min(Math.max(value, 0), 100) / 100 * circ;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dasharray 1s ease' }}
            />
            <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#1e293b">
                {Math.round(value)}%
            </text>
        </svg>
    );
};

const StarBar = ({ rating }) => {
    if (!rating) return <span className="text-xs font-semibold text-slate-300">No ratings yet</span>;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(rating / 5) * 100}%`, transition: 'width 1s ease' }} />
            </div>
            <span className="text-xs font-black text-slate-700 tabular-nums shrink-0">{parseFloat(rating).toFixed(1)}</span>
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
        </div>
    );
};

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const items = payload.filter(p => p.value > 0);
    if (!items.length) return null;
    const dateLabel = label
        ? (() => { try { return new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return label; } })()
        : '';
    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xl p-3 text-xs">
            {dateLabel && <p className="font-black text-slate-400 uppercase tracking-widest mb-2 text-[10px]">{dateLabel}</p>}
            {items.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
                    <span className="font-bold text-slate-500 capitalize">{p.name || p.dataKey}:</span>
                    <span className="font-black text-slate-900">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

const HorizChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xl p-3 text-xs">
            <p className="font-black text-slate-500 capitalize mb-1">{label}</p>
            <span className="font-black text-slate-900">{payload[0]?.value} generations</span>
        </div>
    );
};

// ── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color, loading, onClick }) => {
    const c = PALETTE[color] || PALETTE.indigo;
    return (
        <motion.div
            whileHover={{ y: -3 }}
            whileTap={onClick ? { scale: 0.98 } : {}}
            onClick={onClick}
            className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group ${onClick ? 'cursor-pointer' : ''} transition-all`}
        >
            <div className={`h-[3px] ${c.strip}`} />
            <div className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.icon}`}>
                        {icon}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${c.tag}`}>{label}</span>
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-1.5">
                    {loading ? <Skeleton className="w-16 h-9" /> : value}
                </div>
                <p className="text-[11px] text-slate-400 font-semibold">{sub}</p>
            </div>
        </motion.div>
    );
};

// ── Drill-down modal ────────────────────────────────────────────────────────
const DrillDownModal = ({ isOpen, onClose, title, data, loading }) => {
    if (!isOpen) return null;
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-100"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-none">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Metric Drill-down</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
                    ) : data.length > 0 ? (
                        <div className="space-y-2">
                            {data.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors group">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">{item.title || item.name || item.email}</span>
                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                                            {item.type || item.status || (item.created_at ? new Date(item.created_at).toLocaleDateString() : '')}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center opacity-40">
                            <Activity className="w-10 h-10 mx-auto mb-3" />
                            <p className="text-sm font-bold uppercase tracking-widest">No detailed data found</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

// ── Section header card ─────────────────────────────────────────────────────
const SectionBanner = ({ icon: Icon, title, subtitle, badge }) => (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 px-7 py-5">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-20 h-20 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 shrink-0">
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black text-white tracking-tight">{title}</h2>
                <p className="text-[11px] font-semibold text-indigo-200 uppercase tracking-widest">{subtitle}</p>
            </div>
            {badge && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full border border-white/20 shrink-0">
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/80">{badge}</span>
                </div>
            )}
        </div>
    </div>
);

// ── Card title helper ───────────────────────────────────────────────────────
const CardTitle = ({ icon: Icon, iconColor, title, right }) => (
    <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconColor}`} />
            {title}
        </h3>
        {right}
    </div>
);

// ── Main Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const [loading, setLoading]           = useState(true);
    const [totalUsers, setTotalUsers]     = useState(0);
    const [engagement, setEngagement]     = useState(null);
    const [genData, setGenData]           = useState(null);
    const [range, setRange]               = useState('30d');
    const [drillingDown, setDrillingDown] = useState(null);
    const [drillData, setDrillData]       = useState([]);
    const [drillLoading, setDrillLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const days     = parseInt(range);
            const toDate   = new Date().toISOString().split('T')[0];
            const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

            const [usersRes, analyticsRes, genRes] = await Promise.all([
                adminService.getUsers(),
                adminService.getAnalytics({ from: fromDate, to: toDate }),
                adminService.getGenerationReport({ from: fromDate, to: toDate }),
            ]);
            setTotalUsers((usersRes.data?.data || []).length);
            setEngagement(analyticsRes.data?.data || {});
            if (genRes.data?.success) setGenData(genRes.data.data);
        } catch (err) {
            console.error('Dashboard fetch error', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [range]);

    const reshapedTrend = useMemo(() => {
        if (!genData?.dailyTrend) return [];
        const byDate = {};
        genData.dailyTrend.forEach(row => {
            const d = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
            if (!byDate[d]) byDate[d] = { date: d, summary: 0, quiz: 0, flashcards: 0, exam: 0, failed: 0 };
            byDate[d][row.type] = (byDate[d][row.type] || 0) + row.total;
            byDate[d].failed   += row.failed;
        });
        return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    }, [genData?.dailyTrend]);

    const difficultyAggregate = useMemo(() => {
        if (!genData?.difficultyByType) return [];
        const agg = {};
        genData.difficultyByType.forEach(r => {
            if (!agg[r.difficulty]) agg[r.difficulty] = { difficulty: r.difficulty, count: 0 };
            agg[r.difficulty].count += r.count;
        });
        return Object.values(agg).sort((a, b) => b.count - a.count);
    }, [genData?.difficultyByType]);

    const genKpis = useMemo(() => {
        if (!genData) return {};
        const { summary, byType } = genData;
        const ratedTypes     = byType?.filter(t => t.avg_rating) || [];
        const timedTypes     = byType?.filter(t => t.avg_seconds) || [];
        const effectiveTypes = byType?.filter(t => t.effectiveness_pct != null) || [];
        return {
            avgRating: ratedTypes.length
                ? (ratedTypes.reduce((s, t) => s + t.avg_rating, 0) / ratedTypes.length).toFixed(1) : null,
            avgTime: timedTypes.length
                ? Math.round(timedTypes.reduce((s, t) => s + t.avg_seconds, 0) / timedTypes.length) : null,
            avgEffectiveness: effectiveTypes.length
                ? (effectiveTypes.reduce((s, t) => s + t.effectiveness_pct, 0) / effectiveTypes.length).toFixed(1) : null,
            failureRate: summary?.total > 0 ? ((summary.failed / summary.total) * 100).toFixed(1) : '0',
        };
    }, [genData]);

    const dau         = engagement?.dau || [];
    const activeToday = dau.slice(-1)[0]?.count ?? 0;
    const maxDau      = Math.max(...dau.map(d => d.count), 1);
    const studyAct    = engagement?.studyActivity || [];
    const quizTotal   = studyAct.filter(d => d.type === 'quiz').reduce((s, d) => s + d.count, 0);
    const flashTotal  = studyAct.filter(d => d.type === 'flashcard').reduce((s, d) => s + d.count, 0);
    const todayKey    = new Date().toISOString().split('T')[0];
    const quizToday   = studyAct.filter(d => d.type === 'quiz'      && String(d.date).startsWith(todayKey)).reduce((s, d) => s + d.count, 0);
    const flashToday  = studyAct.filter(d => d.type === 'flashcard' && String(d.date).startsWith(todayKey)).reduce((s, d) => s + d.count, 0);

    const chatActivity        = engagement?.chatActivity || {};
    const chatTotalSessions   = chatActivity.totalSessions || 0;
    const chatThumbsUp        = chatActivity.thumbsUp || 0;
    const chatThumbsDown      = chatActivity.thumbsDown || 0;
    const chatTotalRated      = chatActivity.totalRated || 0;
    const chatSatisfactionPct = chatActivity.satisfactionPct;

    const handleDrillDown = async (metric, type, title) => {
        setDrillingDown(title);
        setDrillLoading(true);
        try {
            const days     = parseInt(range);
            const toDate   = new Date().toISOString().split('T')[0];
            const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            const res = await adminService.getDrillDown({ metric, type, from: fromDate, to: toDate });
            setDrillData(res.data?.data || []);
        } catch (err) {
            console.error('Drill-down error', err);
        } finally {
            setDrillLoading(false);
        }
    };

    const handleExport = () => adminService.exportAnalytics({ source: 'dau' });

    const { summary: genSummary, byType, summaryModes, difficultyByType } = genData || {};
    const pieData    = byType?.filter(t => t.total > 0).map(t => ({ name: t.type, value: t.total })) || [];
    const maxLatency = Math.max(1, ...(byType?.map(t => t.max_seconds || 0) || []));

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 pb-16">

            {/* ── Hero Header ────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-8 text-white">
                {/* dot-grid overlay */}
                <div className="absolute inset-0 opacity-[0.07]"
                     style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="absolute -right-14 -top-14 w-52 h-52 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute right-28 -bottom-6 w-28 h-28 bg-violet-400/25 rounded-full blur-2xl pointer-events-none" />

                <div className="relative flex items-center justify-between gap-6 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Mission Control</span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white mb-1.5">Admin Dashboard</h1>
                        <p className="text-sm font-medium text-indigo-200">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/20 p-1 rounded-xl">
                            {['7d', '30d', '90d'].map(r => (
                                <button
                                    key={r} onClick={() => setRange(r)}
                                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all
                                        ${range === r ? 'bg-white text-indigo-600 shadow-md' : 'text-white/60 hover:text-white'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={fetchData}
                            className="p-2.5 bg-white/10 backdrop-blur-sm text-white/70 hover:text-white border border-white/20 rounded-xl transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-all active:scale-95"
                        >
                            <Download className="w-3.5 h-3.5 text-white/70" />
                            <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Export CSV</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Anomaly Alert ───────────────────────────────────────────── */}
            {engagement?.anomaly && (
                <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border ${engagement.anomaly.severity === 'high' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${engagement.anomaly.severity === 'high' ? 'bg-rose-100 text-rose-500' : 'bg-amber-100 text-amber-500'}`}>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${engagement.anomaly.severity === 'high' ? 'text-rose-500' : 'text-amber-500'}`}>Anomaly Detected</p>
                            <p className="text-xs font-semibold text-slate-700">{engagement.anomaly.message}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/60 border border-white/80 rounded-full">
                        {engagement.anomaly.delta < 0 ? <ArrowDownRight className="w-3 h-3 text-rose-500" /> : <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                        <span className={`text-[10px] font-black ${engagement.anomaly.delta < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{engagement.anomaly.delta}%</span>
                    </div>
                </motion.div>
            )}

            {/* ── User Engagement label ──────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">User Engagement</span>
                </div>
                <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon={<Users className="w-4 h-4" />}
                    label="Total Learners"
                    value={totalUsers}
                    sub="Registered students"
                    color="fuchsia" loading={loading}
                />
                <KpiCard
                    icon={<Activity className="w-4 h-4" />}
                    label="Active Today"
                    value={activeToday}
                    sub="Unique users today"
                    color="indigo" loading={loading}
                    onClick={() => handleDrillDown('active_users', null, 'Active Users History')}
                />
                <KpiCard
                    icon={<Brain className="w-4 h-4" />}
                    label="Study Sessions"
                    value={quizToday + flashToday}
                    sub="Quizzes & flashcards today"
                    color="emerald" loading={loading}
                />
                <KpiCard
                    icon={<Smile className="w-4 h-4" />}
                    label="Chat Satisfaction"
                    value={chatSatisfactionPct != null ? `${chatSatisfactionPct}%` : '—'}
                    sub={chatTotalRated > 0 ? `Based on ${chatTotalRated} ratings` : 'No feedback yet'}
                    color="amber" loading={loading}
                />
            </div>

            {/* ── Engagement Panel ────────────────────────────────────────── */}
            <div className="grid grid-cols-12 gap-5">
                {/* DAU Chart */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-50 to-white px-6 pt-5 pb-4 border-b border-slate-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-black text-slate-800 tracking-tight">{range} Engagement</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Daily active learners</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 rounded-full">
                                <TrendingUp className="w-3 h-3 text-indigo-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Trend</span>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-3">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">{activeToday}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">active today</span>
                        </div>
                    </div>
                    <div className="flex items-end gap-[3px] px-6 pb-6 pt-5" style={{ height: '188px' }}>
                        {dau.map((d, i) => (
                            <div key={i} className="flex-1 h-full flex items-end group/bar">
                                <div
                                    className="w-full rounded-t-md bg-gradient-to-t from-indigo-400 to-indigo-200 group-hover/bar:from-indigo-600 group-hover/bar:to-indigo-400 transition-all duration-200 relative cursor-default"
                                    style={{ height: `${Math.max(4, (d.count / maxDau) * 100)}%` }}
                                >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                        {d.count}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                    {/* Performance Activity */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <p className="text-sm font-black text-slate-800 tracking-tight mb-0.5">Activity Breakdown</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">{range} study & chat sessions</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Target className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Quizzes</span>
                                </div>
                                <span className="text-2xl font-black text-slate-900 tracking-tighter">
                                    {loading ? <Skeleton className="w-10 h-6" /> : quizTotal}
                                </span>
                            </div>
                            <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Zap className="w-3 h-3 text-indigo-500" />
                                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Flashcards</span>
                                </div>
                                <span className="text-2xl font-black text-slate-900 tracking-tighter">
                                    {loading ? <Skeleton className="w-10 h-6" /> : flashTotal}
                                </span>
                            </div>
                        </div>
                        <div className="mt-3 bg-violet-50 rounded-xl p-3 border border-violet-100 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <MessageSquare className="w-3 h-3 text-violet-500" />
                                    <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest">Chat Sessions</span>
                                </div>
                                <span className="text-2xl font-black text-slate-900 tracking-tighter">
                                    {loading ? <Skeleton className="w-10 h-6" /> : chatTotalSessions}
                                </span>
                            </div>
                            {chatTotalRated > 0 && (
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <ThumbsUp className="w-3 h-3 text-emerald-500" />
                                        <span className="text-[11px] font-black text-emerald-600">{chatThumbsUp}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <ThumbsDown className="w-3 h-3 text-rose-400" />
                                        <span className="text-[11px] font-black text-rose-500">{chatThumbsDown}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Live Pulse */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col flex-1 min-h-[170px]">
                        <div className="flex items-center justify-between flex-none mb-3">
                            <div>
                                <p className="text-sm font-black text-slate-800 tracking-tight">Live Pulse</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Student activity stream</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ActivityStream limit={4} compact={true} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Engine Diagnostics Banner ───────────────────────────────── */}
            <SectionBanner
                icon={BrainCircuit}
                title="Engine Diagnostics"
                subtitle="AI generation analytics — volume, speed, quality & configuration"
                badge="AI Processing Engine"
            />

            {/* ── Engine KPIs ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Operations',
                        value: genSummary?.total?.toLocaleString() ?? '—',
                        sub: `${genSummary?.completed ?? 0} completed`,
                        icon: Zap,
                        strip: 'bg-violet-500',
                        iconCls: 'bg-violet-50 text-violet-600 border-violet-100',
                        tag: 'text-violet-500',
                        badge: genSummary?.success_rate != null ? `${genSummary.success_rate}% success` : null,
                        badgeCls: 'bg-violet-50 text-violet-600 border border-violet-100',
                    },
                    {
                        label: 'Failure Rate',
                        value: `${genKpis.failureRate ?? '0'}%`,
                        sub: `${genSummary?.failed ?? 0} failed operations`,
                        icon: XCircle,
                        strip: 'bg-rose-500',
                        iconCls: 'bg-rose-50 text-rose-500 border-rose-100',
                        tag: 'text-rose-500',
                        valueColor: parseFloat(genKpis.failureRate) > 10 ? 'text-rose-600' : 'text-slate-900',
                    },
                    {
                        label: 'Avg Processing',
                        value: formatTime(genKpis.avgTime),
                        sub: 'Weighted across all types',
                        icon: Clock,
                        strip: 'bg-sky-500',
                        iconCls: 'bg-sky-50 text-sky-600 border-sky-100',
                        tag: 'text-sky-500',
                    },
                    {
                        label: 'Avg Rating',
                        value: genKpis.avgRating ? `${genKpis.avgRating} / 5` : '—',
                        sub: genKpis.avgEffectiveness ? `${genKpis.avgEffectiveness}% effective` : 'No ratings yet',
                        icon: Star,
                        strip: 'bg-amber-500',
                        iconCls: 'bg-amber-50 text-amber-600 border-amber-100',
                        tag: 'text-amber-500',
                    },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <div key={kpi.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:-translate-y-0.5 transition-all">
                            <div className={`h-[3px] ${kpi.strip}`} />
                            <div className="p-5">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${kpi.iconCls}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${kpi.tag}`}>{kpi.label}</span>
                                </div>
                                <p className={`text-4xl font-black tracking-tighter leading-none mb-1.5 ${kpi.valueColor || 'text-slate-900'}`}>
                                    {loading ? <Skeleton className="w-20 h-10" /> : kpi.value}
                                </p>
                                <p className="text-[11px] font-semibold text-slate-400">{kpi.sub}</p>
                                {kpi.badge && (
                                    <span className={`inline-block mt-3 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${kpi.badgeCls}`}>
                                        {kpi.badge}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Daily Volume Trend + Format Distribution ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <CardTitle
                        icon={BarChart3} iconColor="text-violet-500"
                        title="Daily Generation Volume"
                        right={
                            <div className="flex items-center gap-3 flex-wrap">
                                {Object.entries(TYPE_META).map(([key]) => (
                                    <div key={key} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[key] }} />
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase">{key}</span>
                                    </div>
                                ))}
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">failed</span>
                                </div>
                            </div>
                        }
                    />
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={reshapedTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={v => { try { return new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return v; } }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="summary"    stackId="vol" fill={TYPE_COLORS.summary}    name="Summary"    radius={[0,0,0,0]} />
                                <Bar dataKey="quiz"       stackId="vol" fill={TYPE_COLORS.quiz}       name="Quiz"       radius={[0,0,0,0]} />
                                <Bar dataKey="flashcards" stackId="vol" fill={TYPE_COLORS.flashcards} name="Flashcards" radius={[0,0,0,0]} />
                                <Bar dataKey="exam"       stackId="vol" fill={TYPE_COLORS.exam}       name="Exam"       radius={[4,4,0,0]} />
                                <Line type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={2} dot={false} name="Failed" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
                    <CardTitle icon={CheckCircle2} iconColor="text-fuchsia-500" title="Format Share" />
                    <div className="flex-1 min-h-[180px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none" cornerRadius={6}>
                                    {pieData.map((entry, i) => <Cell key={i} fill={TYPE_COLORS[entry.name] || '#cbd5e1'} />)}
                                </Pie>
                                <Tooltip content={<HorizChartTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <p className="text-3xl font-black text-slate-900">{genSummary?.total?.toLocaleString() ?? 0}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2.5 mt-2">
                        {pieData.map(entry => {
                            const meta = TYPE_META[entry.name];
                            const pct  = genSummary?.total > 0 ? ((entry.value / genSummary.total) * 100).toFixed(0) : 0;
                            return (
                                <div key={entry.name} className="flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[entry.name] }} />
                                    <span className="text-[11px] font-semibold text-slate-600 flex-1">{meta?.label || entry.name}</span>
                                    <span className="text-[11px] font-black text-slate-900 tabular-nums">{entry.value}</span>
                                    <span className="text-[10px] font-semibold text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Per-Type Stat Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {['summary', 'quiz', 'flashcards', 'exam'].map((type, idx) => {
                    const meta = TYPE_META[type];
                    const stat = byType?.find(t => t.type === type) || {};
                    const Icon = meta.icon;
                    return (
                        <motion.div
                            key={type}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, duration: 0.35 }}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                        >
                            <div className="h-[3px]" style={{ background: meta.color }} />
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`w-10 h-10 ${meta.bg} ${meta.text} rounded-xl flex items-center justify-center`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <CircleGauge value={stat.success_rate || 0} color={meta.color} size={52} />
                                </div>
                                <p className="text-3xl font-black text-slate-900 leading-none mb-1">{(stat.total || 0).toLocaleString()}</p>
                                <p className={`text-[10px] font-black uppercase tracking-wider ${meta.text} mb-4`}>{meta.label}</p>
                                <div className="space-y-2.5 pt-3 border-t border-slate-50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Time</span>
                                        <span className="text-xs font-black text-slate-700 tabular-nums">{formatTime(stat.avg_seconds)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Failed</span>
                                        <span className={`text-xs font-black tabular-nums ${(stat.failed || 0) > 0 ? 'text-rose-500' : 'text-slate-200'}`}>{stat.failed || 0}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Rating</span>
                                        <StarBar rating={stat.avg_rating} />
                                    </div>
                                    {stat.effectiveness_pct != null && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Effective</span>
                                            <span className="text-xs font-black text-emerald-600">{stat.effectiveness_pct}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Latency + Satisfaction ───────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <CardTitle icon={Clock} iconColor="text-sky-500" title="Processing Latency by Type" />
                    <div className="space-y-5">
                        {byType?.filter(t => t.total > 0).map(t => (
                            <div key={t.type}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[t.type] }} />
                                        <span className="text-sm font-black text-slate-700 uppercase tracking-wider">{t.type}</span>
                                    </div>
                                    <span className="text-sm font-black text-slate-900 tabular-nums">{formatTime(t.avg_seconds)}</span>
                                </div>
                                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${maxLatency > 0 ? ((t.avg_seconds || 0) / maxLatency) * 100 : 0}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{ background: TYPE_COLORS[t.type] }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1 px-0.5">
                                    <span className="text-[9px] font-semibold text-slate-400">min {formatTime(t.min_seconds)}</span>
                                    <span className="text-[9px] font-semibold text-slate-400">max {formatTime(t.max_seconds)}</span>
                                </div>
                            </div>
                        ))}
                        {!byType?.some(t => t.total > 0) && (
                            <p className="text-sm font-semibold text-slate-300 text-center py-10">No completed generations in this period.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <CardTitle icon={Star} iconColor="text-amber-500" title="Satisfaction by Type" />
                    <div className="space-y-3">
                        {byType?.filter(t => t.total > 0).map(t => {
                            const meta = TYPE_META[t.type];
                            const Icon = meta?.icon;
                            return (
                                <div key={t.type} className={`p-4 rounded-xl border ${meta?.border} ${meta?.bg}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        {Icon && <Icon className={`w-3.5 h-3.5 ${meta?.text}`} />}
                                        <span className={`text-xs font-black uppercase tracking-wider ${meta?.text}`}>{t.type}</span>
                                        <span className="ml-auto text-[10px] font-semibold text-slate-400 tabular-nums">{t.total_ratings} {t.total_ratings === 1 ? 'rating' : 'ratings'}</span>
                                    </div>
                                    {t.total_ratings > 0 ? (
                                        <>
                                            <StarBar rating={t.avg_rating} />
                                            {t.effectiveness_pct != null && (
                                                <div className="mt-2.5 flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-white/60 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${t.effectiveness_pct}%`, transition: 'width 1s ease' }} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-emerald-700 tabular-nums shrink-0">{t.effectiveness_pct}% effective</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs font-semibold text-slate-400">No ratings collected yet.</p>
                                    )}
                                </div>
                            );
                        })}
                        {!byType?.some(t => t.total > 0) && (
                            <p className="text-sm font-semibold text-slate-300 text-center py-10">No data in this period.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Generation Modes ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <CardTitle icon={Sliders} iconColor="text-violet-500" title="Summary Tones" />
                    <p className="text-[11px] font-semibold text-slate-400 mb-5 -mt-2">Style modes chosen when generating summaries.</p>
                    {summaryModes && summaryModes.length > 0 ? (
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={summaryModes} layout="vertical" margin={{ top: 0, right: 35, left: 70, bottom: 0 }}>
                                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                    <YAxis type="category" dataKey="mode" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} width={65} />
                                    <Tooltip content={<HorizChartTooltip />} />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="Generations" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-sm font-semibold text-slate-300 text-center py-14">No summary data in this period.</p>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <CardTitle icon={Sliders} iconColor="text-amber-500" title="Assessment Difficulty" />
                    <p className="text-[11px] font-semibold text-slate-400 mb-4 -mt-2">Difficulty levels for quizzes, flashcards, and exams.</p>
                    {difficultyAggregate.length > 0 ? (
                        <>
                            <div className="h-[140px] mb-5">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={difficultyAggregate} layout="vertical" margin={{ top: 0, right: 35, left: 85, bottom: 0 }}>
                                        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                        <YAxis type="category" dataKey="difficulty" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} width={80} />
                                        <Tooltip content={<HorizChartTooltip />} />
                                        <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Generations">
                                            {difficultyAggregate.map(entry => <Cell key={entry.difficulty} fill={DIFFICULTY_COLORS[entry.difficulty] || '#94a3b8'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            {difficultyByType && (
                                <div className="border-t border-slate-50 pt-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Breakdown by type</p>
                                    {['quiz', 'flashcards', 'exam'].map(type => {
                                        const rows  = difficultyByType.filter(r => r.type === type);
                                        if (!rows.length) return null;
                                        const total = rows.reduce((s, r) => s + r.count, 0);
                                        return (
                                            <div key={type} className="flex items-center gap-3">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 w-20 shrink-0">{type}</span>
                                                <div className="flex flex-1 rounded-lg overflow-hidden h-5 gap-px">
                                                    {rows.map(r => (
                                                        <div
                                                            key={r.difficulty}
                                                            className="flex items-center justify-center text-[9px] font-black text-white"
                                                            style={{ background: DIFFICULTY_COLORS[r.difficulty] || '#94a3b8', width: `${(r.count / total) * 100}%`, minWidth: r.count > 0 ? '16px' : 0, transition: 'width 1s ease' }}
                                                            title={`${r.difficulty}: ${r.count}`}
                                                        >
                                                            {(r.count / total * 100) >= 14 ? r.count : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 tabular-nums w-5 shrink-0 text-right">{total}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex items-center gap-4 pt-1 flex-wrap">
                                        {Object.entries(DIFFICULTY_COLORS).filter(([k]) => k !== 'unknown').map(([diff, color]) => (
                                            <div key={diff} className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                                                <span className="text-[9px] font-semibold text-slate-400 capitalize">{diff}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm font-semibold text-slate-300 text-center py-14">No assessment data in this period.</p>
                    )}
                </div>
            </div>

            <DrillDownModal isOpen={!!drillingDown} onClose={() => setDrillingDown(null)} title={drillingDown} data={drillData} loading={drillLoading} />
        </div>
    );
};

export default AdminDashboard;
