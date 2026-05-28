import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { HardDrive, Database, Server, ShieldCheck, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomModal from '@/components/ui/CustomModal';
import FileList from '@/components/Admin/AdminFiles/FileList';
import Skeleton from '@/components/ui/Skeleton';
import { formatBytes } from '@/utils/format';
import { motion } from 'framer-motion';

const AdminFiles = () => {
    const [files, setFiles] = useState([]);
    const [settings, setSettings] = useState(null);
    const [stats, setStats] = useState({ total_storage_bytes: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ userId: '', subjectId: '', mimeType: '', minSizeMb: '', sortBy: 'created_at', order: 'desc' });
    const [selectedFileIds, setSelectedFileIds] = useState(new Set());
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    useEffect(() => {
        const debounce = setTimeout(() => { fetchData(!settings); }, 300);
        return () => clearTimeout(debounce);
    }, [filters]);

    const fetchData = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const [filesRes, settingsRes] = await Promise.all([
                adminService.getFiles(filters),
                adminService.getSettings()
            ]);
            setFiles(filesRes.data?.data || []);
            setSettings(settingsRes.data?.data?.storage || {});
            setStats({ total_storage_bytes: settingsRes.data?.data?.stats?.total_storage_bytes || 0 });
            setSelectedFileIds(new Set());
        } catch (err) {
            toast.error('Failed to load storage data');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (fileId, fileName) => {
        try {
            const response = await adminService.downloadFile(fileId);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error('Download failed');
        }
    };

    const handleDeleteFile = (fileId, fileName) => {
        setModalConfig({
            title: 'Delete File?',
            message: `Are you sure you want to permanently delete "${fileName}"? This will remove the original source and cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete Permanently',
            onConfirm: async () => {
                try {
                    await adminService.deleteFile(fileId);
                    toast.success('File deleted');
                    fetchData(false);
                } catch (err) {
                    toast.error(err.message || 'Failed to delete file');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const handleBulkDelete = () => {
        if (selectedFileIds.size === 0) return;
        setModalConfig({
            title: `Delete ${selectedFileIds.size} Files?`,
            message: `Are you sure you want to permanently delete these ${selectedFileIds.size} files? This action is highly destructive and cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete All Checked',
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    const ids = Array.from(selectedFileIds);
                    await Promise.all(ids.map(id => adminService.deleteFile(id)));
                    toast.success(`Successfully deleted ${ids.length} files`);
                    fetchData(false);
                } catch (err) {
                    toast.error('Partial failure during bulk delete');
                    fetchData(false);
                } finally {
                    setIsActionLoading(false);
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const totalCapacity = settings?.max_cluster_size_bytes
        || (settings?.max_cluster_size_gb ? settings.max_cluster_size_gb * 1073741824 : 10 * 1024 * 1024 * 1024);
    const usedBytes = stats.total_storage_bytes || 0;
    const availableBytes = Math.max(0, totalCapacity - usedBytes);
    const usagePercent = Math.min((usedBytes / totalCapacity) * 100, 100);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-500">Nexus Storage</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900">
                        File <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-blue-500">Explorer</span>
                    </h1>
                    <p className="text-sm font-bold text-gray-400 mt-1">Audit uploads, manage storage assets, and scan cluster volumes.</p>
                </div>
                <button
                    onClick={() => fetchData(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 group"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-gray-400 group-hover:text-sky-500 ${loading ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Refresh</span>
                </button>
            </div>

            {/* ── Storage KPI Cards ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Capacity */}
                <motion.div
                    whileHover={{ y: -4, scale: 1.015 }}
                    className="bg-white rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-200/30 p-5 relative overflow-hidden transition-all"
                >
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-indigo-300/10" />
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-indigo-50 text-indigo-500 border-indigo-100">
                            <Database className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Total Capacity</span>
                    </div>
                    <span className="text-4xl font-black text-gray-900 tracking-tighter block mb-1">
                        {loading ? <Skeleton className="w-20 h-9" /> : formatBytes(totalCapacity)}
                    </span>
                    <p className="text-[10px] text-gray-400 font-bold">Platform ceiling</p>
                </motion.div>

                {/* Cluster Usage */}
                <motion.div
                    whileHover={{ y: -4, scale: 1.015 }}
                    className="bg-white rounded-3xl border border-sky-100 shadow-xl shadow-sky-200/30 p-5 relative overflow-hidden transition-all"
                >
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-sky-300/10" />
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-sky-50 text-sky-500 border-sky-100">
                            <Server className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-sky-400">Cluster Usage</span>
                    </div>
                    <span className="text-4xl font-black text-gray-900 tracking-tighter block mb-1">
                        {loading ? <Skeleton className="w-20 h-9" /> : formatBytes(usedBytes)}
                    </span>
                    <div className="mt-2 h-1 bg-sky-100 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-400 rounded-full transition-all duration-1000" style={{ width: `${usagePercent}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">{usagePercent.toFixed(1)}% consumed</p>
                </motion.div>

                {/* Available */}
                <motion.div
                    whileHover={{ y: -4, scale: 1.015 }}
                    className="bg-white rounded-3xl border border-emerald-100 shadow-xl shadow-emerald-200/30 p-5 relative overflow-hidden transition-all"
                >
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-emerald-300/10" />
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-emerald-50 text-emerald-500 border-emerald-100">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Available</span>
                    </div>
                    <span className="text-4xl font-black text-emerald-600 tracking-tighter block mb-1">
                        {loading ? <Skeleton className="w-20 h-9" /> : formatBytes(availableBytes)}
                    </span>
                    <p className="text-[10px] text-gray-400 font-bold">Free headroom</p>
                </motion.div>
            </div>

            {/* ── File List ──────────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-sky-100/10 overflow-hidden">
                <FileList
                    files={files}
                    onDelete={handleDeleteFile}
                    onDownload={handleDownload}
                    filters={filters}
                    setFilters={setFilters}
                    settings={settings}
                    selectedIds={selectedFileIds}
                    setSelectedIds={setSelectedFileIds}
                    onBulkDelete={handleBulkDelete}
                />
            </div>

            <CustomModal
                isOpen={isModalOpen}
                onClose={() => !isActionLoading && setIsModalOpen(false)}
                title={modalConfig.title}
                showFooter={false}
            >
                <div className="p-6 text-center">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto bg-rose-50 text-rose-500 border border-rose-100">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <p className="text-gray-600 font-medium mb-8">{modalConfig.message}</p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            disabled={isActionLoading}
                            className="flex-1 py-3.5 font-bold text-gray-500 bg-white rounded-2xl hover:bg-gray-50 transition-all border border-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={modalConfig.onConfirm}
                            disabled={isActionLoading}
                            className={`flex-1 py-3.5 font-bold text-white rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 shadow-rose-200 ${isActionLoading ? 'opacity-70 pointer-events-none' : ''}`}
                        >
                            {isActionLoading ? 'Processing...' : modalConfig.confirmText}
                        </button>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
};

export default AdminFiles;
