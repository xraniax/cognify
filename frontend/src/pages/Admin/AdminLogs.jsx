import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import {
    Activity, Search, Filter, AlertTriangle, ShieldCheck, UserCog,
    Database, Clock, RefreshCw, UserX, UserCheck, Key, Trash2,
    HardDrive, Settings, FileText, LogIn, ChevronDown, Info,
    Cpu, Zap, Globe, Server, BarChart3
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';
import ActivityStream from '@/components/Admin/ActivityStream';
import { motion } from 'framer-motion';

// ─── Human-readable log enrichment ───────────────────────────────────────────
const ACTION_MAP = {
    UPDATE_STATUS:    { label: 'Status Changed',  icon: ShieldCheck, color: 'orange',  level: 'warning'  },
    UPDATE_ROLE:      { label: 'Role Changed',     icon: Key,         color: 'blue',    level: 'info'     },
    DELETE_USER:      { label: 'User Deleted',     icon: UserX,       color: 'red',     level: 'critical' },
    SUSPEND_USER:     { label: 'User Suspended',   icon: UserX,       color: 'red',     level: 'critical' },
    ACTIVATE_USER:    { label: 'User Activated',   icon: UserCheck,   color: 'green',   level: 'info'     },
    UPDATE_QUOTA:     { label: 'Quota Updated',    icon: HardDrive,   color: 'purple',  level: 'warning'  },
    CLEANUP_STORAGE:  { label: 'Storage Cleanup',  icon: HardDrive,   color: 'teal',    level: 'info'     },
    DELETE_FILE:      { label: 'File Deleted',     icon: Trash2,      color: 'red',     level: 'critical' },
    UPDATE_SETTINGS:  { label: 'Settings Updated', icon: Settings,    color: 'gray',    level: 'info'     },
    LOGIN:            { label: 'Admin Login',      icon: LogIn,       color: 'green',   level: 'info'     },
    CREATE_USER:      { label: 'User Created',     icon: UserCheck,   color: 'green',   level: 'info'     },
    VIEW_LOGS:        { label: 'Logs Viewed',      icon: FileText,    color: 'gray',    level: 'info'     },
    SECURITY_LOCKOUT: { label: 'Security Lockout', icon: ShieldCheck, color: 'red',     level: 'critical' },
};

const COLOR_MAP = {
    red:    { bg: 'bg-red-50',     border: 'border-red-100',    icon: 'text-red-500',     badge: 'bg-red-50 text-red-700 border-red-100'       },
    orange: { bg: 'bg-orange-50',  border: 'border-orange-100', icon: 'text-orange-500',  badge: 'bg-orange-50 text-orange-700 border-orange-100' },
    blue:   { bg: 'bg-blue-50',    border: 'border-blue-100',   icon: 'text-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-100'       },
    green:  { bg: 'bg-emerald-50', border: 'border-emerald-100',icon: 'text-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    purple: { bg: 'bg-purple-50',  border: 'border-purple-100', icon: 'text-purple-500',  badge: 'bg-purple-50 text-purple-700 border-purple-100' },
    teal:   { bg: 'bg-teal-50',    border: 'border-teal-100',   icon: 'text-teal-500',    badge: 'bg-teal-50 text-teal-700 border-teal-100'       },
    gray:   { bg: 'bg-gray-50',    border: 'border-gray-100',   icon: 'text-gray-400',    badge: 'bg-gray-50 text-gray-600 border-gray-100'       },
};

function getConfig(action) {
    const key = (action || '').toUpperCase();
    return ACTION_MAP[key] || { label: action, icon: Activity, color: 'gray', level: 'info' };
}

function buildDescription(log) {
    const d = log.details || {};
    const actor = log.user_name || log.user_email || 'System';
    const target = d.target_name || d.email || d.name || log.target_id || '';
    const action = (log.action || '').toUpperCase();
    if (action === 'UPDATE_STATUS')
        return `${actor} changed "${target}"'s status from ${d.previous_status || '—'} to ${d.new_status || d.status || '—'}${d.reason ? ` (Reason: ${d.reason})` : ''}.`;
    if (action === 'UPDATE_ROLE')
        return `${actor} changed "${target}"'s role from ${d.previous_role || '—'} to ${d.role || d.new_role || '—'}.`;
    if (action === 'DELETE_USER')
        return `${actor} permanently deleted user "${target}".`;
    if (action === 'UPDATE_QUOTA')
        return `${actor} set storage quota for "${target}" to ${d.limit_mb != null ? `${d.limit_mb} MB` : '—'}.`;
    if (action === 'CLEANUP_STORAGE')
        return `${actor} ran a storage cleanup — freed ${d.space_freed_bytes != null ? Math.round(d.space_freed_bytes / 1024) + ' KB' : '—'}.`;
    if (action === 'DELETE_FILE')
        return `${actor} deleted file "${d.file_name || target}".`;
    if (action === 'UPDATE_SETTINGS') return `${actor} updated system settings.`;
    if (action === 'CREATE_USER')    return `${actor} created user "${target}".`;
    if (action === 'ACTIVATE_USER')  return `${actor} activated user "${target}".`;
    if (action === 'SUSPEND_USER')   return `${actor} suspended user "${target}".`;
    if (action === 'SECURITY_LOCKOUT') return `SYSTEM automatically locked account "${target}" for security (10+ failures).`;
    if (action === 'LOGIN')          return `${actor} signed in to the admin dashboard.`;
    if (target) return `${actor} performed "${log.action}" on "${target}".`;
    return `${actor} performed "${log.action}".`;
}

function formatGroupDate(dateStr) {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
}

function groupByDate(logs) {
    const groups = {};
    for (const log of logs) {
        const key = format(new Date(log.created_at), 'yyyy-MM-dd');
        if (!groups[key]) groups[key] = { date: log.created_at, items: [] };
        groups[key].items.push(log);
    }
    return Object.values(groups);
}

function LogDetailJSON({ details }) {
    const [open, setOpen] = useState(false);
    if (!details || Object.keys(details).length === 0) return null;
    return (
        <div className="mt-3">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-emerald-500 transition-colors"
            >
                <Info className="w-3 h-3" />
                Raw Details
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <pre className="mt-2 bg-gray-900 text-emerald-400 rounded-xl p-3 text-[11px] font-mono overflow-x-auto shadow-inner max-h-40">
                    {JSON.stringify(details, null, 2)}
                </pre>
            )}
        </div>
    );
}

const PAGE_SIZE = 5;

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminLogs = () => {
    const [logs, setLogs] = useState([]);
    const [sysStats, setSysStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('all');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [activeTab, setActiveTab] = useState('audit');
    const [behaviorAction, setBehaviorAction] = useState(null);
    const [securityData, setSecurityData] = useState(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const [logsRes, sysRes, analyticsRes, securityRes] = await Promise.all([
                adminService.getLogs(),
                adminService.getStats(),
                adminService.getAnalytics(),
                adminService.getSecurityAnalytics()
            ]);
            setLogs(logsRes.data.data || []);
            setSysStats(sysRes.data?.data || null);
            setBehaviorAction(analyticsRes.data?.data || null);
            setSecurityData(securityRes.data?.data || null);
            setVisibleCount(PAGE_SIZE);
        } catch {
            toast.error('Failed to load system logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery, filterLevel]);

    const stats = useMemo(() => ({
        total: logs.length,
        critical: logs.filter(l => getConfig(l.action).level === 'critical').length,
        warning: logs.filter(l => getConfig(l.action).level === 'warning').length,
    }), [logs]);

    const filtered = useMemo(() => logs.filter(log => {
        const config = getConfig(log.action);
        const desc = buildDescription(log).toLowerCase();
        const matchesSearch =
            desc.includes(searchQuery.toLowerCase()) ||
            (log.action && log.action.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.user_name && log.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.user_email && log.user_email.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesLevel = filterLevel === 'all' || config.level === filterLevel;
        return matchesSearch && matchesLevel;
    }), [logs, searchQuery, filterLevel]);

    const grouped = useMemo(() => groupByDate(filtered.slice(0, visibleCount)), [filtered, visibleCount]);

    const TABS = [
        { id: 'audit',    label: 'Audit Logs'    },
        { id: 'behavior', label: 'User Behavior'  },
        { id: 'security', label: 'Security'       },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Protocol Delta</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900">
                        System <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Monitoring</span>
                    </h1>
                    <p className="text-sm font-bold text-gray-400 mt-1">Real-time health analytics and comprehensive audit data.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 group"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 ${loading ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Refresh</span>
                </button>
            </div>

            {/* ── System Stats ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'API Latency',   value: sysStats?.latency || '24ms',                       sub: 'Healthy',  icon: Zap,      orb: 'bg-emerald-300/10', iconCls: 'bg-emerald-50 text-emerald-500 border-emerald-100', tag: 'text-emerald-400', wrap: 'border-emerald-100 shadow-emerald-200/30' },
                    { label: 'CPU Cluster',   value: sysStats ? `${sysStats.cpu}%` : '—',               sub: 'Stable',   icon: Cpu,      orb: 'bg-sky-300/10',     iconCls: 'bg-sky-50 text-sky-500 border-sky-100',           tag: 'text-sky-400',     wrap: 'border-sky-100 shadow-sky-200/30'         },
                    { label: 'Memory Load',   value: sysStats ? `${sysStats.memory?.percentage}%` : '—', sub: 'Normal',  icon: Database, orb: 'bg-fuchsia-300/10', iconCls: 'bg-fuchsia-50 text-fuchsia-500 border-fuchsia-100', tag: 'text-fuchsia-400', wrap: 'border-fuchsia-100 shadow-fuchsia-200/30' },
                    { label: 'Audit Events',  value: loading ? '—' : stats.total,                       sub: `${stats.critical} critical`, icon: BarChart3, orb: 'bg-amber-300/10', iconCls: 'bg-amber-50 text-amber-500 border-amber-100', tag: 'text-amber-400', wrap: 'border-amber-100 shadow-amber-200/30' },
                ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={i}
                            whileHover={{ y: -4, scale: 1.015 }}
                            className={`bg-white rounded-3xl border p-5 shadow-xl ${stat.wrap} relative overflow-hidden transition-all`}
                        >
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none ${stat.orb}`} />
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${stat.iconCls}`}><Icon className="w-4 h-4" /></div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${stat.tag}`}>{stat.label}</span>
                            </div>
                            <span className="text-3xl font-black text-gray-900 tracking-tighter block mb-1">
                                {loading ? <Skeleton className="w-16 h-8" /> : stat.value}
                            </span>
                            <p className="text-[10px] text-gray-400 font-bold">{stat.sub}</p>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-100/20 p-1 w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === tab.id
                                ? tab.id === 'security'
                                    ? 'bg-rose-500 text-white shadow-md'
                                    : 'bg-emerald-500 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Content ────────────────────────────────────────────────── */}
            {loading ? (
                <div className="space-y-4">
                    {Array(5).fill(0).map((_, i) => (
                        <div key={i} className="flex gap-4 items-start">
                            <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
                            <div className="space-y-2 w-full pt-1">
                                <Skeleton className="h-4 w-1/3 rounded-xl" />
                                <Skeleton className="h-3 w-2/3 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : activeTab === 'behavior' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Engagement + Hotspots */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* DAU */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-emerald-100/20 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-800 tracking-tight">Engagement Pulse</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Daily active users</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">Last 30 Days</span>
                            </div>
                            <div className="flex items-end gap-[2px] h-40 mb-3">
                                {(behaviorAction?.dau || []).map((d, i) => {
                                    const max = Math.max(...(behaviorAction?.dau || []).map(x => x.count), 1);
                                    return (
                                        <div key={i} className="flex-1 h-full flex items-end group/bar">
                                            <div
                                                className="w-full rounded-t-sm bg-emerald-100 group-hover/bar:bg-emerald-500 transition-colors duration-150 relative"
                                                style={{ height: `${Math.max(5, (d.count / max) * 100)}%` }}
                                            >
                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">{d.count}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <span>30d ago</span><span>Today</span>
                            </div>
                        </div>

                        {/* Top Subjects */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-100/20 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-800 tracking-tight">Academic Hotspots</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Top subjects by material count</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {(behaviorAction?.topSubjects || []).map((s, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between items-end mb-1.5">
                                            <span className="text-sm font-bold text-gray-700">{s.name}</span>
                                            <span className="text-[10px] font-black text-indigo-500">{s.count}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-400 rounded-full"
                                                style={{ width: `${(s.count / (behaviorAction?.topSubjects?.[0]?.count || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Study Velocity */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-fuchsia-100/20 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-fuchsia-50 border border-fuchsia-100 flex items-center justify-center text-fuchsia-500">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-800 tracking-tight">Study Velocity</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{(behaviorAction?.studyActivity || []).reduce((acc, curr) => acc + curr.count, 0)} events over 30 days</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {[['bg-fuchsia-400', 'Quizzes'], ['bg-indigo-400', 'Flashcards']].map(([bg, label]) => (
                                    <div key={label} className="flex items-center gap-1.5">
                                        <div className={`w-2.5 h-2.5 rounded-full ${bg}`} />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-end gap-1.5 h-36">
                            {(() => {
                                const grp = (behaviorAction?.studyActivity || []).reduce((acc, curr) => {
                                    const date = format(new Date(curr.date), 'yyyy-MM-dd');
                                    if (!acc[date]) acc[date] = { date, quiz: 0, flashcard: 0 };
                                    acc[date][curr.type] = curr.count;
                                    return acc;
                                }, {});
                                const days = Object.values(grp).slice(-14);
                                const max = Math.max(...days.map(d => d.quiz + d.flashcard), 1);
                                return days.map((d, i) => (
                                    <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 group relative">
                                        <div className="w-full bg-indigo-400 rounded-sm group-hover:bg-indigo-500 transition-colors" style={{ height: `${(d.flashcard / max) * 100}%` }} />
                                        <div className="w-full bg-fuchsia-400 rounded-sm group-hover:bg-fuchsia-500 transition-colors" style={{ height: `${(d.quiz / max) * 100}%` }} />
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black py-0.5 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{d.quiz}Q / {d.flashcard}F</div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Activity Distribution */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-amber-100/20 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-gray-800 tracking-tight">Operational Distribution</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Top action types by frequency</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {(behaviorAction?.activityDistribution || []).slice(0, 5).map((act, i) => (
                                <div key={i} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:border-amber-100 hover:bg-amber-50/30 transition-all group">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2 group-hover:text-amber-500 transition-colors">{act.action.replace(/_/g, ' ')}</span>
                                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{act.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'security' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Threat Hotspots */}
                        <div className="bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-100/20 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-800 tracking-tight">Threat Hotspots</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Suspicious IP addresses</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {(securityData?.ipThreats || []).length === 0 ? (
                                    <p className="text-sm font-bold text-gray-300 text-center py-8">No active threats detected</p>
                                ) : securityData.ipThreats.map((t, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-rose-50/50 border border-rose-100 rounded-2xl">
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{t.ip_address}</p>
                                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">{t.active_tuples} targeted accounts</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-rose-500">{t.total_failures}</p>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Failures</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Suspended Accounts */}
                        <div className="bg-white rounded-3xl border border-orange-100 shadow-xl shadow-orange-100/20 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
                                    <UserX className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-800 tracking-tight">Restricted Accounts</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Currently suspended users</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {(securityData?.suspendedUsers || []).length === 0 ? (
                                    <p className="text-sm font-bold text-gray-300 text-center py-8">No accounts currently restricted</p>
                                ) : securityData.suspendedUsers.map((u, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-100 transition-all">
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{u.name}</p>
                                            <p className="text-[10px] font-bold text-gray-400">{u.email}</p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await adminService.updateUserStatus(u.id, 'ACTIVE', 'Admin security override');
                                                    toast.success(`Account for ${u.email} reactivated`);
                                                    fetchLogs();
                                                } catch { toast.error('Failed to reactivate account'); }
                                            }}
                                            className="px-4 py-2 bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                        >
                                            Unlock
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Security incident feed */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center text-white">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-gray-800 tracking-tight">Security Incident Feed</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent security events</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {(securityData?.securityLogs || []).slice(0, 10).map((log, i) => (
                                <div key={i} className="flex gap-4 items-center p-4 border-l-4 border-rose-400 bg-rose-50/20 rounded-r-2xl">
                                    <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900">{log.action}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{format(new Date(log.created_at), 'MMM d, HH:mm:ss')} — {log.user_email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-24 bg-white rounded-3xl border border-gray-100 shadow-xl text-center">
                    <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-center text-emerald-300 mx-auto mb-4">
                        <Activity className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">No events found</h3>
                    <p className="text-gray-400 font-bold text-sm">Try adjusting your filters or search query.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Audit Filters */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col md:flex-row items-center gap-3">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative">
                                <select
                                    className="pl-3 pr-8 py-2 bg-gray-50 hover:bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 focus:border-emerald-200 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                                    value={filterLevel}
                                    onChange={e => setFilterLevel(e.target.value)}
                                >
                                    <option value="all">All Events</option>
                                    <option value="info">Informational</option>
                                    <option value="warning">Warnings</option>
                                    <option value="critical">Critical</option>
                                </select>
                                <Filter className="w-3 h-3 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">{filtered.length} events</span>
                        </div>
                        <div className="relative w-full md:w-80 group ml-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by action, user..."
                                className="w-full bg-gray-50 hover:bg-white text-sm font-semibold text-gray-700 outline-none border border-gray-100 focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 rounded-xl py-2.5 pl-11 pr-4 transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Log groups */}
                    {grouped.map(group => (
                        <div key={group.date}>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{formatGroupDate(group.date)}</span>
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>
                            <div className="space-y-3">
                                {group.items.map(log => {
                                    const config = getConfig(log.action);
                                    const colors = COLOR_MAP[config.color] || COLOR_MAP.gray;
                                    const Icon = config.icon;
                                    const desc = buildDescription(log);
                                    const time = format(new Date(log.created_at), 'HH:mm:ss');
                                    return (
                                        <div key={log.id} className="flex gap-4 items-start group">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-110 ${colors.bg} ${colors.border}`}>
                                                <Icon className={`w-4 h-4 ${colors.icon}`} />
                                            </div>
                                            <div className="flex-1 bg-white border border-gray-100 group-hover:border-emerald-100 group-hover:shadow-md transition-all rounded-2xl p-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${colors.badge}`}>{config.label}</span>
                                                        {log.user_name && <span className="text-xs font-bold text-gray-400">by <span className="text-gray-700">{log.user_name}</span></span>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400 tracking-widest shrink-0">
                                                        <Clock className="w-3 h-3" />{time}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-600 font-medium leading-relaxed">{desc}</p>
                                                <LogDetailJSON details={log.details} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {visibleCount < filtered.length && (
                        <div className="flex justify-center">
                            <button
                                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-emerald-600 hover:border-emerald-100 hover:shadow-lg transition-all shadow-sm"
                            >
                                <ChevronDown className="w-4 h-4" />
                                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
                                <span className="text-gray-400">({filtered.length - visibleCount} remaining)</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminLogs;
