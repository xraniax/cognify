import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await authService.forgotPassword(email);
            setSent(true);
            toast.success('Reset link sent to your email!');
        } catch (error) {
            toast.error(error.message || 'Failed to send reset link.');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div 
                onMouseMove={handleMouseMove}
                className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden"
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
                <Orb color="var(--c-fuchsia)" size="450px" top="-5%" left="50%" delay={8} opacity={0.15} />

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
                    className="w-full max-w-[440px] p-10 rounded-[3rem] relative z-10 backdrop-blur-3xl shadow-2xl overflow-hidden group text-center"
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
                    <div className="mb-6 text-green-500 relative z-10">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <motion.path 
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" 
                            />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-black mb-4 relative z-10" style={{ color: 'var(--c-text)' }}>Check your email</h2>
                    <p className="font-bold relative z-10 mb-8" style={{ color: 'var(--c-text-secondary)' }}>
                        We've sent a password reset link to <br/><span style={{ color: 'var(--c-primary)' }}>{email}</span>
                    </p>
                    <Link to="/login" className="btn-primary w-full relative z-10">
                        Back to Login
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div 
            onMouseMove={handleMouseMove}
            className="flex flex-col items-center justify-center min-ih-screen min-h-screen p-6 animate-in fade-in duration-700 relative overflow-hidden" 
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
                    <h1 className="mb-2 text-4xl font-black font-serif" style={{ color: 'var(--c-text)' }}>Forgot Password</h1>
                    <p className="font-bold" style={{ color: 'var(--c-text-secondary)' }}>Enter your email to receive a reset link</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: 'var(--c-text-muted)' }}>Email Address</label>
                        <input
                            type="email"
                            className="input-field"
                            placeholder="name@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block align-middle"></div>
                                <span className="align-middle">Sending link...</span>
                            </>
                        ) : 'Send Reset Link'}
                    </button>

                    <div className="text-center mt-8">
                        <Link to="/login" className="text-sm font-black transition-colors hover:underline underline-offset-4" style={{ color: 'var(--c-primary)' }}>
                            Back to Login
                        </Link>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;
