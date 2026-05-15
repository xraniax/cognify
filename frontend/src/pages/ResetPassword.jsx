import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/features/auth/services/AuthService';
import toast from 'react-hot-toast';

const Orb = ({ color, size, top, left, delay, opacity = 0.15 }) => (
    <motion.div
        animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            scale: [1, 1.1, 1],
            rotate: [0, 45, 0],
        }}
        transition={{
            duration: 12,
            repeat: Infinity,
            delay: delay,
            ease: "easeInOut"
        }}
        className="absolute blur-[80px] rounded-full pointer-events-none z-0"
        style={{
            background: color,
            width: size,
            height: size,
            top: top,
            left: left,
            opacity: opacity
        }}
    />
);

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [isValid, setIsValid] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    useEffect(() => {
        const validateToken = async () => {
            try {
                await authService.validateResetToken(token);
                setIsValid(true);
            } catch (err) {
                setIsValid(false);
            } finally {
                setVerifying(false);
            }
        };
        validateToken();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return toast.error('Passwords do not match');
        }

        if (password.length < 8) {
            return toast.error('Password must be at least 8 characters');
        }

        setLoading(true);

        try {
            await authService.resetPassword(token, password);
            toast.success('Password updated successfully!');
            navigate('/login');
        } catch (error) {
            toast.error(error.message || 'Failed to reset password. Link may be invalid or expired.');
        } finally {
            setLoading(false);
        }
    };

    if (verifying) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--c-canvas)]">
                <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 border-4 border-[var(--c-primary-soft)] rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-[var(--c-primary)] rounded-full animate-spin"></div>
                </div>
                <span className="text-sm font-black uppercase tracking-widest text-gray-500">Verifying link...</span>
            </div>
        );
    }

    if (isValid === false) {
        return (
            <div 
                onMouseMove={handleMouseMove}
                className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden"
                style={{ 
                    background: 'var(--c-canvas)',
                    backgroundImage: `
                        radial-gradient(circle at 10% 20%, rgba(99, 91, 255, 0.15), transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(244, 63, 94, 0.15), transparent 40%)
                    ` 
                }}
            >
                <Orb color="var(--c-rose)" size="500px" top="-10%" left="-10%" delay={0} opacity={0.15} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-[440px] p-10 rounded-[3rem] relative z-10 backdrop-blur-3xl shadow-2xl overflow-hidden group text-center"
                    style={{ background: 'rgba(255, 255, 255, 0.82)', border: '1px solid rgba(255, 255, 255, 0.4)' }}
                >
                    <div className="mb-6 text-red-500">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-black mb-4" style={{ color: 'var(--c-text)' }}>Invalid Link</h2>
                    <p className="font-bold mb-8" style={{ color: 'var(--c-text-secondary)' }}>
                        This password reset link is no longer valid.
                    </p>
                    <Link to="/forgot-password" virtual-dom-link="true" className="btn-primary w-full">
                        Resend Reset Link
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div 
            onMouseMove={handleMouseMove}
            className="flex flex-col items-center justify-center min-h-screen p-6 animate-in fade-in duration-700 relative overflow-hidden" 
            style={{ 
                background: 'var(--c-canvas)',
                backgroundImage: `
                    radial-gradient(circle at 10% 20%, rgba(99, 91, 255, 0.15), transparent 40%),
                    radial-gradient(circle at 90% 80%, rgba(244, 63, 94, 0.15), transparent 40%),
                    radial-gradient(circle at 50% 50%, rgba(16, 184, 213, 0.1), transparent 50%),
                    radial-gradient(circle at 80% 10%, rgba(245, 166, 35, 0.1), transparent 40%)
                ` 
            }}
        >
            {/* High-Vibrancy Ambient Elements */}
            <Orb color="var(--c-primary)" size="500px" top="-15%" left="-10%" delay={0} opacity={0.2} />
            <Orb color="var(--c-rose)" size="400px" top="60%" left="75%" delay={2} opacity={0.15} />
            <Orb color="var(--c-teal)" size="350px" top="20%" left="60%" delay={4} opacity={0.12} />
            
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--c-primary) 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

            {/* Global Cursor Glow */}
            <motion.div
                className="pointer-events-none absolute inset-0 z-0 opacity-50 transition-opacity duration-500"
                style={{
                    background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, var(--c-primary-soft), transparent 45%)`
                }}
            />

            <motion.div 
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className={`w-full max-w-[440px] p-10 rounded-[3rem] relative z-10 backdrop-blur-3xl shadow-2xl overflow-hidden group ${loading ? 'opacity-70' : ''}`}
                style={{ 
                    background: 'rgba(255, 255, 255, 0.82)', 
                    border: '1px solid rgba(255, 255, 255, 0.4)', 
                }}
            >
                {/* Rainbow Border Glow Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-700" 
                     style={{ 
                         padding: '1px',
                         background: 'linear-gradient(45deg, #635bff, #f43f5e, #f59e0b, #10b981, #3baaff, #635bff)',
                         backgroundSize: '400% 400%',
                         WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                         WebkitMaskComposite: 'xor',
                         maskComposite: 'exclude',
                         animation: 'gradient-shift 8s linear infinite'
                     }}
                />
                <div className="text-center mb-10">
                    <h1 className="mb-2 text-4xl font-black font-serif" style={{ color: 'var(--c-text)' }}>New Password</h1>
                    <p className="font-bold" style={{ color: 'var(--c-text-secondary)' }}>Create a secure password</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: 'var(--c-text-muted)' }}>New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input-field pr-12"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors focus:outline-none"
                                style={{ color: 'var(--c-text-muted)' }}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5 hover:text-[var(--c-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 hover:text-[var(--c-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: 'var(--c-text-muted)' }}>Confirm Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className={`input-field ${password && confirmPassword && password !== confirmPassword ? '!border-red-400 !ring-4 !ring-red-50' : ''}`}
                            placeholder="••••••••"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full mt-4" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block align-middle"></div>
                                <span className="align-middle">Resetting...</span>
                            </>
                        ) : 'Reset Password'}
                    </button>

                    <div className="text-center mt-8">
                        <Link to="/login" className="text-sm font-black transition-colors hover:underline underline-offset-4" style={{ color: 'var(--c-primary)' }}>
                            Cancel
                        </Link>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default ResetPassword;
