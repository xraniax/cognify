import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { motion } from 'framer-motion';
import {
    Users, Zap, Activity, Target, TrendingUp, Brain, Smile,
    Download, Calendar, ChevronRight, X, AlertTriangle, ArrowUpRight, ArrowDownRight, MoreHorizontal
} from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import ActivityStream from '@/components/Admin/ActivityStream';

// --- Drill-down Modal ---
const DrillDownModal = ({ isOpen, onClose, title, data, loading }) => {
    if (!isOpen) return null;
    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-white/60"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-none">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 leading-tight">{title}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Metric Drill-down</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="space-y-3">
                            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-2xl" />)}
                        </div>
                    ) : data.length > 0 ? (
                        <div className="space-y-3">
                            {data.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:border-indigo-100 transition-colors group">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800">{item.title || item.name || item.email}</span>
                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">
                                            {item.type || item.status || (item.created_at ? new Date(item.created_at).toLocaleDateString() : '')}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
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

// ── Colour palette per metric (Tailwind JIT-safe: no dynamic class segments) ──
const PALETTE = {
    fuchsia: {
        wrap: 'border-fuchsia-100 shadow-fuchsia-200/30',
        icon: 'bg-fuchsia-50 text-fuchsia-500 border-fuchsia-100',
        tag:  'text-fuchsia-400',
        glow: 'bg-fuchsia-300/10',
    },
    indigo: {
        wrap: 'border-indigo-100 shadow-indigo-200/30',
        icon: 'bg-indigo-50 text-indigo-500 border-indigo-100',
        tag:  'text-indigo-400',
        glow: 'bg-indigo-300/10',
    },
    emerald: {
        wrap: 'border-emerald-100 shadow-emerald-200/30',
        icon: 'bg-emerald-50 text-emerald-500 border-emerald-100',
        tag:  'text-emerald-400',
        glow: 'bg-emerald-300/10',
    },
    amber: {
        wrap: 'border-amber-100 shadow-amber-200/30',
        icon: 'bg-amber-50 text-amber-500 border-amber-100',
        tag:  'text-amber-400',
        glow: 'bg-amber-300/10',
    },
};

// Subject colours (cycle through fixed list for JIT safety)
// ── KPI card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color, loading, onClick }) => {
    const c = PALETTE[color];
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.015 }}
            onClick={onClick}
            className={`glass-card rounded-[1.8rem] border border-white/70 p-5 shadow-xl ${c.wrap} relative overflow-hidden ${onClick ? 'cursor-pointer active:scale-95' : ''} transition-all`}
        >
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none ${c.glow}`} />
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${c.icon}`}>
                        {icon}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${c.tag}`}>{label}</span>
                </div>
                {onClick && <ArrowUpRight className={`w-3 h-3 ${c.tag} opacity-0 group-hover:opacity-100`} />}
            </div>
            <span className="text-4xl font-black text-gray-900 tracking-tighter block mb-1">
                {loading ? <Skeleton className="w-16 h-9" /> : value}
            </span>
            <p className="text-[10px] text-gray-400 font-bold">{sub}</p>
        </motion.div>
    );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [totalUsers, setTotalUsers] = useState(0);
    const [engagement, setEngagement] = useState(null);
    const [range, setRange] = useState('30d');
    const [drillingDown, setDrillingDown] = useState(null);
    const [drillData, setDrillData] = useState([]);
    const [drillLoading, setDrillLoading] = useState(false);

    const fetchData = async (dayRange) => {
        setLoading(true);
        try {
            const days = parseInt(dayRange);
            const toDate = new Date().toISOString().split('T')[0];
            const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            
            const [usersRes, analyticsRes] = await Promise.all([
                adminService.getUsers(),
                adminService.getAnalytics({ from: fromDate, to: toDate }),
            ]);
            setTotalUsers((usersRes.data?.data || []).length);
            setEngagement(analyticsRes.data?.data || {});
        } catch (err) {
            console.error('Dashboard fetch error', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(range);
    }, [range]);

    const handleDrillDown = async (metric, type, title) => {
        setDrillingDown(title);
        setDrillLoading(true);
        try {
            const days = parseInt(range);
            const toDate = new Date().toISOString().split('T')[0];
            const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            
            const res = await adminService.getDrillDown({ metric, type, from: fromDate, to: toDate });
            setDrillData(res.data?.data || []);
        } catch (err) {
            console.error('Drill-down error', err);
        } finally {
            setDrillLoading(false);
        }
    };

    const handleExport = () => {
        adminService.exportAnalytics({ source: 'dau' });
    };

    // ── Derived student metrics ──────────────────────────────────────────────
    const dau          = engagement?.dau || [];
    const activeToday  = dau.slice(-1)[0]?.count ?? 0;
    const maxDau       = Math.max(...dau.map(d => d.count), 1);

    const studyAct     = engagement?.studyActivity || [];
    const quizTotal    = studyAct.filter(d => d.type === 'quiz').reduce((s, d) => s + d.count, 0);
    const flashTotal   = studyAct.filter(d => d.type === 'flashcard').reduce((s, d) => s + d.count, 0);
    const allSessions  = quizTotal + flashTotal;

    const avgSessions  = totalUsers > 0 ? (allSessions / totalUsers).toFixed(1) : '0';

    const todayKey = new Date().toISOString().split('T')[0];
    const quizToday  = studyAct.filter(d => d.type === 'quiz'      && String(d.date).startsWith(todayKey)).reduce((s, d) => s + d.count, 0);
    const flashToday = studyAct.filter(d => d.type === 'flashcard' && String(d.date).startsWith(todayKey)).reduce((s, d) => s + d.count, 0);

    return (
        <div
            className="flex flex-col h-[calc(100vh-56px)] overflow-hidden px-6 py-4 gap-3 relative"
            style={{ background: 'linear-gradient(160deg,#f8f7ff 0%,#fdf9ff 50%,#f5f8ff 100%)' }}
        >
            <div className="absolute w-[550px] h-[550px] -top-56 -left-56 rounded-full bg-violet-300/15 blur-[110px] pointer-events-none -z-10" />
            <div className="absolute w-[450px] h-[450px] bottom-0 -right-40 rounded-full bg-indigo-200/15 blur-[90px] pointer-events-none -z-10" />

            <div className="flex items-center justify-between flex-none">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Mission Control</span>
                    <span className="text-[10px] text-gray-200 font-bold mx-1">·</span>
                    <div className="flex items-center gap-2 bg-white/50 border border-white/60 p-1 rounded-full overflow-hidden shadow-sm">
                        {['7d', '30d', '90d'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all ${range === r ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-100 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95 group">
                        <Download className="w-3 h-3 text-gray-400 group-hover:text-indigo-500" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-gray-700">Export CSV</span>
                    </button>
                    <div className="h-6 w-px bg-gray-200/50 mx-1" />
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                        {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                </div>
            </div>

            {engagement?.anomaly && (
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={`flex-none flex items-center justify-between px-6 py-2.5 rounded-3xl border border-rose-100 shadow-lg relative overflow-hidden ${engagement.anomaly.severity === 'high' ? 'bg-rose-50' : 'bg-amber-50 border-amber-100'}`}
                >
                    <div className="flex items-center gap-3 relative z-10">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${engagement.anomaly.severity === 'high' ? 'bg-rose-100 text-rose-500' : 'bg-amber-100 text-amber-500'}`}>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${engagement.anomaly.severity === 'high' ? 'text-rose-500' : 'text-amber-500'}`}>Protocol Delta Detected</p>
                            <p className="text-xs font-bold text-gray-700">{engagement.anomaly.message}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/60 border border-white/80 rounded-full">
                        {engagement.anomaly.delta < 0 ? <ArrowDownRight className="w-3 h-3 text-rose-500" /> : <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                        <span className={`text-[10px] font-black ${engagement.anomaly.delta < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{engagement.anomaly.delta}%</span>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-4 gap-3 flex-none">
                <KpiCard icon={<Users className="w-4 h-4" />} label="Total Learners" value={totalUsers} sub="Registered students" color="fuchsia" loading={loading} />
                <KpiCard icon={<Activity className="w-4 h-4" />} label="Active Learners" value={activeToday} sub="Current active users" color="indigo" loading={loading} onClick={() => handleDrillDown('active_users', null, 'Active Users History')} />
                <KpiCard icon={<Brain className="w-4 h-4" />} label="Study Sessions" value={quizToday + flashToday} sub="Quizzes & flashcards today" color="emerald" loading={loading} />
                <KpiCard icon={<Smile className="w-4 h-4" />} label="Satisfaction Index" value={avgSessions} sub="Avg sessions per learner" color="amber" loading={loading} />
            </div>

            <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
                <div className="col-span-8 glass-card rounded-[2rem] border border-white/70 p-5 flex flex-col overflow-hidden shadow-xl shadow-indigo-100/20">
                    <div className="flex items-center justify-between flex-none mb-2">
                        <div>
                            <p className="text-xs font-black text-gray-800 tracking-tight">{range} Engagement</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Daily active learners</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                            <TrendingUp className="w-3 h-3 text-indigo-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Trend</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-3 flex-none">
                        <span className="text-3xl font-black text-gray-900 tracking-tighter">{activeToday}</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase">active today</span>
                    </div>
                    <div className="flex items-end gap-[2px] flex-1 min-h-0">
                        {dau.map((d, i) => (
                            <div key={i} className="flex-1 h-full flex items-end group/bar">
                                <div className="w-full rounded-t-sm bg-indigo-100 group-hover/bar:bg-indigo-500 transition-colors duration-150 relative" style={{ height: `${Math.max(5, (d.count / maxDau) * 100)}%` }}>
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">{d.count}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="col-span-4 flex flex-col gap-3 min-h-0">
                    <div className="glass-card rounded-[2rem] border border-white/70 p-5 shadow-xl shadow-emerald-100/20 flex-none">
                        <p className="text-xs font-black text-gray-800 tracking-tight mb-0.5">Performance Activity</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">{range} quiz & flashcard sessions</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Target className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Quizzes</span>
                                </div>
                                <span className="text-2xl font-black text-gray-900 tracking-tighter">{loading ? <Skeleton className="w-10 h-6" /> : quizTotal}</span>
                            </div>
                            <div className="bg-indigo-50 rounded-2xl p-3 border border-indigo-100">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Zap className="w-3 h-3 text-indigo-500" />
                                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Flashcards</span>
                                </div>
                                <span className="text-2xl font-black text-gray-900 tracking-tighter">{loading ? <Skeleton className="w-10 h-6" /> : flashTotal}</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-[2rem] border border-white/70 p-5 flex flex-col flex-1 min-h-0 overflow-hidden shadow-xl shadow-emerald-100/10">
                        <div className="flex items-center justify-between flex-none mb-3">
                            <div>
                                <p className="text-xs font-black text-gray-800 tracking-tight">Live Pulse</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Student activity stream</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live</span>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <ActivityStream limit={4} compact={true} />
                        </div>
                    </div>
                </div>
            </div>

            <DrillDownModal isOpen={!!drillingDown} onClose={() => setDrillingDown(null)} title={drillingDown} data={drillData} loading={drillLoading} />
        </div>
    );
};

export default AdminDashboard;
