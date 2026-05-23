import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Brain, Target, Activity, Zap, TrendingUp, TrendingDown,
    Minus, Flame, RefreshCw, AlertTriangle, BarChart2, Layers,
    Calendar, BookOpen, X, Search, Check, ChevronRight,
} from 'lucide-react';
import useAnalyticsStore from '@/store/useAnalyticsStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const f = (v) => (v != null ? parseFloat(v) : null);
const pct = (v) => (v != null ? Math.round(parseFloat(v)) : null);
const fmt = (v) => (v != null ? `${Math.round(parseFloat(v))}%` : '—');

function trendIcon(trend7d) {
    const v = f(trend7d) ?? 0;
    if (v > 2)  return <TrendingUp  className="w-3.5 h-3.5 text-emerald-500" />;
    if (v < -2) return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
    return <Minus className="w-3.5 h-3.5 text-amber-400" />;
}

const statusStyle = (crs) => {
    if (crs >= 75) return { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: '#10b981' };
    if (crs >= 50) return { bg: 'bg-blue-100',    text: 'text-blue-700',    bar: '#6366f1' };
    if (crs >= 25) return { bg: 'bg-amber-100',   text: 'text-amber-700',   bar: '#f59e0b' };
    return              { bg: 'bg-rose-100',    text: 'text-rose-700',    bar: '#ef4444' };
};

// ── DonutChart ────────────────────────────────────────────────────────────────

function DonutChart({ segments = [], size = 120, strokeWidth = 14, centerLabel, centerSub }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);

    if (!total) return (
        <svg width={size} height={size}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke="#f3f4f6" strokeWidth={strokeWidth} fill="none" />
        </svg>
    );

    let cumulative = 0;
    const arcs = segments.filter(s => s.value > 0).map(seg => {
        const dash = (seg.value / total) * circ;
        const arc = { ...seg, dash, gap: circ - dash, offset: circ - cumulative };
        cumulative += dash;
        return arc;
    });

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
                <circle cx={size / 2} cy={size / 2} r={r} stroke="#f3f4f6" strokeWidth={strokeWidth} fill="none" />
                {arcs.map((arc, i) => (
                    <circle key={i} cx={size / 2} cy={size / 2} r={r}
                        stroke={arc.color} strokeWidth={strokeWidth} fill="none"
                        strokeDasharray={`${arc.dash} ${arc.gap}`}
                        strokeDashoffset={arc.offset}
                        strokeLinecap="round" />
                ))}
            </svg>
            {centerLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {centerSub != null && <span className="text-xl font-black leading-none" style={{ color: 'var(--c-text)' }}>{centerSub}</span>}
                    <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{centerLabel}</span>
                </div>
            )}
        </div>
    );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function ActivityHeatmap({ data }) {
    if (!data?.length) return null;
    const byDate = new Map(data.map(d => [d.date, d.count]));
    const maxCount = Math.max(...data.map(d => d.count), 1);

    const today = new Date();
    const weeks = 15;
    const cells = [];
    for (let w = weeks - 1; w >= 0; w--) {
        const weekCells = [];
        for (let d = 0; d < 7; d++) {
            const date = new Date(today);
            date.setDate(today.getDate() - (w * 7 + (6 - d)));
            const key = date.toISOString().slice(0, 10);
            const count = byDate.get(key) ?? 0;
            const intensity = count === 0 ? 0 : Math.ceil((count / maxCount) * 4);
            weekCells.push({ key, count, intensity });
        }
        cells.push(weekCells);
    }

    const intensityClass = (i) => {
        switch (i) {
            case 0: return 'bg-gray-100';
            case 1: return 'bg-indigo-200';
            case 2: return 'bg-indigo-400';
            case 3: return 'bg-indigo-600';
            case 4: return 'bg-indigo-800';
            default: return 'bg-gray-100';
        }
    };

    return (
        <div className="flex gap-1">
            {cells.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                    {week.map(({ key, count, intensity }) => (
                        <div
                            key={key}
                            title={`${key}: ${count} interaction${count !== 1 ? 's' : ''}`}
                            className={`w-3 h-3 rounded-sm ${intensityClass(intensity)} cursor-default transition-colors`}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

// ── Subject card ──────────────────────────────────────────────────────────────

function SubjectCard({ subject }) {
    const crs = pct(subject.crs) ?? 0;
    const st  = statusStyle(crs);

    return (
        <Link
            to={`/analytics/subjects/${subject.id}`}
            className="block rounded-2xl p-4 border transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)' }}
        >
            <div className="flex items-start justify-between mb-3 gap-2">
                <span className="font-bold text-sm truncate flex-1" style={{ color: 'var(--c-text)' }}>
                    {subject.name}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${st.bg} ${st.text}`}>
                    {crs}%
                </span>
            </div>

            <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'var(--c-surface-alt)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                     style={{ width: `${crs}%`, background: st.bar }} />
            </div>

            <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                <span className="font-semibold">{subject.concept_count} concept{subject.concept_count !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-1">
                    {trendIcon(subject.trend_7d)}
                    <span>
                        {(f(subject.trend_7d) ?? 0) > 0 ? '+' : ''}
                        {Math.round(f(subject.trend_7d) ?? 0)}pts / 7d
                    </span>
                </div>
            </div>
        </Link>
    );
}

// ── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ insight, onDismiss }) {
    const typeStyle = {
        decay:         { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: Flame,         iconColor: 'text-amber-500' },
        momentum:      { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: TrendingUp,    iconColor: 'text-emerald-500' },
        error_pattern: { bg: 'bg-rose-50',    border: 'border-rose-100',    icon: AlertTriangle, iconColor: 'text-rose-500' },
        forecast:      { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: Target,        iconColor: 'text-blue-500' },
    };
    const s = typeStyle[insight.type] ?? typeStyle.decay;
    const Icon = s.icon;

    return (
        <div className={`rounded-2xl p-4 border flex items-start gap-3 ${s.bg} ${s.border}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.iconColor}`} />
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold mb-0.5" style={{ color: 'var(--c-text)' }}>{insight.title}</div>
                <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{insight.body}</div>
            </div>
            <button
                onClick={() => onDismiss(insight.id)}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-black/10"
                style={{ color: 'var(--c-text-muted)' }}
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, color }) {
    return (
        <div className="rounded-2xl p-4 flex flex-col gap-1"
             style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1"
                 style={{ color }}>
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className="text-3xl font-black tabular-nums" style={{ color: 'var(--c-text)' }}>
                {value ?? '—'}
            </div>
        </div>
    );
}

// ── Main Analytics page ───────────────────────────────────────────────────────

const Analytics = () => {
    const { actions }      = useAnalyticsStore();
    const global           = useAnalyticsStore(s => s.data.global);
    const loading          = useAnalyticsStore(s => s.loading.global);
    const error            = useAnalyticsStore(s => s.errors.global);
    const [refreshing, setRefreshing] = useState(false);
    const [subjectSearch, setSubjectSearch] = useState('');
    const [readinessFilter, setReadinessFilter] = useState('all');

    const load = useCallback(async () => {
        if (global) return;
        await actions.fetchGlobal().catch(() => {});
    }, [global, actions]);

    useEffect(() => { load(); }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await actions.fetchGlobal().catch(() => {});
        setRefreshing(false);
    };

    const handleDismiss = useCallback((id) => {
        actions.dismissInsight(id).catch(() => {});
    }, [actions]);

    const summary          = global?.summary          ?? {};
    const dimensions       = global?.dimensions       ?? {};
    const subjects         = global?.subjects         ?? [];
    const insights         = global?.insights         ?? [];
    const heatmap          = global?.heatmap          ?? [];
    const strongestSubject = global?.strongest_subject ?? null;
    const weakestSubject   = global?.weakest_subject   ?? null;

    const overallReadiness = pct(summary.overall_readiness);

    const filteredSubjects = subjects.filter(s => {
        const nameMatch = !subjectSearch || (s.name ?? '').toLowerCase().includes(subjectSearch.toLowerCase());
        if (!nameMatch) return false;
        if (readinessFilter === 'all') return true;
        const crs = pct(s.crs) ?? 0;
        if (readinessFilter === 'mastered')   return crs >= 75;
        if (readinessFilter === 'developing') return crs >= 50 && crs < 75;
        if (readinessFilter === 'weak')       return crs >= 25 && crs < 50;
        if (readinessFilter === 'critical')   return crs < 25;
        return true;
    });

    const dimensionSegments = [
        { label: 'Understanding', value: pct(dimensions.understanding) ?? 0, color: '#6366f1' },
        { label: 'Retention',     value: pct(dimensions.retention)     ?? 0, color: '#8b5cf6' },
        { label: 'Mastery',       value: pct(dimensions.mastery)       ?? 0, color: '#10b981' },
    ].filter(s => s.value > 0);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'var(--c-canvas)' }}>
            <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-8">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[28px] font-black tracking-tight"
                            style={{ color: 'var(--c-text)', letterSpacing: '-0.02em' }}>
                            Analytics
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                            Your learning overview across all subjects
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-xl border transition-all disabled:opacity-40"
                        style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${(refreshing || loading) ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="p-4 rounded-2xl flex items-center gap-3"
                         style={{ background: 'var(--c-danger-light)', color: 'var(--c-danger)' }}>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {/* ── Loading skeleton ── */}
                {(loading || refreshing) && !global && (
                    <div className="space-y-6 animate-pulse">
                        <div className="grid grid-cols-4 gap-4">
                            {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100" />)}
                        </div>
                        <div className="h-40 rounded-2xl bg-gray-100" />
                        <div className="grid grid-cols-3 gap-4">
                            {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-gray-100" />)}
                        </div>
                    </div>
                )}

                {global && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

                        {/* ── Top stats ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <StatTile icon={BarChart2} label="Overall Readiness"
                                value={overallReadiness != null ? `${overallReadiness}%` : '—'}
                                color="var(--c-primary)" />
                            <StatTile icon={Flame} label="Study Streak"
                                value={summary.study_streak != null ? `${summary.study_streak}d` : '—'}
                                color="var(--c-amber)" />
                            <StatTile icon={Activity} label="Consistency"
                                value={summary.consistency_score != null ? `${Math.round(summary.consistency_score)}%` : '—'}
                                color="var(--c-mint)" />
                            <StatTile icon={Zap} label="Active Days (30d)"
                                value={summary.active_days_30d ?? '—'}
                                color="var(--c-text-muted)" />
                            <StatTile icon={Check} label="Mastered Concepts"
                                value={summary.total_mastered != null ? summary.total_mastered : '—'}
                                color="#10b981" />
                            <StatTile icon={AlertTriangle} label="At Risk"
                                value={summary.total_at_risk != null ? summary.total_at_risk : '—'}
                                color="var(--c-danger)" />
                        </div>

                        {/* ── Dimensions ── */}
                        <div className="rounded-2xl p-6"
                             style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)' }}>
                            <div className="flex items-center gap-2 mb-5">
                                <Brain className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                <span className="text-[12px] font-bold uppercase tracking-wider"
                                      style={{ color: 'var(--c-text-muted)' }}>
                                    Learning Dimensions
                                </span>
                            </div>
                            <div className="flex items-center gap-8">
                                {dimensionSegments.length > 0 && (
                                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                        <DonutChart
                                            segments={dimensionSegments}
                                            size={120} strokeWidth={14}
                                            centerLabel="readiness"
                                            centerSub={overallReadiness != null ? `${overallReadiness}%` : null}
                                        />
                                        <div className="flex gap-2">
                                            {dimensionSegments.map(s => (
                                                <span key={s.label} className="flex items-center gap-1 text-[9px] font-bold" style={{ color: 'var(--c-text-muted)' }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                                                    {s.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex-1 space-y-5">
                                    {[
                                        { label: 'Understanding', value: dimensions.understanding, color: '#6366f1' },
                                        { label: 'Retention',     value: dimensions.retention,     color: '#8b5cf6' },
                                        { label: 'Mastery',       value: dimensions.mastery,       color: '#10b981' },
                                    ].map(({ label, value, color }) => (
                                        <div key={label}>
                                            <div className="flex justify-between text-[12px] font-bold mb-2"
                                                 style={{ color: 'var(--c-text-muted)' }}>
                                                <span>{label}</span>
                                                <span style={{ color }}>{fmt(value)}</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden"
                                                 style={{ background: 'var(--c-surface-alt)' }}>
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{ background: color }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct(value) ?? 0}%` }}
                                                    transition={{ duration: 0.8 }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Activity heatmap ── */}
                        {heatmap.length > 0 && (
                            <div className="rounded-2xl p-6"
                                 style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)' }}>
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                    <span className="text-[12px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--c-text-muted)' }}>
                                        Activity — last 15 weeks
                                    </span>
                                </div>
                                <ActivityHeatmap data={heatmap} />
                            </div>
                        )}

                        {/* ── Focus spotlight ── */}
                        {(strongestSubject || weakestSubject) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { sub: strongestSubject, label: 'Strongest Subject', accent: '#10b981', bg: '#ecfdf5' },
                                    { sub: weakestSubject,   label: 'Needs Most Work',   accent: '#ef4444', bg: '#fef2f2' },
                                ].filter(({ sub }) => sub != null).map(({ sub, label, accent, bg }) => (
                                    <Link
                                        key={sub.id}
                                        to={`/analytics/subjects/${sub.id}`}
                                        className="flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5"
                                        style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)' }}
                                    >
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                             style={{ background: bg }}>
                                            <Target className="w-5 h-5" style={{ color: accent }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
                                                 style={{ color: 'var(--c-text-muted)' }}>{label}</div>
                                            <div className="text-[13px] font-bold truncate" style={{ color: 'var(--c-text)' }}>
                                                {sub.name}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-[13px] font-black tabular-nums" style={{ color: accent }}>
                                                {Math.round(sub.crs)}%
                                            </span>
                                            <ChevronRight className="w-3.5 h-3.5 opacity-40" style={{ color: 'var(--c-text-muted)' }} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {/* ── Insights ── */}
                        {insights.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                    <span className="text-[12px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--c-text-muted)' }}>
                                        Insights
                                    </span>
                                </div>
                                {insights.map(ins => (
                                    <InsightCard key={ins.id} insight={ins} onDismiss={handleDismiss} />
                                ))}
                            </div>
                        )}

                        {/* ── Subjects grid ── */}
                        <div>
                            {/* Portfolio health bar */}
                            {subjects.length > 0 && (() => {
                                const counts = subjects.reduce((acc, s) => {
                                    const key = s.status === 'strong' ? 'strong' : (s.status ?? 'critical');
                                    acc[key] = (acc[key] ?? 0) + 1;
                                    return acc;
                                }, {});
                                const total = subjects.length;
                                const segments = [
                                    { key: 'strong',     label: 'Strong',      color: '#10b981' },
                                    { key: 'developing', label: 'Developing',  color: '#6366f1' },
                                    { key: 'weak',       label: 'Weak',        color: '#f59e0b' },
                                    { key: 'critical',   label: 'Critical',    color: '#ef4444' },
                                ].filter(s => counts[s.key] > 0);
                                return (
                                    <div className="mb-4 p-4 rounded-2xl"
                                         style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                        <div className="flex h-2.5 rounded-full overflow-hidden mb-2.5 gap-px">
                                            {segments.map(s => (
                                                <div key={s.key}
                                                     title={`${s.label}: ${counts[s.key]}`}
                                                     style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color, minWidth: 4 }} />
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-4 flex-wrap">
                                            {segments.map(s => (
                                                <button key={s.key} onClick={() => setReadinessFilter(s.key === 'strong' ? 'mastered' : s.key)}
                                                        className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                                    <span className="text-[11px] font-bold" style={{ color: 'var(--c-text-muted)' }}>
                                                        {s.label}
                                                    </span>
                                                    <span className="text-[11px] font-black tabular-nums" style={{ color: 'var(--c-text)' }}>
                                                        {counts[s.key]}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                    <span className="text-[12px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--c-text-muted)' }}>
                                        Subjects ({filteredSubjects.length}{filteredSubjects.length !== subjects.length ? `/${subjects.length}` : ''})
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--c-text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Search subjects…"
                                            value={subjectSearch}
                                            onChange={e => setSubjectSearch(e.target.value)}
                                            className="pl-7 pr-3 py-1.5 text-xs rounded-xl border outline-none focus:border-indigo-300 transition-colors"
                                            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-surface)', color: 'var(--c-text)', width: 160 }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {['all', 'mastered', 'developing', 'weak', 'critical'].map(f => (
                                            <button key={f} onClick={() => setReadinessFilter(f)}
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize transition-all ${
                                                    readinessFilter === f ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
                                                }`}>{f}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {subjects.length === 0 ? (
                                <div className="rounded-2xl py-16 text-center"
                                     style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                    <BarChart2 className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--c-text-muted)' }} />
                                    <p className="text-sm font-semibold" style={{ color: 'var(--c-text-muted)' }}>
                                        No subjects yet. Upload study material to get started.
                                    </p>
                                </div>
                            ) : filteredSubjects.length === 0 ? (
                                <div className="rounded-2xl py-12 text-center"
                                     style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--c-text-muted)' }}>
                                        No subjects match your filters.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredSubjects.map(sub => (
                                        <SubjectCard key={sub.id} subject={sub} />
                                    ))}
                                </div>
                            )}
                        </div>

                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Analytics;
