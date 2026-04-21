import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, User as UserIcon, LayoutDashboard, UserCircle, LogOut, Shield } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
    const user = useAuthStore((state) => state.data.user);
    const logout = useAuthStore((state) => state.actions.logout);
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        setIsMobileMenuOpen(false);
        navigate('/login');
    };

    const navLinks = [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <header className="py-3 px-6 border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300" style={{ borderColor: 'var(--c-border-soft)' }}>
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500"
                        style={{ background: 'linear-gradient(135deg, var(--c-primary-light) 0%, var(--c-primary-ultra) 100%)' }}>
                        <div className="w-3 h-3 rounded-full transition-all duration-500 group-hover:scale-110"
                            style={{ background: 'var(--c-primary)' }} />
                    </span>
                    <span className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--c-text)' }}>Cognify</span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-1">
                    {user ? (
                        <>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className="relative px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2"
                                    style={{
                                        color: isActive(link.path) ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                        background: isActive(link.path) ? 'var(--c-primary-ultra)' : 'transparent',
                                    }}
                                >
                                    <link.icon className="w-4 h-4" />
                                    {link.label}
                                    {isActive(link.path) && (
                                        <motion.div
                                            layoutId="nav-active"
                                            className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                                            style={{ background: 'var(--c-primary)' }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                </Link>
                            ))}

                            {user.role === 'admin' && (
                                <Link
                                    to="/admin"
                                    className="ml-2 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wide transition-all"
                                    style={{
                                        background: 'var(--c-primary-light)',
                                        color: 'var(--c-primary)',
                                        border: '1px solid rgba(124, 92, 252, 0.15)',
                                    }}
                                >
                                    <Shield className="w-3 h-3" />
                                    Admin
                                </Link>
                            )}

                            <div className="h-5 w-px mx-3" style={{ background: 'var(--c-border)' }} />

                            <div className="flex items-center gap-2">
                                <Link
                                    to="/profile"
                                    className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 shadow-sm hover:shadow hover:scale-105 active:scale-95"
                                    style={{
                                        background: isActive('/profile') ? 'var(--c-primary-light)' : 'var(--c-surface-alt)',
                                        color: isActive('/profile') ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                        border: isActive('/profile') ? '1.5px solid var(--c-primary-soft)' : '1px solid var(--c-border-soft)',
                                    }}
                                    title="View Profile"
                                >
                                    <UserIcon className="w-5 h-5" />
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all duration-200 hover:bg-red-50 text-red-400 hover:text-red-600"
                                >
                                    Sign out
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link
                                to="/login"
                                className="text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 hover:bg-gray-50"
                                style={{ color: 'var(--c-text-secondary)' }}
                            >
                                Log In
                            </Link>
                            <Link to="/register" className="btn-vibrant px-6 py-2.5 text-xs">
                                Get Started
                            </Link>
                        </div>
                    )}
                </nav>

                {/* Mobile Hamburger */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 rounded-xl transition-all"
                    style={{ color: 'var(--c-text-muted)' }}
                >
                    {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile Menu Drawer */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/15 backdrop-blur-sm z-40 md:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                            className="fixed top-0 right-0 h-full w-4/5 max-w-sm bg-white z-50 md:hidden flex flex-col p-8"
                            style={{ boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.08)' }}
                        >
                            <div className="flex justify-between items-center mb-10">
                                <span className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--c-text)' }}>Menu</span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 rounded-xl"
                                    style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col gap-3">
                                {user ? (
                                    <>
                                        {navLinks.map((link) => (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="flex items-center gap-4 p-4 rounded-2xl transition-all group"
                                                style={{
                                                    background: isActive(link.path) ? 'var(--c-primary-ultra)' : 'var(--c-surface-alt)',
                                                    color: isActive(link.path) ? 'var(--c-primary)' : 'var(--c-text)',
                                                }}
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center transition-all"
                                                    style={{ boxShadow: 'var(--shadow-xs)', color: isActive(link.path) ? 'var(--c-primary)' : 'var(--c-text-muted)' }}>
                                                    <link.icon className="w-5 h-5" />
                                                </div>
                                                <span className="font-semibold">{link.label}</span>
                                            </Link>
                                        ))}
                                        <Link
                                            to="/profile"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="flex items-center gap-4 p-4 rounded-2xl transition-all group"
                                            style={{
                                                background: isActive('/profile') ? 'var(--c-primary-ultra)' : 'var(--c-surface-alt)',
                                                color: isActive('/profile') ? 'var(--c-primary)' : 'var(--c-text)',
                                            }}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center transition-all"
                                                style={{ boxShadow: 'var(--shadow-xs)', color: isActive('/profile') ? 'var(--c-primary)' : 'var(--c-text-muted)' }}>
                                                <UserCircle className="w-5 h-5" />
                                            </div>
                                            <span className="font-semibold">My Profile</span>
                                        </Link>
                                        {user.role === 'admin' && (
                                            <Link
                                                to="/admin"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="flex items-center gap-4 p-4 rounded-2xl font-semibold"
                                                style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center" style={{ boxShadow: 'var(--shadow-xs)' }}>
                                                    <Shield className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                                </div>
                                                Admin Console
                                            </Link>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to="/login"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="p-4 rounded-2xl font-semibold text-center"
                                            style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text)' }}
                                        >
                                            Log In
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="btn-vibrant p-4 rounded-2xl text-center shadow-none"
                                        >
                                            Get Started
                                        </Link>
                                    </>
                                )}
                            </div>

                            {user && (
                                <button
                                    onClick={handleLogout}
                                    className="mt-auto flex items-center gap-4 p-4 rounded-2xl font-semibold transition-all"
                                    style={{ background: 'var(--c-danger-light)', color: 'var(--c-danger)' }}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center" style={{ boxShadow: 'var(--shadow-xs)' }}>
                                        <LogOut className="w-5 h-5" />
                                    </div>
                                    Sign Out
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
};

export default Navbar;
