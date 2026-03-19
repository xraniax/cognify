import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import toast from 'react-hot-toast';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [isValid, setIsValid] = useState(null);

    React.useEffect(() => {
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
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Verifying reset link...</span>
            </div>
        );
    }

    if (isValid === false) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
                <div className="w-full max-w-sm border border-gray-200 p-6 rounded shadow-sm bg-white text-center">
                    <div className="mb-4 text-red-500">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
                    <p className="text-gray-600 mb-6">
                        This password reset link is no longer valid. Please request a new one.
                    </p>
                    <Link to="/forgot-password" virtual-dom-link="true" className="btn-primary inline-block w-full">
                        Resend Reset Link
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <div className="w-full max-w-sm border border-gray-200 p-6 rounded shadow-sm bg-white">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1">New Password</h1>
                    <p className="text-gray-600 text-sm">Create a secure password for your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="input-label">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input-field pr-10"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="input-label">Confirm New Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="input-field"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                        {loading ? 'Updating...' : 'Reset Password'}
                    </button>

                    <div className="text-center mt-4">
                        <Link to="/login" className="text-sm text-blue-600 hover:underline">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
