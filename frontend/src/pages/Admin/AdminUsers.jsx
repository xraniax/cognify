import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { adminService } from '@/features/admin/services/AdminService';
import { UserStatusBadge, UserRoleBadge } from '@/components/Admin/UserBadges';
import {
    Search, ShieldAlert, Trash2, UserPlus, MoreVertical,
    RefreshCw, UserCheck, ShieldOff, HardDrive, Filter,
    DownloadCloud, UploadCloud, ChevronDown, ChevronUp, Mail, Calendar, Settings,
    Activity, ShieldCheck, Users, LayoutGrid, List
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import CustomModal from '@/components/ui/CustomModal';
import Skeleton from '@/components/ui/Skeleton';
import { formatDistanceToNow, format } from 'date-fns';
import { useUIStore } from '@/store/useUIStore';
import { formatBytes } from '@/utils/format';
import QuotaOverrideModal from '@/components/Admin/QuotaOverrideModal';
import { motion, AnimatePresence } from 'framer-motion';

// ── KPI Card (matches dashboard style) ─────────────────────────────────────
const PALETTE = {
    fuchsia: { wrap: 'border-fuchsia-100 shadow-fuchsia-200/30', icon: 'bg-fuchsia-50 text-fuchsia-500 border-fuchsia-100', tag: 'text-fuchsia-400', glow: 'bg-fuchsia-300/10' },
    emerald: { wrap: 'border-emerald-100 shadow-emerald-200/30', icon: 'bg-emerald-50 text-emerald-500 border-emerald-100', tag: 'text-emerald-400', glow: 'bg-emerald-300/10' },
    amber:   { wrap: 'border-amber-100 shadow-amber-200/30',     icon: 'bg-amber-50 text-amber-500 border-amber-100',       tag: 'text-amber-400',   glow: 'bg-amber-300/10'   },
    sky:     { wrap: 'border-sky-100 shadow-sky-200/30',         icon: 'bg-sky-50 text-sky-500 border-sky-100',             tag: 'text-sky-400',     glow: 'bg-sky-300/10'     },
    rose:    { wrap: 'border-rose-100 shadow-rose-200/30',       icon: 'bg-rose-50 text-rose-500 border-rose-100',          tag: 'text-rose-400',    glow: 'bg-rose-300/10'    },
};

const KpiCard = ({ icon, label, value, sub, color, loading }) => {
    const c = PALETTE[color] || PALETTE.fuchsia;
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.015 }}
            className={`bg-white rounded-3xl border p-5 shadow-xl ${c.wrap} relative overflow-hidden transition-all`}
        >
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none ${c.glow}`} />
            <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${c.icon}`}>{icon}</div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${c.tag}`}>{label}</span>
            </div>
            <span className="text-4xl font-black text-gray-900 tracking-tighter block mb-1">
                {loading ? <Skeleton className="w-16 h-9" /> : value}
            </span>
            <p className="text-[10px] text-gray-400 font-bold">{sub}</p>
        </motion.div>
    );
};

const AdminUsers = () => {
    const currentUser = useAuthStore(state => state.data?.user);
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterRole, setFilterRole] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('list');
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [storageBudget, setStorageBudget] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalType, setModalType] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, settingsRes] = await Promise.all([
                adminService.getUsers(),
                adminService.getSettings()
            ]);
            setUsers(usersRes.data?.data || []);
            setSettings(settingsRes.data?.data || null);
            const defaultM = settingsRes.data?.data?.storage?.default_user_quota_mb || 100;
            const impactRes = await adminService.getQuotaImpact(defaultM);
            setStorageBudget(impactRes.data?.data?.budget || null);
        } catch (error) {
            toast.error('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const filteredUsers = useMemo(() => {
        let result = users.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                                user.email.toLowerCase().includes(debouncedSearch.toLowerCase());
            const matchesStatus = filterStatus === 'all' || user.status?.toUpperCase() === filterStatus;
            const matchesRole = filterRole === 'all' || user.role === filterRole;
            return matchesSearch && matchesStatus && matchesRole;
        });
        return result.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            if (sortBy === 'storage_usage_bytes' || sortBy === 'workspace_count') {
                valA = parseInt(valA) || 0; valB = parseInt(valB) || 0;
            } else if (sortBy === 'created_at' || sortBy === 'last_active_at') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, debouncedSearch, filterStatus, filterRole, sortBy, sortOrder]);

    const displayedUsers = useMemo(() => showAll ? filteredUsers : filteredUsers.slice(0, 10), [filteredUsers, showAll]);

    const metrics = useMemo(() => {
        const total = users.length;
        const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
        const now = Date.now();
        const onlineNow = Math.max(1, users.filter(u => {
            const lastActive = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
            return now - lastActive < ONLINE_THRESHOLD_MS;
        }).length);
        const suspended = users.filter(u => u.status?.toUpperCase() === 'SUSPENDED').length;
        const totalStorageBytes = settings?.stats?.total_storage_bytes ||
                                users.reduce((acc, u) => acc + (parseInt(u.storage_usage_bytes) || 0), 0);
        return { total, onlineNow, suspended, totalStorageBytes };
    }, [users, settings]);

    const applyOptimistic = (userId, patch) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
    };

    const handleAction = async () => {
        if (!selectedUser || !modalType) return;
        const uiActions = useUIStore.getState().actions;
        setIsActionLoading(true);
        uiActions.setLoading('adminAction', true, `${modalType}ing user...`, false);
        try {
            if (modalType === 'suspend') {
                applyOptimistic(selectedUser.id, { status: 'SUSPENDED' });
                await adminService.updateUserStatus(selectedUser.id, 'suspended');
                toast.success(`${selectedUser.name} suspended`);
            } else if (modalType === 'activate') {
                applyOptimistic(selectedUser.id, { status: 'ACTIVE' });
                await adminService.updateUserStatus(selectedUser.id, 'active');
                toast.success(`${selectedUser.name} reactivated`);
            } else if (modalType === 'promote') {
                applyOptimistic(selectedUser.id, { role: 'admin' });
                await adminService.updateUserRole(selectedUser.id, 'admin');
                toast.success(`${selectedUser.name} promoted to admin`);
            } else if (modalType === 'demote') {
                applyOptimistic(selectedUser.id, { role: 'user' });
                await adminService.updateUserRole(selectedUser.id, 'user');
                toast.success(`${selectedUser.name} demoted to user`);
            } else if (modalType === 'delete') {
                setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
                await adminService.deleteUser(selectedUser.id);
                toast.success(`${selectedUser.name} deleted`);
            }
            setModalType(null); setSelectedUser(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
            await fetchData();
        } finally {
            setIsActionLoading(false);
            uiActions.setLoading('adminAction', false);
        }
    };

    const handleSaveQuota = async (user, mb) => {
        const uiActions = useUIStore.getState().actions;
        uiActions.setLoading('adminAction', true, 'Updating quota...', false);
        try {
            const limitBytes = mb ? parseInt(mb) * 1024 * 1024 : null;
            await adminService.updateUserStorageLimit(user.id, limitBytes);
            applyOptimistic(user.id, { storage_limit_bytes: limitBytes });
            toast.success('Storage limit updated');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update quota');
        } finally {
            uiActions.setLoading('adminAction', false);
        }
    };

    const confirmAction = (user, type) => {
        setSelectedUser(user);
        setModalType(type);
        setActiveDropdownId(null);
        if (type === 'quota') return;
        if (user.id === currentUser?.id) { toast.error(`You cannot ${type} yourself`); return; }
        if (user.role === 'admin' && currentUser?.role === 'admin') {
            const userCreated = new Date(user.created_at);
            const adminCreated = new Date(currentUser.created_at);
            if (userCreated <= adminCreated) { toast.error('You cannot manage admins who joined before you'); return; }
        }
        setSelectedUser(user); setModalType(type); setActiveDropdownId(null);
    };

    // ── Table View ────────────────────────────────────────────────────────────
    const DesktopTableView = ({ users }) => {
        const toggleSort = (key) => {
            if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            else { setSortBy(key); setSortOrder('desc'); }
        };
        const hdr = (field) => `text-[9px] font-black uppercase tracking-widest ${sortBy === field ? 'text-fuchsia-500' : 'text-gray-400'}`;

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort('name')} className="flex items-center gap-1.5 group outline-none">
                                    <span className={hdr('name')}>User</span>
                                    {sortBy === 'name' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-fuchsia-500" /> : <ChevronDown className="w-3 h-3 text-fuchsia-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort('role')} className="flex items-center gap-1.5 group outline-none">
                                    <span className={hdr('role')}>Role</span>
                                    {sortBy === 'role' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-fuchsia-500" /> : <ChevronDown className="w-3 h-3 text-fuchsia-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort('storage_usage_bytes')} className="flex items-center gap-1.5 group outline-none">
                                    <span className={hdr('storage_usage_bytes')}>Storage</span>
                                    {sortBy === 'storage_usage_bytes' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-fuchsia-500" /> : <ChevronDown className="w-3 h-3 text-fuchsia-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort('last_active_at')} className="flex items-center gap-1.5 group outline-none">
                                    <span className={hdr('last_active_at')}>Last Active</span>
                                    {sortBy === 'last_active_at' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-fuchsia-500" /> : <ChevronDown className="w-3 h-3 text-fuchsia-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                                </button>
                            </th>
                            <th className="px-6 py-3 text-right">
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.map((user, idx) => (
                            <motion.tr
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                key={user.id}
                                className="group hover:bg-fuchsia-50/30 transition-all"
                            >
                                <td className="px-6 py-3.5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-xs font-black shadow-md shadow-fuchsia-200/50">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-[13px] text-gray-900 leading-none mb-0.5">{user.name}</p>
                                            <p className="text-[10px] font-mono font-bold text-gray-400">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3.5">
                                    <UserRoleBadge role={user.role} />
                                </td>
                                <td className="px-6 py-3.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] font-black text-gray-800">{formatBytes(parseInt(user.storage_usage_bytes) || 0)}</span>
                                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-400 rounded-full" style={{ width: `${Math.min(100, ((parseInt(user.storage_usage_bytes) || 0) / ((user.storage_limit_bytes || (settings?.storage?.default_user_quota_mb || 100) * 1024 * 1024)) * 100))}%` }} />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3.5">
                                    <p className="text-[11px] font-bold text-gray-500">
                                        {user.last_active_at ? formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true }) : 'Never'}
                                    </p>
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => confirmAction(user, 'quota')}
                                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 rounded-xl hover:bg-fuchsia-100 transition-colors"
                                        >
                                            Quota
                                        </button>
                                        <button onClick={() => confirmAction(user, 'delete')} className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // ── Grid View ─────────────────────────────────────────────────────────────
    const GridView = ({ users }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user, idx) => {
                const defaultQuotaBytes = (settings?.storage?.default_user_quota_mb || 100) * 1024 * 1024;
                const maxQuota = user.storage_limit_bytes || defaultQuotaBytes;
                const usageBytes = parseInt(user.storage_usage_bytes) || 0;
                const usagePercent = Math.min((usageBytes / maxQuota) * 100, 100);
                return (
                    <motion.div
                        key={user.id}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04 }}
                        className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-fuchsia-100/10 p-5 hover:shadow-fuchsia-200/20 hover:border-fuchsia-100 transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-fuchsia-200/50">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-black text-gray-900 leading-tight">{user.name}</p>
                                    <UserStatusBadge status={user.status} />
                                </div>
                            </div>
                            <button onClick={() => confirmAction(user, 'delete')} className="p-2 text-gray-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 mb-4">{user.email}</p>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Storage</span>
                                    <span className="text-[11px] font-black text-gray-700">{formatBytes(usageBytes)}</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-400 rounded-full" style={{ width: `${usagePercent}%` }} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <UserRoleBadge role={user.role} />
                                <span className="text-[10px] font-bold text-gray-400">{user.last_active_at ? formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true }) : 'Never'}</span>
                            </div>
                            <button
                                onClick={() => confirmAction(user, 'quota')}
                                className="w-full py-2.5 bg-fuchsia-50 border border-fuchsia-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-fuchsia-600 hover:bg-fuchsia-100 transition-all"
                            >
                                Adjust Quota
                            </button>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-500">Security Cluster</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900">
                        User <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-pink-500">Management</span>
                    </h1>
                    <p className="text-sm font-bold text-gray-400 mt-1">Real-time status of the academic collective.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 group"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-gray-400 group-hover:text-fuchsia-500 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Refresh</span>
                </button>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={<Users className="w-4 h-4" />}      label="Total Users"   value={isLoading ? '—' : metrics.total}      sub="Registered accounts"       color="fuchsia" loading={isLoading} />
                <KpiCard icon={<Activity className="w-4 h-4" />}   label="Online Now"    value={isLoading ? '—' : metrics.onlineNow}  sub="Active in last 5 min"      color="emerald" loading={isLoading} />
                <KpiCard icon={<ShieldAlert className="w-4 h-4" />} label="Suspended"    value={isLoading ? '—' : metrics.suspended} sub="Restricted accounts"       color="amber"   loading={isLoading} />
                <KpiCard icon={<HardDrive className="w-4 h-4" />}  label="Total Storage" value={isLoading ? '—' : formatBytes(metrics.totalStorageBytes).split(' ')[0]} sub={`${formatBytes(metrics.totalStorageBytes).split(' ')[1]} consumed`} color="sky" loading={isLoading} />
            </div>

            {/* ── Filter Bar ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 p-4 flex flex-col lg:flex-row items-center gap-4">
                <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
                    {/* Role filter */}
                    <div className="relative">
                        <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            className="pl-9 pr-8 py-2.5 bg-gray-50 hover:bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 focus:border-fuchsia-200 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                        >
                            <option value="all">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Status filter */}
                    <div className="relative">
                        <Activity className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            className="pl-9 pr-8 py-2.5 bg-gray-50 hover:bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 focus:border-fuchsia-200 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="SUSPENDED">Suspended</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* View switcher */}
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 p-1 rounded-xl">
                        {[['list', List], ['grid', LayoutGrid]].map(([mode, Icon]) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative w-full lg:w-80 group ml-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full bg-gray-50 hover:bg-white text-sm font-bold text-gray-700 outline-none border border-gray-100 focus:border-fuchsia-200 focus:ring-4 focus:ring-fuchsia-50/50 rounded-xl py-2.5 pl-11 pr-4 transition-all"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Data View ──────────────────────────────────────────────── */}
            <div className={`transition-all duration-500 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {isLoading && users.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="py-24 bg-white rounded-3xl border border-gray-100 shadow-xl text-center">
                        <div className="w-16 h-16 bg-fuchsia-50 border border-fuchsia-100 rounded-3xl flex items-center justify-center text-fuchsia-300 mx-auto mb-4">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">No Users Found</h3>
                        <p className="text-gray-400 font-bold text-sm">No records match your current filters.</p>
                        <button
                            onClick={() => { setSearchQuery(''); setFilterRole('all'); setFilterStatus('all'); }}
                            className="mt-6 px-8 py-3 bg-gray-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gray-800 transition-all active:scale-95"
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-fuchsia-100/10 overflow-hidden">
                        <DesktopTableView users={displayedUsers} />
                    </div>
                ) : (
                    <GridView users={displayedUsers} />
                )}
            </div>

            {/* ── Load More ──────────────────────────────────────────────── */}
            {!isLoading && filteredUsers.length > 10 && (
                <div className="flex justify-center">
                    <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowAll(!showAll)}
                        className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-fuchsia-600 hover:border-fuchsia-100 hover:shadow-lg transition-all shadow-sm"
                    >
                        {showAll ? <><ChevronUp className="w-4 h-4" /> Collapse</> : <><ChevronDown className="w-4 h-4" /> Show All ({filteredUsers.length} users)</>}
                    </motion.button>
                </div>
            )}

            <CustomModal
                isOpen={!!modalType && modalType !== 'quota'}
                onClose={() => setModalType(null)}
                onConfirm={handleAction}
                isLoading={isActionLoading}
                type={modalType === 'delete' ? 'warning' : 'confirm'}
                title={`${modalType?.charAt(0).toUpperCase() + modalType?.slice(1)} User: ${selectedUser?.name}`}
                message={`Are you sure you want to ${modalType} ${selectedUser?.name}?${modalType === 'delete' ? ' This action is permanent and cannot be undone.' : ''}`}
            />

            <QuotaOverrideModal
                isOpen={modalType === 'quota'}
                onClose={() => setModalType(null)}
                onSave={async (user, mb) => { await handleSaveQuota(user, mb); setModalType(null); }}
                user={selectedUser}
                globalSettings={settings?.storage}
                storageBudget={storageBudget}
                isLoading={isActionLoading}
            />
        </div>
    );
};

export default AdminUsers;
