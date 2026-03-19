import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

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
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
                <div className="w-full max-w-sm border border-gray-200 p-6 rounded shadow-sm bg-white text-center">
                    <div className="mb-4 text-green-500">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Check your email</h2>
                    <p className="text-gray-600 mb-4">
                        We've sent a password reset link to <strong>{email}</strong>.
                    </p>
                    <button
                        onClick={() => setSent(false)}
                        className="text-sm text-blue-600 hover:underline mb-6 block mx-auto focus:outline-none"
                    >
                        Didn't receive the email? Send again
                    </button>
                    <Link to="/login" className="btn-primary inline-block w-full">
                        Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <div className="w-full max-w-sm border border-gray-200 p-6 rounded shadow-sm bg-white">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1">Forgot Password</h1>
                    <p className="text-gray-600 text-sm">Enter your email to receive a reset link</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="input-label">Email Address</label>
                        <input
                            type="email"
                            className="input-field"
                            placeholder="name@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>

                    <div className="text-center mt-4">
                        <Link to="/login" className="text-sm text-blue-600 hover:underline">
                            Back to Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
