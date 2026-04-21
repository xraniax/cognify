import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subjectService } from '@/features/subjects/services/SubjectService';
import { Search, Filter, SortAsc, Plus, X, Edit2, Trash2, BookOpen, Lock, Layers, Sparkles, Brain, Trash } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import CustomModal from '@/components/ui/CustomModal';
import Skeleton from '@/components/ui/Skeleton';
import { validateName } from '@/utils/validators';
import FloatingActionButton from '@/components/ui/FloatingActionButton';

import { useAuthStore } from '@/store/useAuthStore';
import { useSubjectStore } from '@/store/useSubjectStore';
import { useUIStore } from '@/store/useUIStore';
import { requireAuth } from '@/utils/requireAuth';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Dashboard = () => {
    const user = useAuthStore((state) => state.data.user);
    const subjects = useSubjectStore((state) => state.data.subjects);
    const isPublic = useSubjectStore((state) => state.data.isPublic);
    const loading = useUIStore(state => state.data.loadingStates['subjects']?.loading);
    const fetchError = useSubjectStore((state) => state.error);
    const { fetchSubjects, createSubject } = useSubjectStore((state) => state.actions);
    const uiError = useUIStore(state => state.data.errors['createSubject']);
    const clearUIError = useUIStore(state => state.actions.clearError);

    const [newSubjectName, setNewSubjectName] = useState('');
    const [isTouched, setIsTouched] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('recent_opened'); // recent_opened, recent_created, alpha_asc, alpha_desc
    const [isAdding, setIsAdding] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const isActiveDashboard = location.pathname === '/dashboard';

    useEffect(() => {
        fetchSubjects().catch(() => { });
    }, [fetchSubjects, user]);

    // Client-side filtering and sorting
    const filteredAndSortedSubjects = React.useMemo(() => {
        let result = [...subjects];

        // 1. Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.description && s.description.toLowerCase().includes(query))
            );
        }

        // 2. Sorting Logic
        result.sort((a, b) => {
            switch (filterType) {
                case 'alpha_asc':
                    return a.name.localeCompare(b.name);
                case 'alpha_desc':
                    return b.name.localeCompare(a.name);
                case 'recent_created':
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                case 'recent_opened':
                default: {
                    const dateA = new Date(a.lastActivityAt || a.last_activity_at || a.updated_at || a.created_at || 0);
                    const dateB = new Date(b.lastActivityAt || b.last_activity_at || b.updated_at || b.created_at || 0);
                    return dateB - dateA;
                }
            }
        });

        return result;
    }, [subjects, searchQuery, filterType]);

    const runValidation = (value) => {
        const result = validateName(value);
        setFieldError(result.valid ? '' : result.message);
        return result.valid;
    };

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        setIsTouched(true);
        if (!runValidation(newSubjectName)) return;

        try {
            await createSubject(newSubjectName.trim());
            setNewSubjectName('');
            setIsTouched(false);
            setIsAdding(false);
            toast.success(`Subject "${newSubjectName.trim()}" created!`);
        } catch (err) {
            if (err.fieldErrors?.name) {
                setFieldError(err.fieldErrors.name);
            } else {
                toast.error(err.message || 'Failed to create subject');
            }
        }
    };

    const handleDeleteSubject = (id, name) => {
        setModalConfig({
            title: 'Delete Subject?',
            message: `Are you sure you want to delete "${name}"? This will permanently remove all materials inside.`,
            type: 'warning',
            confirmText: 'Delete Forever',
            onConfirm: async () => {
                try {
                    await subjectService.delete(id);
                    await fetchSubjects();
                    toast.success('Subject deleted');
                } catch {
                    toast.error('Failed to delete subject');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const handleRenameSubject = (id, currentName) => {
        setModalConfig({
            title: 'Rename Subject',
            message: 'Choose a new name for your study space.',
            type: 'prompt',
            defaultValue: currentName,
            confirmText: 'Save Changes',
            onConfirm: async (newName) => {
                if (!newName || newName === currentName) {
                    setIsModalOpen(false);
                    return;
                }
                try {
                    await subjectService.rename(id, newName);
                    toast.success('Subject renamed');
                    fetchSubjects();
                } catch (err) {
                    toast.error(err.message || 'Failed to rename subject');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const errorVisible = (isTouched && fieldError) || uiError;

    return (
        <div className="dashboard-page flex h-full w-full bg-[var(--c-canvas)] animate-in fade-in duration-700">
            {/* ── Sidebar ── */}
            <aside className="hidden lg:flex flex-col w-[300px] h-full bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-950 text-white p-6 shadow-2xl shadow-indigo-900/50 relative overflow-hidden shrink-0 rounded-tr-[3rem] rounded-br-[3rem] border-r-4 border-indigo-500/30">
                <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-neural pointer-events-none"></div>
                <div className="absolute bottom-[-50px] left-[-50px] w-64 h-64 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-neural pointer-events-none" style={{ animationDelay: '1s' }}></div>
                
                <div className="relative z-10 flex items-center gap-3 mb-10 pt-4">
                   <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-pink-500/40">
                       <Brain className="w-7 h-7 text-white" />
                   </div>
                   <h2 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-pink-200">Cognify</h2>
                </div>

                <nav className="relative z-10 flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
                    <div className="text-[10px] items-center gap-2 uppercase tracking-widest font-black text-indigo-300 mb-2 flex mt-4 opacity-70"><Sparkles className="w-3 h-3"/> Navigation</div>
                    
                    <Link
                        to="/dashboard"
                        className={cn(
                            "flex items-center gap-3 px-5 py-4 rounded-[1.5rem] font-bold transition-all duration-300 group hover:scale-105 hover:-translate-y-1",
                            isActiveDashboard
                                ? "bg-white/10 text-white backdrop-blur-md border border-white/20 shadow-xl shadow-purple-900/50"
                                : "text-indigo-200 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <div className={cn("p-2.5 rounded-xl transition-transform shadow-inner", isActiveDashboard ? "bg-gradient-to-br from-indigo-400 to-purple-500 group-hover:rotate-12" : "bg-white/5 group-hover:bg-white/10")}>
                            <Layers className="w-4 h-4 text-white" />
                        </div>
                        My Garden
                    </Link>

                    <Link
                        to="/trash"
                        className={cn(
                            "flex items-center gap-3 px-5 py-4 rounded-[1.5rem] font-bold transition-all duration-300 group hover:scale-105 hover:-translate-y-1",
                            location.pathname === '/trash'
                                ? "bg-white/10 text-white backdrop-blur-md border border-white/20 shadow-xl shadow-purple-900/50"
                                : "text-indigo-200 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <div className={cn("p-2.5 rounded-xl transition-transform shadow-inner", location.pathname === '/trash' ? "bg-gradient-to-br from-red-400 to-rose-500 group-hover:rotate-12" : "bg-white/5 group-hover:bg-white/10")}>
                            <Trash className="w-4 h-4 text-white" />
                        </div>
                        Trash
                    </Link>


                    <div className="pt-6 border-t border-white/10">
                        <div className="text-[10px] items-center gap-2 uppercase tracking-widest font-black text-indigo-300 mb-4 flex opacity-70"><BookOpen className="w-3 h-3"/> Your Spaces</div>
                        <div className="space-y-1">
                            {subjects.slice(0, 8).map(s => (
                                <Link 
                                    key={s.id} 
                                    to={`/subjects/${s.id}`}
                                    className="flex items-center gap-3 px-4 py-2 text-sm text-indigo-100 hover:text-white hover:bg-white/5 rounded-xl transition-colors group"
                                >
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform" />
                                    <span className="truncate">{s.name}</span>
                                </Link>
                            ))}
                            {subjects.length > 8 && (
                                <p className="text-[10px] text-indigo-300 font-bold ml-4 mt-2">+{subjects.length - 8} more hidden</p>
                            )}
                        </div>
                    </div>

                    <div className="pt-6">
                        <button
                            onClick={() => requireAuth(() => setIsAdding(true))}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] shadow-lg shadow-pink-900/40 hover:scale-105 active:scale-95 transition-all group"
                        >
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                            New Subject
                        </button>
                    </div>
                </nav>

                <div className="relative z-10 mt-auto p-6 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-md hover:scale-105 transition-transform duration-300 shadow-xl">
                   <p className="text-[10px] font-black text-pink-300 uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles className="w-3 h-3"/> Level Up</p>
                   <p className="text-sm text-white/95 font-bold mb-4 leading-relaxed">Your knowledge tree is blossoming wonderfully today!</p>
                   <div className="w-full bg-indigo-950/50 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
                       <div className="bg-gradient-to-r from-pink-400 to-purple-400 h-full w-[70%] rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                   </div>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 max-w-6xl mx-auto px-6 py-12 h-full overflow-y-auto custom-scrollbar relative">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 select-none pointer-events-none animate-neural"></div>

                {/* Welcome Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 group relative z-10">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 font-black text-[11px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--c-primary)' }}>
                            <div className="w-2.5 h-2.5 rounded-full anim-pulse" style={{ background: 'var(--c-accent)' }}></div>
                            <span>Active Dashboard</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black mb-2">
                            Hello, <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--c-primary)] to-[var(--c-accent)]">{user?.name?.split(' ')[0] || 'Scholar'}</span> <span className="inline-block animate-bounce origin-bottom text-4xl ml-2">👋</span>
                        </h1>
                        <p className="text-lg font-medium text-gray-500">Your cognitive garden is thriving. Ready to explore?</p>
                    </div>
                </div>

            {/* Quick Add Form (Inline) */}
            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        className="mb-8 overflow-hidden"
                    >
                        <div className="p-6 bg-white border rounded-xl relative shadow-sm" style={{ borderColor: 'var(--c-border)' }}>
                            <button
                                onClick={() => {
                                    setIsAdding(false);
                                    setIsTouched(false);
                                    setFieldError('');
                                    clearUIError('createSubject');
                                }}
                                className="absolute top-6 right-6 p-2 rounded-xl transition-all hover:bg-gray-100"
                                style={{ color: 'var(--c-text-muted)' }}
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--c-primary-light)' }}>
                                    <Plus className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                </div>
                                Create New Study Space
                            </h3>

                            <form onSubmit={handleCreateSubject} className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-grow">
                                    <input
                                        type="text"
                                        className={`input-field h-14 text-lg ${errorVisible ? '!border-red-400 !ring-4 !ring-red-50' : ''}`}
                                        placeholder="Enter subject name (e.g. Molecular Biology)"
                                        value={newSubjectName}
                                        onChange={(e) => {
                                            setNewSubjectName(e.target.value);
                                            if (isTouched) runValidation(e.target.value);
                                            if (uiError) clearUIError('createSubject');
                                        }}
                                        onBlur={() => {
                                            setIsTouched(true);
                                            runValidation(newSubjectName);
                                        }}
                                        autoFocus
                                        disabled={loading}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        className="btn-primary px-10 h-14 min-w-[180px]"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block align-middle"></div>
                                                <span className="align-middle">Creating...</span>
                                            </>
                                        ) : 'Create Now'}
                                    </button>
                                </div>
                            </form>
                            {errorVisible && (
                                <p className="mt-4 text-sm text-red-500 font-medium ml-1 flex items-center gap-1 animate-in slide-in-from-top-1">
                                    <X className="w-4 h-4" /> {fieldError || uiError}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Controls Row: Search & Filter */}
            <div className="flex flex-col lg:flex-row gap-4 mb-8 items-center justify-between">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <h2 className="tracking-tight whitespace-nowrap">Your Spaces</h2>
                    <div className="h-px flex-grow hidden lg:block min-w-[60px]" style={{ background: 'var(--c-border)' }}></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border opacity-80" style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-secondary)', borderColor: 'var(--c-border)' }}>
                        {subjects.length} Total
                    </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    {/* Search Bar */}
                    <div className="relative group w-full sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: 'var(--c-text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Find a subject..."
                            className="input-field pl-12 h-12 text-sm font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative group w-full sm:w-64">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none" style={{ color: 'var(--c-text-muted)' }} />
                        <select
                            className="input-field pl-12 h-12 text-sm font-semibold bg-white pr-10 appearance-none cursor-pointer"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="recent_opened">Recently Active</option>
                            <option value="recent_created">Recently Created</option>
                            <option value="alpha_asc">Alphabetical (A-Z)</option>
                            <option value="alpha_desc">Alphabetical (Z-A)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--c-text-muted)' }}>
                            <SortAsc className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="responsive-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card-minimal h-[280px] flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <Skeleton variant="circle" className="w-12 h-12" />
                                <div className="flex gap-2">
                                    <Skeleton className="w-8 h-8 rounded-xl" />
                                    <Skeleton className="w-8 h-8 rounded-xl" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                            <div className="flex justify-between items-center pt-6 mt-6 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : fetchError ? (
                <div className="p-12 text-center rounded-[2rem] glass-card" style={{ background: 'var(--c-danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--c-danger)' }}>
                        <X className="w-8 h-8" />
                    </div>
                    <p className="mb-6 font-bold text-lg" style={{ color: 'var(--c-danger)' }}>{fetchError}</p>
                    <button onClick={fetchSubjects} className="btn-primary" style={{ background: 'var(--c-danger)' }}>Reconnect to Backend</button>
                </div>
            ) : subjects.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-20 text-center rounded-[2rem] flex flex-col items-center glass-card border border-dashed"
                >
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
                        <Plus className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">
                        {(isPublic && !user) ? 'Welcome to Cognify' : 'A clean slate awaits'}
                    </h3>
                    <p className="mb-10 font-medium text-lg max-w-sm" style={{ color: 'var(--c-text-muted)' }}>
                        {(isPublic && !user)
                            ? 'Log in to create your first space and start organizing your knowledge.'
                            : 'Create your first subject to start organizing your knowledge with AI power.'}
                    </p>
                    {(isPublic && !user) ? (
                        <Link to="/login" className="btn-vibrant px-12 py-4">Log In to Cognify</Link>
                    ) : (
                        <button onClick={() => setIsAdding(true)} className="btn-vibrant px-12 py-4">Initialize First Subject</button>
                    )}
                </motion.div>
            ) : (
                <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: {
                            opacity: 1,
                            transition: {
                                staggerChildren: 0.05
                            }
                        }
                    }}
                    className="responsive-grid"
                >
                    {filteredAndSortedSubjects.length === 0 ? (
                        <div className="col-span-full p-20 text-center rounded-[2rem] glass-card">
                            <Search className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--c-border)' }} />
                            <p className="text-xl font-bold mb-2" style={{ color: 'var(--c-text-secondary)' }}>No matches found</p>
                            <p className="mb-6" style={{ color: 'var(--c-text-muted)' }}>We couldn't find any subjects matching "{searchQuery}"</p>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="font-bold transition-colors hover:underline underline-offset-4"
                                style={{ color: 'var(--c-primary)' }}
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {filteredAndSortedSubjects.map((subject) => (
                                    <motion.div
                                        key={subject.id}
                                        initial="hidden"
                                        animate="show"
                                        variants={{
                                            hidden: { opacity: 0, y: 30, scale: 0.95 },
                                            show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 15 } }
                                        }}
                                        layout
                                        onClick={() => navigate(`/subjects/${subject.id}`)}
                                        className="card-minimal flex flex-col group h-[280px] p-8 border-4 border-transparent hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer relative overflow-hidden transition-all duration-300"
                                        style={{
                                            background: 'linear-gradient(135deg, #ffffff 0%, #FAFAFF 100%)',
                                        }}
                                    >
                                    {/* Decoration layer inside card */}
                                    <div className="absolute top-[-30px] right-[-30px] w-28 h-28 bg-[var(--c-primary-light)] rounded-full mix-blend-multiply opacity-50 group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>

                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-md group-hover:shadow-[var(--c-primary-light)] group-hover:rotate-12" style={{ background: 'var(--c-primary)', color: 'white' }}>
                                            <span className="font-black text-2xl transition-colors duration-300">
                                                {subject.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); requireAuth(() => handleRenameSubject(subject.id, subject.name)); }}
                                                className="p-2.5 bg-white/80 backdrop-blur-md rounded-[1rem] shadow-sm hover:shadow-md transition-all hover:bg-white text-gray-500 hover:text-[var(--c-primary)]"
                                                title={(isPublic && !user) ? 'Login required' : 'Rename'}
                                            >
                                                {(isPublic && !user) ? <Lock className="w-4 h-4 opacity-50" /> : <Edit2 className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); requireAuth(() => handleDeleteSubject(subject.id, subject.name)); }}
                                                className="p-2.5 bg-white/80 backdrop-blur-md rounded-[1rem] shadow-sm hover:shadow-md transition-all hover:bg-red-50 text-gray-500 hover:text-red-500"
                                                title={(isPublic && !user) ? 'Login required' : 'Delete'}
                                            >
                                                {(isPublic && !user) ? <Lock className="w-4 h-4 opacity-50" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-grow relative z-10">
                                        <h3 className="text-2xl font-black mb-3 transition-colors leading-tight tracking-tight line-clamp-1 group-hover:text-[var(--c-primary)]">
                                            {subject.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 mb-4">
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border-2" style={{ background: 'var(--c-accent-light)', color: 'var(--c-accent)', borderColor: 'rgba(244, 63, 94, 0.15)' }}>
                                                <BookOpen className="w-3 h-3" />
                                                <span>{subject.material_count || 0} Sources</span>
                                            </div>
                                            {subject.lastActivityAt && (
                                                <div className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border-2" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)', borderColor: 'rgba(124, 92, 252, 0.15)' }}>
                                                    Active
                                                </div>
                                            )}
                                        </div>
                                        <p className="line-clamp-2" style={{ color: 'var(--c-text-secondary)' }}>
                                            {subject.description || "A clean space. Dive in and start adding your materials."}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center pt-5 mt-5 border-t relative z-10" style={{ borderColor: 'var(--c-border-soft)' }}>
                                        <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                            {formatDistanceToNow(new Date(subject.created_at || new Date()), { addSuffix: true })}
                                        </span>
                                        <Link
                                            to={`/subjects/${subject.id}`}
                                            className="px-4 py-2 bg-[var(--c-primary-light)] text-[var(--c-primary)] font-black text-sm rounded-[1rem] hover:bg-[var(--c-primary)] hover:text-white transition-colors duration-300 shadow-sm flex items-center gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Enter Space
                                        </Link>
                                    </div>
                                </motion.div>
                            ))}
                            <motion.button
                                variants={{
                                    hidden: { opacity: 0, scale: 0.95 },
                                    show: { opacity: 1, scale: 1 }
                                }}
                                onClick={() => requireAuth(() => setIsAdding(true))}
                                className="glass-card p-8 rounded-[2rem] flex flex-col items-center justify-center transition-all group h-full min-h-[260px] border-2 border-dashed hover:border-[var(--c-primary)] opacity-80 hover:opacity-100 cursor-pointer"
                                style={{ borderColor: 'var(--c-border)' }}
                            >
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all" style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                                    {(isPublic && !user) ? <Lock className="w-5 h-5 opacity-50" /> : <Plus className="w-6 h-6 transition-transform group-hover:rotate-90 group-hover:text-[var(--c-primary)]" />}
                                </div>
                                <span className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--c-text-secondary)' }}>{(isPublic && !user) ? 'Login to Add Space' : 'Add Subject'}</span>
                            </motion.button>
                        </>
                    )}
                </motion.div>
            )}
            {/* Custom Modal for Confirms/Prompts */}
            <CustomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                {...modalConfig}
            />

            <FloatingActionButton
                onClick={() => requireAuth(() => {
                    setIsAdding(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                })}
                icon={(isPublic && !user) ? Lock : Plus}
                label="New Subject"
            />
            </main>
        </div>
    );
};

export default Dashboard;
