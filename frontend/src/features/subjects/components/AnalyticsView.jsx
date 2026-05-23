import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, Zap, TrendingUp, TrendingDown, Minus,
    RefreshCw, AlertTriangle, ChevronRight, BarChart2, Layers,
    Clock, Target, Flame, Check, X, Filter,
} from 'lucide-react';
import useAnalyticsStore from '@/store/useAnalyticsStore';
import AnalyticsService from '@/services/AnalyticsService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(v) { return v == null ? null : Math.round(parseFloat(v)); }
function fmt(v) { return v == null ? '—' : `${Math.round(parseFloat(v))}%`; }

function trendIcon(label) {
    if (label === 'improving') return <TrendingUp  className="w-3.5 h-3.5 text-emerald-500" />;
    if (label === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
    return <Minus className="w-3.5 h-3.5 text-amber-400" />;
}

function stateColor(state) {
    switch (state) {
        case 'mastered':   return { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', hex: '#10b981' };
        case 'developing': return { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    hex: '#6366f1' };
        case 'weak':       return { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   hex: '#f59e0b' };
        case 'critical':   return { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    hex: '#ef4444' };
        default:           return { bg: 'bg-gray-100',    text: 'text-gray-500',    dot: 'bg-gray-400',    hex: '#9ca3af' };
    }
}

function fromDate(range) {
    if (range === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90));
    return d.toISOString().slice(0, 10);
}

// ── DonutChart ────────────────────────────────────────────────────────────────

function DonutChart({ segments = [], size = 110, strokeWidth = 14, centerLabel, centerSub }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);

    if (!total) {
        return (
            <div className="flex flex-col items-center justify-center gap-1">
                <svg width={size} height={size}>
                    <circle cx={size / 2} cy={size / 2} r={r} stroke="#f3f4f6" strokeWidth={strokeWidth} fill="none" />
                </svg>
                {centerLabel && <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{centerLabel}</span>}
            </div>
        );
    }

    let cumulative = 0;
    const arcs = segments
        .filter(s => s.value > 0)
        .map(seg => {
            const dash = (seg.value / total) * circ;
            const arc = { ...seg, dash, gap: circ - dash, offset: circ - cumulative };
            cumulative += dash;
            return arc;
        });

    return (
        <div className="flex flex-col items-center gap-1.5">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
                    <circle cx={size / 2} cy={size / 2} r={r} stroke="#f3f4f6" strokeWidth={strokeWidth} fill="none" />
                    {arcs.map((arc, i) => (
                        <circle
                            key={i}
                            cx={size / 2} cy={size / 2} r={r}
                            stroke={arc.color} strokeWidth={strokeWidth} fill="none"
                            strokeDasharray={`${arc.dash} ${arc.gap}`}
                            strokeDashoffset={arc.offset}
                            strokeLinecap="round"
                        />
                    ))}
                </svg>
                {centerLabel && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {centerSub != null && (
                            <span className="text-xl font-black leading-none" style={{ color: 'var(--c-text)' }}>{centerSub}</span>
                        )}
                        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{centerLabel}</span>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5">
                {arcs.map(s => (
                    <span key={s.label} className="flex items-center gap-1 text-[9px] font-bold" style={{ color: 'var(--c-text-muted)' }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        {s.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ points = [], color = '#6366f1', height = 40, width = 120 }) {
    if (!points || points.length < 2) return null;
    const max = Math.max(...points, 0.001);
    const min = Math.min(...points);
    const range = max - min || 1;
    const pad = 4;
    const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (width - pad * 2));
    const ys = points.map(v => height - pad - ((v - min) / range) * (height - pad * 2));
    const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const fill = `${d} L${xs[xs.length - 1]},${height} L${xs[0]},${height} Z`;
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
            <path d={fill} fill={color} fillOpacity="0.12" />
            <path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={color} />
        </svg>
    );
}

// ── CircleScore ───────────────────────────────────────────────────────────────

function CircleScore({ value, size = 80, strokeWidth = 7, color = '#6366f1', label }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - ((value ?? 0) / 100) * circ;
    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-gray-100" />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    stroke={color} strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
                />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
        </div>
    );
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color = 'indigo', sparkPoints }) {
    const colors = {
        indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-500',  val: 'text-indigo-700',  line: '#6366f1' },
        violet:  { bg: 'bg-violet-50',  icon: 'text-violet-500',  val: 'text-violet-700',  line: '#8b5cf6' },
        emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', val: 'text-emerald-700', line: '#10b981' },
    };
    const c = colors[color] || colors.indigo;
    return (
        <div className={`rounded-2xl p-4 flex flex-col gap-2 ${c.bg} border border-white/60`}>
            <div className="flex items-center justify-between">
                <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${c.icon}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                </div>
                {sparkPoints && <Sparkline points={sparkPoints} color={c.line} width={80} height={32} />}
            </div>
            <div className={`text-3xl font-black tracking-tight ${c.val}`}>{value ?? '—'}</div>
            {sub && <div className="text-[11px] font-medium" style={{ color: 'var(--c-text-muted)' }}>{sub}</div>}
        </div>
    );
}

// ── ConceptRow ────────────────────────────────────────────────────────────────

function ConceptRow({ concept, onClick }) {
    const c = stateColor(concept.state);
    const crsVal = Math.round(parseFloat(concept.crs ?? concept.mastery_score ?? 0));
    return (
        <motion.button
            layout
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-colors group"
        >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
            <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>
                {concept.name ?? concept.topic_name ?? '—'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{concept.state}</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${crsVal}%`, background: c.hex }} />
            </div>
            <span className="text-xs font-bold w-8 text-right flex-shrink-0" style={{ color: 'var(--c-text-muted)' }}>{crsVal}%</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" style={{ color: 'var(--c-text-muted)' }} />
        </motion.button>
    );
}

// ── ConceptDetail ─────────────────────────────────────────────────────────────

function ConceptDetail({ subjectId, conceptName, onClose }) {
    const [detail, setDetail]   = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        AnalyticsService.getConceptDetail(subjectId, conceptName)
            .then(setDetail)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [subjectId, conceptName]);

    const c      = stateColor(detail?.state);
    const crsVal = Math.round(parseFloat(detail?.crs ?? 0));
    const scores = detail?.scores ?? {};

    return (
        <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-y-0 right-0 w-80 shadow-2xl flex flex-col z-20"
            style={{ background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)' }}
        >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span className="font-bold text-sm truncate max-w-[180px]" style={{ color: 'var(--c-text)' }}>{conceptName}</span>
                </div>
                <button onClick={onClose} className="text-xs font-bold px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--c-text-muted)' }}>✕</button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--c-text-muted)' }} />
                </div>
            ) : !detail ? (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-sm" style={{ color: 'var(--c-text-muted)' }}>
                    No data yet for this concept.
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <div className="rounded-2xl p-4 flex justify-center" style={{ background: 'var(--c-canvas)' }}>
                        <DonutChart
                            size={100}
                            strokeWidth={12}
                            centerLabel={detail.state}
                            centerSub={`${crsVal}%`}
                            segments={[
                                { label: 'Readiness', value: crsVal,       color: c.hex },
                                { label: 'Gap',       value: 100 - crsVal, color: '#f3f4f6' },
                            ]}
                        />
                    </div>

                    <div className="space-y-2">
                        {[
                            { label: 'Quiz Understanding',  value: scores.understanding?.value, color: '#6366f1' },
                            { label: 'Flashcard Retention', value: scores.retention?.value,     color: '#8b5cf6' },
                            { label: 'Exam Mastery',        value: scores.mastery?.value,       color: '#10b981' },
                        ].map(({ label, value, color }) => value != null && (
                            <div key={label}>
                                <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: 'var(--c-text-muted)' }}>
                                    <span>{label}</span>
                                    <span>{Math.round(parseFloat(value))}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(parseFloat(value))}%`, background: color }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Interactions', value: detail.trend?.history?.length ?? 0, icon: Zap },
                            { label: 'Last Seen',    value: scores.understanding?.last_updated ? new Date(scores.understanding.last_updated).toLocaleDateString() : '—', icon: Clock },
                        ].map(({ label, value, icon: Ic }) => (
                            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--c-canvas)' }}>
                                <Ic className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: 'var(--c-text-muted)' }} />
                                <div className="text-lg font-black" style={{ color: 'var(--c-text)' }}>{value}</div>
                                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {detail.trend?.history?.filter(h => h.source === 'quiz_session').length > 0 && (
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--c-text-muted)' }}>Recent Quiz Sessions</div>
                            <div className="flex flex-wrap gap-1.5">
                                {detail.trend.history.filter(h => h.source === 'quiz_session').slice(-20).map((h, i) => {
                                    const good = h.accuracy >= 70;
                                    return (
                                        <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center ${good ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                            {good ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {detail.flashcard_schedule?.total_cards > 0 && (
                        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--c-canvas)' }}>
                            <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <div>
                                <div className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                                    {detail.flashcard_schedule.overdue_cards > 0
                                        ? `${detail.flashcard_schedule.overdue_cards} cards overdue`
                                        : `${detail.flashcard_schedule.cards_due_today} cards due today`}
                                </div>
                                <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                                    {detail.flashcard_schedule.total_cards} total tracked
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}

// ── AnalyticsView ─────────────────────────────────────────────────────────────

const AnalyticsView = ({ subjectId }) => {
    const { actions } = useAnalyticsStore();
    const dashboard   = useAnalyticsStore(s => s.data.dashboards[subjectId]);
    const progress    = useAnalyticsStore(s => s.data.progress[subjectId]);
    const loading     = useAnalyticsStore(s => s.loading[`dashboard_${subjectId}`]);
    const error       = useAnalyticsStore(s => s.errors[`dashboard_${subjectId}`]);

    const [concepts, setConcepts]               = useState([]);
    const [distribution, setDistribution]       = useState(null);
    const [loadingConcepts, setLoadingConcepts] = useState(false);
    const [selectedConcept, setSelectedConcept] = useState(null);
    const [conceptFilter, setConceptFilter]     = useState('all');
    const [refreshing, setRefreshing]           = useState(false);
    const [timeRange, setTimeRange]             = useState('all');
    const [activityFilter, setActivity]         = useState('all');

    const loadProgress = useCallback((range, activity) => {
        if (!subjectId) return;
        const sources = activity === 'all' ? null : [activity];
        actions.fetchProgress(subjectId, {
            granularity: range === '7d' ? 'day' : 'week',
            from: fromDate(range),
            sources,
        }).catch(() => {});
    }, [subjectId, actions]);

    const load = useCallback(async (refresh = false) => {
        if (!subjectId) return;
        await Promise.all([
            actions.fetchDashboard(subjectId, { refresh }),
            actions.fetchProgress(subjectId, {
                granularity: timeRange === '7d' ? 'day' : 'week',
                from: fromDate(timeRange),
                sources: activityFilter === 'all' ? null : [activityFilter],
            }),
        ]);
    }, [subjectId, actions, timeRange, activityFilter]);

    const loadConcepts = useCallback(async () => {
        if (!subjectId) return;
        setLoadingConcepts(true);
        try {
            const result = await AnalyticsService.getConcepts(subjectId, { sort: 'crs', order: 'asc', minInteractions: 0 });
            setConcepts(result?.concepts ?? []);
            setDistribution(result?.distribution ?? null);
        } catch (_) {}
        setLoadingConcepts(false);
    }, [subjectId]);

    useEffect(() => {
        if (subjectId && !dashboard) load();
        if (subjectId) loadConcepts();
    }, [subjectId]);

    useEffect(() => {
        loadProgress(timeRange, activityFilter);
    }, [timeRange, activityFilter]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([load(true).catch(() => {}), loadConcepts()]);
        setRefreshing(false);
    };

    const readiness          = dashboard?.readiness ?? {};
    const breakdown          = dashboard?.breakdown ?? {};
    const meta               = dashboard?.meta      ?? {};
    const weak               = dashboard?.weak_concepts ?? [];
    const readinessScore     = pct(readiness.score);
    const tLabel             = meta.trend?.label ?? 'insufficient_data';
    const totalInteractions  = meta.total_interactions ?? 0;
    const dataQuality        = readiness.data_quality;

    const quizPoints = (progress?.series?.quiz_accuracy ?? []).map(p => parseFloat(p.accuracy ?? 0));
    const examPoints = (progress?.series?.exam_scores   ?? []).map(p => parseFloat(p.accuracy ?? 0));

    const filteredConcepts = concepts.filter(c => conceptFilter === 'all' || c.state === conceptFilter);

    const stateSegments = distribution ? [
        { label: 'Mastered',   value: distribution.mastered   ?? 0, color: '#10b981' },
        { label: 'Developing', value: distribution.developing  ?? 0, color: '#6366f1' },
        { label: 'Weak',       value: distribution.weak        ?? 0, color: '#f59e0b' },
        { label: 'Critical',   value: distribution.critical    ?? 0, color: '#ef4444' },
        { label: 'Unstarted',  value: distribution.unstarted   ?? 0, color: '#e5e7eb' },
    ] : [];

    const dimensionSegments = [
        { label: 'Understanding', value: pct(breakdown.understanding?.score) ?? 0, color: '#6366f1' },
        { label: 'Retention',     value: pct(breakdown.retention?.score)     ?? 0, color: '#8b5cf6' },
        { label: 'Mastery',       value: pct(breakdown.mastery?.score)       ?? 0, color: '#10b981' },
    ].filter(s => s.value > 0);

    const activitySegments = [
        { label: 'Quiz',      value: meta.quiz_count      ?? 0, color: '#6366f1' },
        { label: 'Flashcard', value: meta.flashcard_count ?? 0, color: '#8b5cf6' },
        { label: 'Exam',      value: meta.exam_count      ?? 0, color: '#10b981' },
    ].filter(s => s.value > 0);

    const hasCharts = stateSegments.some(s => s.value > 0) || dimensionSegments.length > 0 || activitySegments.length > 0;

    if (!loading && !error && dashboard && totalInteractions === 0 && concepts.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
                    <BarChart2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black" style={{ color: 'var(--c-text)' }}>No study activity yet</h3>
                <p className="text-sm max-w-xs" style={{ color: 'var(--c-text-muted)' }}>
                    Complete quizzes, review flashcards, or take a mock exam — your analytics will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex overflow-hidden relative" style={{ background: 'var(--c-canvas)' }}>
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
                     style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                        <span className="font-black text-sm tracking-tight" style={{ color: 'var(--c-text)' }}>Learning Analytics</span>
                        {dataQuality && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                dataQuality === 'high' ? 'bg-emerald-100 text-emerald-700' :
                                dataQuality === 'moderate' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                            }`}>{dataQuality} confidence</span>
                        )}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40"
                        style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Filter bar */}
                <div className="flex-shrink-0 flex items-center gap-4 px-6 py-2 border-b"
                     style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                    <div className="flex items-center gap-1.5">
                        <Filter className="w-3 h-3" style={{ color: 'var(--c-text-muted)' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>Period</span>
                        {['7d', '30d', '90d', 'all'].map(r => (
                            <button key={r} onClick={() => setTimeRange(r)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                    timeRange === r ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
                                }`}>{r === 'all' ? 'All time' : r}</button>
                        ))}
                    </div>
                    <div className="h-3.5 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>Source</span>
                        {['all', 'quiz', 'flashcard', 'exam'].map(a => (
                            <button key={a} onClick={() => setActivity(a)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize transition-all ${
                                    activityFilter === a ? 'bg-violet-100 text-violet-700' : 'text-gray-400 hover:text-gray-600'
                                }`}>{a}</button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <p className="text-sm text-rose-600 font-medium">{error}</p>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {loading && !dashboard && (
                        <div className="space-y-4 animate-pulse">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-100" />)}
                            </div>
                            <div className="h-44 rounded-2xl bg-gray-100" />
                            <div className="h-60 rounded-2xl bg-gray-100" />
                        </div>
                    )}

                    {dashboard && (
                        <>
                            {/* Readiness + sub-scores */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="col-span-2 md:col-span-1 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 border border-white/60"
                                     style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
                                    <CircleScore
                                        value={readinessScore ?? 0}
                                        size={88} strokeWidth={8}
                                        color={readinessScore >= 70 ? '#10b981' : readinessScore >= 40 ? '#6366f1' : '#ef4444'}
                                        label="Readiness"
                                    />
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-indigo-700">{readinessScore ?? '—'}%</div>
                                        <div className="flex items-center justify-center gap-1 mt-0.5">
                                            {trendIcon(tLabel)}
                                            <span className="text-[11px] font-bold capitalize" style={{ color: 'var(--c-text-muted)' }}>{tLabel.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </div>
                                <MetricCard icon={Brain}  label="Understanding" color="indigo"
                                    value={fmt(breakdown.understanding?.score)} sub="from quizzes" sparkPoints={quizPoints} />
                                <MetricCard icon={Layers} label="Retention"     color="violet"
                                    value={fmt(breakdown.retention?.score)}     sub="from flashcards" />
                                <MetricCard icon={Target} label="Mastery"       color="emerald"
                                    value={fmt(breakdown.mastery?.score)}       sub="from exams" sparkPoints={examPoints} />
                            </div>

                            {/* Donut charts */}
                            {hasCharts && (
                                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface)' }}>
                                    <div className="text-[10px] font-bold uppercase tracking-wide mb-5" style={{ color: 'var(--c-text-muted)' }}>Breakdown</div>
                                    <div className="grid grid-cols-3 gap-4 justify-items-center">
                                        {stateSegments.some(s => s.value > 0) && (
                                            <div className="flex flex-col items-center gap-1">
                                                <DonutChart
                                                    segments={stateSegments}
                                                    size={110} strokeWidth={14}
                                                    centerLabel="concepts"
                                                    centerSub={concepts.length}
                                                />
                                                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-1">State Distribution</span>
                                            </div>
                                        )}
                                        {dimensionSegments.length > 0 && (
                                            <div className="flex flex-col items-center gap-1">
                                                <DonutChart
                                                    segments={dimensionSegments}
                                                    size={110} strokeWidth={14}
                                                    centerLabel="score"
                                                    centerSub={fmt(readiness.score)}
                                                />
                                                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-1">Dimensions</span>
                                            </div>
                                        )}
                                        {activitySegments.length > 0 && (
                                            <div className="flex flex-col items-center gap-1">
                                                <DonutChart
                                                    segments={activitySegments}
                                                    size={110} strokeWidth={14}
                                                    centerLabel="total"
                                                    centerSub={totalInteractions}
                                                />
                                                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-1">Activity Mix</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Consistency stats */}
                            {totalInteractions > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Consistency',  value: fmt(meta.consistency) },
                                        { label: 'Interactions', value: totalInteractions },
                                        { label: 'Confidence',   value: fmt(readiness.confidence != null ? readiness.confidence * 100 : null) },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="rounded-2xl p-4 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                            <div className="text-2xl font-black mb-0.5" style={{ color: 'var(--c-text)' }}>{value}</div>
                                            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Weak concepts */}
                            {weak.length > 0 && (
                                <div className="rounded-2xl border" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface)' }}>
                                    <div className="px-5 py-3.5 flex items-center gap-2 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Needs Attention</span>
                                    </div>
                                    <div className="divide-y">
                                        {weak.slice(0, 5).map(w => {
                                            const c = stateColor(w.state);
                                            return (
                                                <div key={w.name} className="px-5 py-3 flex items-center gap-3">
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                                                    <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{w.name}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{w.state}</span>
                                                    {w.action === 'urgent_review' && (
                                                        <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                                                            <Flame className="w-3 h-3" /> Urgent
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* All concepts */}
                            <div className="rounded-2xl border" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface)' }}>
                                <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
                                    <div className="flex items-center gap-2">
                                        <Brain className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>
                                            Concept Mastery
                                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-black">{filteredConcepts.length}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {['all', 'critical', 'weak', 'developing', 'mastered'].map(f => (
                                            <button key={f} onClick={() => setConceptFilter(f)}
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                                    conceptFilter === f ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
                                                }`}>{f}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-2 max-h-80 overflow-y-auto">
                                    {loadingConcepts ? (
                                        <div className="py-8 flex items-center justify-center">
                                            <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--c-text-muted)' }} />
                                        </div>
                                    ) : filteredConcepts.length === 0 ? (
                                        <div className="py-8 text-center text-sm font-medium" style={{ color: 'var(--c-text-muted)' }}>
                                            {conceptFilter === 'all'
                                                ? 'No concepts tracked yet. Complete a quiz or exam to see data here.'
                                                : `No concepts in "${conceptFilter}" state yet.`}
                                        </div>
                                    ) : filteredConcepts.map(c => (
                                        <ConceptRow
                                            key={c.name ?? c.topic_name}
                                            concept={c}
                                            onClick={() => {
                                                const name = c.name ?? c.topic_name;
                                                setSelectedConcept(prev => prev === name ? null : name);
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Suggested action */}
                            {dashboard?.next_suggested_action && (
                                <div className="rounded-2xl p-4 flex items-start gap-3 border border-indigo-100 bg-indigo-50">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <Zap className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-0.5">Suggested Next Step</div>
                                        <div className="text-sm font-medium text-indigo-900">
                                            {dashboard.next_suggested_action.reason
                                                ? `${dashboard.next_suggested_action.reason} in ${dashboard.next_suggested_action.concept}.`
                                                : `Focus on ${dashboard.next_suggested_action.concept}.`}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {selectedConcept && (
                    <ConceptDetail
                        key={selectedConcept}
                        subjectId={subjectId}
                        conceptName={selectedConcept}
                        onClose={() => setSelectedConcept(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AnalyticsView;
