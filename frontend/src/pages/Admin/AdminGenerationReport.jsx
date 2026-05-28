import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { adminService } from '@/features/admin/services/AdminService';
import {
    Zap, BrainCircuit, BarChart3, Clock, CheckCircle2, XCircle,
    RefreshCw, Star, BookOpen, ClipboardList, CreditCard, GraduationCap, Sliders
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';

// ── Constants ──────────────────────────────────────────────────────────────
const TYPE_COLORS = {
    summary: '#0ea5e9',
    quiz: '#f59e0b',
    flashcards: '#d946ef',
    exam: '#10b981',
};

const TYPE_META = {
    summary:    { icon: BookOpen,      label: 'Summaries',  color: '#0ea5e9', bg: 'bg-sky-50',     text: 'text-sky-600',     border: 'border-sky-100' },
    quiz:       { icon: ClipboardList, label: 'Quizzes',    color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100' },
    flashcards: { icon: CreditCard,    label: 'Flashcards', color: '#d946ef', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-100' },
    exam:       { icon: GraduationCap, label: 'Exams',      color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
};

const DIFFICULTY_COLORS = {
    introductory: '#10b981',
    intermediate: '#f59e0b',
    advanced:     '#ef4444',
    unknown:      '#94a3b8',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const formatTime = (seconds) => {
    if (seconds == null) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};

// ── Sub-components ─────────────────────────────────────────────────────────
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
    if (!rating) return <span className="text-xs font-bold text-gray-300">No ratings</span>;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${(rating / 5) * 100}%`, transition: 'width 1s ease' }}
                />
            </div>
            <span className="text-xs font-black text-gray-700 tabular-nums shrink-0">
                {parseFloat(rating).toFixed(1)}
            </span>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-3 text-xs">
            {dateLabel && (
                <p className="font-black text-gray-400 uppercase tracking-widest mb-2 text-[10px]">{dateLabel}</p>
            )}
            {items.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
                    <span className="font-bold text-gray-500 capitalize">{p.name || p.dataKey}:</span>
                    <span className="font-black text-gray-900">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

const HorizChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-3 text-xs">
            <p className="font-black text-gray-500 capitalize mb-1">{label}</p>
            <span className="font-black text-gray-900">{payload[0]?.value} generations</span>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────
const AdminGenerationReport = () => {
    const [range, setRange]   = useState('30d');
    const [data, setData]     = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const days    = parseInt(range);
            const toDate   = new Date().toISOString().split('T')[0];
            const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            const res = await adminService.getGenerationReport({ from: fromDate, to: toDate });
            if (res.data?.success) setData(res.data.data);
        } catch (err) {
            console.error('Failed to fetch generation analytics', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [range]);

    // Reshape [{date, type, total, completed, failed}] → [{date, summary, quiz, flashcards, exam, failed}]
    const reshapedTrend = useMemo(() => {
        if (!data?.dailyTrend) return [];
        const byDate = {};
        data.dailyTrend.forEach(row => {
            const d = typeof row.date === 'string'
                ? row.date
                : new Date(row.date).toISOString().split('T')[0];
            if (!byDate[d]) byDate[d] = { date: d, summary: 0, quiz: 0, flashcards: 0, exam: 0, failed: 0 };
            byDate[d][row.type] = (byDate[d][row.type] || 0) + row.total;
            byDate[d].failed += row.failed;
        });
        return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    }, [data?.dailyTrend]);

    // Aggregate difficultyByType → [{difficulty, count}] for the bar chart
    const difficultyAggregate = useMemo(() => {
        if (!data?.difficultyByType) return [];
        const agg = {};
        data.difficultyByType.forEach(r => {
            if (!agg[r.difficulty]) agg[r.difficulty] = { difficulty: r.difficulty, count: 0 };
            agg[r.difficulty].count += r.count;
        });
        return Object.values(agg).sort((a, b) => b.count - a.count);
    }, [data?.difficultyByType]);

    // Derived KPIs
    const kpis = useMemo(() => {
        if (!data) return {};
        const { summary, byType } = data;
        const ratedTypes      = byType?.filter(t => t.avg_rating) || [];
        const timedTypes      = byType?.filter(t => t.avg_seconds) || [];
        const effectiveTypes  = byType?.filter(t => t.effectiveness_pct != null) || [];
        return {
            avgRating: ratedTypes.length
                ? (ratedTypes.reduce((s, t) => s + t.avg_rating, 0) / ratedTypes.length).toFixed(1)
                : null,
            avgTime: timedTypes.length
                ? Math.round(timedTypes.reduce((s, t) => s + t.avg_seconds, 0) / timedTypes.length)
                : null,
            avgEffectiveness: effectiveTypes.length
                ? (effectiveTypes.reduce((s, t) => s + t.effectiveness_pct, 0) / effectiveTypes.length).toFixed(1)
                : null,
            failureRate: summary?.total > 0
                ? ((summary.failed / summary.total) * 100).toFixed(1)
                : '0',
        };
    }, [data]);

    if (loading && !data) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50/20">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Aggregating Engine Metrics…</p>
                </div>
            </div>
        );
    }

    const { summary, byType, summaryModes, difficultyByType } = data || {};
    const pieData    = byType?.filter(t => t.total > 0).map(t => ({ name: t.type, value: t.total })) || [];
    const maxLatency = Math.max(1, ...(byType?.map(t => t.max_seconds || 0) || []));

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen space-y-8">

            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter flex items-center gap-4">
                        <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                        Engine Diagnostics
                    </h1>
                    <p className="text-gray-500 font-bold mt-2 ml-16">
                        Generation analytics — volume, speed, quality, and configuration.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white border border-gray-100 p-1 rounded-xl shadow-sm">
                        {['7d', '30d', '90d'].map(r => (
                            <button
                                key={r} onClick={() => setRange(r)}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all
                                    ${range === r ? 'bg-violet-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-3 bg-white text-gray-500 hover:text-violet-600 rounded-xl shadow-sm border border-gray-100 transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── KPIs ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                    {
                        label: 'Total Operations',
                        value: summary?.total?.toLocaleString() ?? '—',
                        sub: `${summary?.completed ?? 0} completed`,
                        icon: Zap, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', orb: 'bg-violet-50',
                        badge: summary?.success_rate != null ? `${summary.success_rate}% success` : null,
                        badgeColor: 'bg-violet-100 text-violet-700',
                    },
                    {
                        label: 'Failure Rate',
                        value: `${kpis.failureRate}%`,
                        sub: `${summary?.failed ?? 0} operations failed`,
                        icon: XCircle, iconBg: 'bg-rose-100', iconColor: 'text-rose-600', orb: 'bg-rose-50',
                        valueColor: parseFloat(kpis.failureRate) > 10 ? 'text-rose-600' : 'text-gray-900',
                    },
                    {
                        label: 'Avg Processing',
                        value: formatTime(kpis.avgTime),
                        sub: 'Weighted across all types',
                        icon: Clock, iconBg: 'bg-sky-100', iconColor: 'text-sky-600', orb: 'bg-sky-50',
                    },
                    {
                        label: 'Avg Rating',
                        value: kpis.avgRating ? `${kpis.avgRating} / 5` : '—',
                        sub: kpis.avgEffectiveness ? `${kpis.avgEffectiveness}% learning effective` : 'No ratings yet',
                        icon: Star, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', orb: 'bg-amber-50',
                    },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <div
                            key={kpi.label}
                            className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 relative overflow-hidden group"
                        >
                            <div className={`absolute -right-6 -top-6 w-24 h-24 ${kpi.orb} rounded-full group-hover:scale-150 transition-transform duration-500`} />
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 ${kpi.iconBg} ${kpi.iconColor} rounded-xl flex items-center justify-center`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-gray-500 uppercase tracking-widest text-[10px]">{kpi.label}</h3>
                                </div>
                                <p className={`text-4xl font-black ${kpi.valueColor || 'text-gray-900'}`}>{kpi.value}</p>
                                <p className="text-sm font-bold text-gray-400 mt-2">{kpi.sub}</p>
                                {kpi.badge && (
                                    <span className={`inline-block mt-3 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${kpi.badgeColor}`}>
                                        {kpi.badge}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Daily Volume Trend + Format Distribution ──────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stacked bar trend */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-violet-500" />
                            Daily Generation Volume
                        </h3>
                        <div className="flex items-center gap-3 flex-wrap">
                            {Object.entries(TYPE_META).map(([key, m]) => (
                                <div key={key} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[key] }} />
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{key}</span>
                                </div>
                            ))}
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase">failed</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={reshapedTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date" axisLine={false} tickLine={false}
                                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                                    tickFormatter={v => { try { return new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return v; } }}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="summary"    stackId="vol" fill={TYPE_COLORS.summary}    name="Summary"    radius={[0,0,0,0]} />
                                <Bar dataKey="quiz"       stackId="vol" fill={TYPE_COLORS.quiz}       name="Quiz"       radius={[0,0,0,0]} />
                                <Bar dataKey="flashcards" stackId="vol" fill={TYPE_COLORS.flashcards} name="Flashcards" radius={[0,0,0,0]} />
                                <Bar dataKey="exam"       stackId="vol" fill={TYPE_COLORS.exam}       name="Exam"       radius={[4,4,0,0]} />
                                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} name="Failed" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut distribution */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 flex flex-col">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 mb-4">
                        <CheckCircle2 className="w-4 h-4 text-fuchsia-500" />
                        Format Share
                    </h3>
                    <div className="flex-1 min-h-[180px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={75}
                                    paddingAngle={4} dataKey="value"
                                    stroke="none" cornerRadius={6}
                                >
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={TYPE_COLORS[entry.name] || '#cbd5e1'} />
                                    ))}
                                </Pie>
                                <Tooltip content={<HorizChartTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <p className="text-3xl font-black text-gray-900">{summary?.total?.toLocaleString() ?? 0}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2.5 mt-2">
                        {pieData.map(entry => {
                            const meta = TYPE_META[entry.name];
                            const pct  = summary?.total > 0 ? ((entry.value / summary.total) * 100).toFixed(0) : 0;
                            return (
                                <div key={entry.name} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[entry.name] }} />
                                    <span className="text-[11px] font-bold text-gray-600 flex-1">{meta?.label || entry.name}</span>
                                    <span className="text-[11px] font-black text-gray-900 tabular-nums">{entry.value}</span>
                                    <span className="text-[10px] font-bold text-gray-400 w-8 text-right tabular-nums">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Per-Type Stat Cards ───────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {['summary', 'quiz', 'flashcards', 'exam'].map((type, idx) => {
                    const meta = TYPE_META[type];
                    const stat = byType?.find(t => t.type === type) || {};
                    const Icon = meta.icon;
                    return (
                        <motion.div
                            key={type}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, duration: 0.4 }}
                            className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xl shadow-gray-200/40"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-10 h-10 ${meta.bg} ${meta.text} rounded-xl flex items-center justify-center`}>
                                    <Icon className="w-4.5 h-4.5" />
                                </div>
                                <CircleGauge value={stat.success_rate || 0} color={meta.color} size={56} />
                            </div>

                            <p className="text-3xl font-black text-gray-900 leading-none mb-1">
                                {(stat.total || 0).toLocaleString()}
                            </p>
                            <p className={`text-xs font-black uppercase tracking-wider ${meta.text} mb-4`}>{meta.label}</p>

                            <div className="space-y-3 pt-3 border-t border-gray-50">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Time</span>
                                    <span className="text-xs font-black text-gray-700 tabular-nums">{formatTime(stat.avg_seconds)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Failed</span>
                                    <span className={`text-xs font-black tabular-nums ${(stat.failed || 0) > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                                        {stat.failed || 0}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Rating</span>
                                    <StarBar rating={stat.avg_rating} />
                                </div>
                                {stat.effectiveness_pct != null && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Effective</span>
                                        <span className="text-xs font-black text-emerald-600">{stat.effectiveness_pct}%</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Latency + Satisfaction ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Latency */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 mb-6">
                        <Clock className="w-4 h-4 text-sky-500" />
                        Processing Latency by Type
                    </h3>
                    <div className="space-y-6">
                        {byType?.filter(t => t.total > 0).map(t => (
                            <div key={t.type}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[t.type] }} />
                                        <span className="text-sm font-black text-gray-800 uppercase tracking-wider">{t.type}</span>
                                    </div>
                                    <span className="text-sm font-black text-gray-900 tabular-nums">
                                        {formatTime(t.avg_seconds)}
                                    </span>
                                </div>
                                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${maxLatency > 0 ? ((t.avg_seconds || 0) / maxLatency) * 100 : 0}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{ background: TYPE_COLORS[t.type] }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1 px-0.5">
                                    <span className="text-[9px] font-bold text-gray-400">min {formatTime(t.min_seconds)}</span>
                                    <span className="text-[9px] font-bold text-gray-400">max {formatTime(t.max_seconds)}</span>
                                </div>
                            </div>
                        ))}
                        {!byType?.some(t => t.total > 0) && (
                            <p className="text-sm font-bold text-gray-300 text-center py-10">No completed generations in this period.</p>
                        )}
                    </div>
                </div>

                {/* Satisfaction per type */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 mb-6">
                        <Star className="w-4 h-4 text-amber-500" />
                        Satisfaction by Type
                    </h3>
                    <div className="space-y-4">
                        {byType?.filter(t => t.total > 0).map(t => {
                            const meta = TYPE_META[t.type];
                            const Icon = meta?.icon;
                            const hasRating = t.total_ratings > 0;
                            return (
                                <div
                                    key={t.type}
                                    className={`p-4 rounded-2xl border ${meta?.border} ${meta?.bg}`}
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        {Icon && <Icon className={`w-3.5 h-3.5 ${meta?.text}`} />}
                                        <span className={`text-xs font-black uppercase tracking-wider ${meta?.text}`}>{t.type}</span>
                                        <span className="ml-auto text-[10px] font-bold text-gray-400 tabular-nums">
                                            {t.total_ratings} {t.total_ratings === 1 ? 'rating' : 'ratings'}
                                        </span>
                                    </div>
                                    {hasRating ? (
                                        <>
                                            <StarBar rating={t.avg_rating} />
                                            {t.effectiveness_pct != null && (
                                                <div className="mt-2.5 flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-white/60 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full"
                                                            style={{ width: `${t.effectiveness_pct}%`, transition: 'width 1s ease' }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black text-emerald-700 tabular-nums shrink-0">
                                                        {t.effectiveness_pct}% effective
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs font-bold text-gray-400">No ratings collected yet.</p>
                                    )}
                                </div>
                            );
                        })}
                        {!byType?.some(t => t.total > 0) && (
                            <p className="text-sm font-bold text-gray-300 text-center py-10">No data in this period.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Generation Modes ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                {/* Summary Tones */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 mb-2">
                        <Sliders className="w-4 h-4 text-violet-500" />
                        Summary Tones
                    </h3>
                    <p className="text-[11px] font-bold text-gray-400 mb-6">
                        Distribution of style modes chosen when generating summaries.
                    </p>
                    {summaryModes && summaryModes.length > 0 ? (
                        <div className="h-[230px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={summaryModes}
                                    layout="vertical"
                                    margin={{ top: 0, right: 35, left: 70, bottom: 0 }}
                                >
                                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                                    <XAxis
                                        type="number" axisLine={false} tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                                    />
                                    <YAxis
                                        type="category" dataKey="mode" axisLine={false} tickLine={false}
                                        tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                                        width={65}
                                    />
                                    <Tooltip content={<HorizChartTooltip />} />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="Generations" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-sm font-bold text-gray-300 text-center py-14">No summary data in this period.</p>
                    )}
                </div>

                {/* Assessment Difficulty */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 mb-2">
                        <Sliders className="w-4 h-4 text-orange-500" />
                        Assessment Difficulty
                    </h3>
                    <p className="text-[11px] font-bold text-gray-400 mb-4">
                        Difficulty levels selected for quizzes, flashcards, and exams.
                    </p>
                    {difficultyAggregate.length > 0 ? (
                        <>
                            <div className="h-[150px] mb-5">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={difficultyAggregate}
                                        layout="vertical"
                                        margin={{ top: 0, right: 35, left: 85, bottom: 0 }}
                                    >
                                        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                                        <XAxis
                                            type="number" axisLine={false} tickLine={false}
                                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                                        />
                                        <YAxis
                                            type="category" dataKey="difficulty" axisLine={false} tickLine={false}
                                            tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                                            width={80}
                                        />
                                        <Tooltip content={<HorizChartTooltip />} />
                                        <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Generations">
                                            {difficultyAggregate.map(entry => (
                                                <Cell key={entry.difficulty} fill={DIFFICULTY_COLORS[entry.difficulty] || '#94a3b8'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Per-type difficulty breakdown */}
                            {difficultyByType && (
                                <div className="border-t border-gray-50 pt-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Breakdown by type</p>
                                    {['quiz', 'flashcards', 'exam'].map(type => {
                                        const rows  = difficultyByType.filter(r => r.type === type);
                                        if (!rows.length) return null;
                                        const total = rows.reduce((s, r) => s + r.count, 0);
                                        return (
                                            <div key={type} className="flex items-center gap-3">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 w-20 shrink-0">
                                                    {type}
                                                </span>
                                                <div className="flex flex-1 rounded-lg overflow-hidden h-5 gap-px">
                                                    {rows.map(r => (
                                                        <div
                                                            key={r.difficulty}
                                                            className="flex items-center justify-center text-[9px] font-black text-white"
                                                            style={{
                                                                background: DIFFICULTY_COLORS[r.difficulty] || '#94a3b8',
                                                                width: `${(r.count / total) * 100}%`,
                                                                minWidth: r.count > 0 ? '16px' : 0,
                                                                transition: 'width 1s ease',
                                                            }}
                                                            title={`${r.difficulty}: ${r.count}`}
                                                        >
                                                            {(r.count / total * 100) >= 14 ? r.count : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 tabular-nums w-5 shrink-0 text-right">
                                                    {total}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {/* Legend */}
                                    <div className="flex items-center gap-4 pt-1 flex-wrap">
                                        {Object.entries(DIFFICULTY_COLORS)
                                            .filter(([k]) => k !== 'unknown')
                                            .map(([diff, color]) => (
                                                <div key={diff} className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                                                    <span className="text-[9px] font-bold text-gray-400 capitalize">{diff}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm font-bold text-gray-300 text-center py-14">No assessment data in this period.</p>
                    )}
                </div>
            </div>

        </div>
    );
};

export default AdminGenerationReport;
