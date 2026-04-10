import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialService } from '@/services/MaterialService';
import { Trash2, RotateCcw, File as FileIcon, ArrowLeft, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const Trash = () => {
    const navigate = useNavigate();
    const [trashItems, setTrashItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        fetchTrash();
    }, []);

    const fetchTrash = async () => {
        setLoading(true);
        try {
            const res = await MaterialService.getTrash();
            setTrashItems(res.data.data);
        } catch (err) {
            toast.error('Failed to load trash items');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id, title) => {
        setIsActionLoading(true);
        try {
            await MaterialService.restore(id);
            toast.success(`"${title}" restored successfully`);
            fetchTrash();
        } catch (err) {
            toast.error('Failed to restore material');
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">
            {/* Quick Navigation */}
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                </button>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div className="group">
                    <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        <span>System Archive</span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tight lg:tracking-tighter mb-2">
                        My <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600 drop-shadow-sm">Trash</span>
                    </h1>
                    <p className="text-gray-500 font-medium text-lg mt-2">View your deleted materials and restore them to their original subjects.</p>
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-20 flex flex-col items-center justify-center animate-pulse">
                    <div className="w-16 h-16 border-4 border-red-50 border-t-red-500 rounded-full animate-spin mb-6"></div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Fetching Deleted Materials</h3>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Scanning trash bin...</p>
                </div>
            ) : trashItems.length === 0 ? (
                <div className="w-full py-32 bg-white border border-gray-200 border-dashed rounded-[3rem] text-center shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-6 border border-gray-100">
                        <Trash2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-2">Your trash is empty</h3>
                    <p className="text-gray-500 font-medium">Deleted materials will appear here until you recover them.</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Material</th>
                                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Original subject</th>
                                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Deleted At</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {trashItems.map((item) => (
                                    <tr key={item.id} className="transition-colors group hover:bg-gray-50/50">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center border border-red-100 shrink-0 shadow-sm transition-transform group-hover:scale-110">
                                                    <FileIcon className="w-6 h-6" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-black text-gray-900 truncate" title={item.title}>
                                                        {item.title}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                        {item.type}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                                <span className="text-xs font-bold text-gray-600">{item.subject_name || 'Imported'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5">
                                            <span className="text-xs font-bold text-gray-500 block">{item.deleted_at ? format(new Date(item.deleted_at), 'MMM dd, yyyy') : 'N/A'}</span>
                                            <span className="text-[10px] text-gray-400 font-medium">{item.deleted_at ? format(new Date(item.deleted_at), 'HH:mm') : ''}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => handleRestore(item.id, item.title)}
                                                    disabled={isActionLoading}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm shadow-indigo-100 disabled:opacity-50"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    Recover
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Trash;
