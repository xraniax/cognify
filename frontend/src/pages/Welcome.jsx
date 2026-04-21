import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Brain, Sparkles, BookOpen, Layers, ArrowRight, BookMarked } from 'lucide-react';
import { motion } from 'framer-motion';

const Welcome = () => {
    const user = useAuthStore((state) => state.data.user);

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-[calc(100vh-80px)] flex flex-col bg-gradient-to-br from-indigo-50 via-white to-pink-50 animate-in fade-in duration-700">
            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 relative">
                {/* Decorative background elements — overflow clipped independently */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply blur-[128px] opacity-40 animate-neural"></div>
                    <div className="absolute top-1/4 -right-32 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply blur-[128px] opacity-40 animate-neural" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="relative z-10 max-w-4xl mx-auto space-y-8 flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center justify-center p-1 rounded-full mb-6 bg-white/80 backdrop-blur-md border-2 shadow-sm border-purple-100 hover:border-purple-300 hover:shadow-purple-100 transition-all duration-300"
                    >
                        <div className="flex items-center gap-2 px-4 py-1.5 font-black text-[10px] uppercase tracking-[0.2em] text-[var(--c-primary)]">
                            <Sparkles className="w-4 h-4 text-pink-500 animate-pulse" />
                            <span>AI-Powered E-Learning</span>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-8xl font-black tracking-tight leading-[1.1] text-indigo-950"
                    >
                        Cultivate Your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 relative inline-block">
                            Cognitive Garden
                            <svg className="absolute w-full h-4 -bottom-2 left-0 text-pink-400 opacity-60" viewBox="0 0 100 20" preserveAspectRatio="none">
                                <path d="M0 10 Q 50 20 100 10" fill="transparent" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                            </svg>
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl md:text-2xl font-bold max-w-2xl leading-relaxed text-gray-500 mt-6"
                    >
                        Transform scattered documents and lecture notes into active, intelligent study spaces. Experience retrieval-augmented tutoring tailored exactly to your curriculum.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center gap-5 pt-8 w-full sm:w-auto"
                    >
                        <Link
                            to="/dashboard"
                            className="btn-vibrant w-full sm:w-auto group relative overflow-hidden text-lg"
                        >
                            <span className="relative z-10 font-bold flex items-center gap-2">
                                {user ? 'Go to Workspace' : 'Start Exploring'}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>

                        {!user && (
                            <div className="flex items-center gap-4 w-full sm:w-auto justify-center">
                                <Link
                                    to="/login"
                                    className="px-6 py-2.5 font-bold text-sm rounded-lg transition-all border shadow-sm hover:shadow-md"
                                    style={{ color: 'var(--c-text)', background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
                                >
                                    Log In
                                </Link>
                                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--c-text-muted)' }}>or</span>
                                <Link
                                    to="/dashboard"
                                    className="text-sm font-bold hover:underline underline-offset-4 decoration-2"
                                    style={{ color: 'var(--c-primary)' }}
                                >
                                    Try without account
                                </Link>
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>

            {/* Features Row */}
            <div className="py-20 relative z-10 bg-transparent">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="card-minimal space-y-4 hover:border-purple-200">
                        <div className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 text-purple-600 shadow-sm shadow-purple-200/50">
                            <Layers className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-black text-indigo-950">Curated Workspaces</h3>
                        <p className="font-medium text-gray-500 leading-relaxed text-lg">Organize your materials by subject and instantly locate relevant concepts without cognitive overload.</p>
                    </div>
                    
                    <div className="card-minimal space-y-4 hover:border-pink-200">
                        <div className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600 shadow-sm shadow-pink-200/50">
                            <Brain className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-black text-indigo-950">Contextual AI Tutor</h3>
                        <p className="font-medium text-gray-500 leading-relaxed text-lg">Ask questions and receive answers strictly grounded in your uploaded documents and notes.</p>
                    </div>

                    <div className="card-minimal space-y-4 hover:border-teal-200">
                        <div className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-600 shadow-sm shadow-teal-200/50">
                            <BookMarked className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-black text-indigo-950">Active Generation</h3>
                        <p className="font-medium text-gray-500 leading-relaxed text-lg">Automatically transform passive PDFs into interactive quizzes and intelligent summaries.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Welcome;
