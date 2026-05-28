import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, User, Calendar, Bell, Pencil, X, Check, Loader2 } from 'lucide-react';

import { profileService } from '@/features/user/services/ProfileService';
import { useAuth } from '@/hooks/AuthContext';
import { useUIStore } from '@/store/useUIStore';
import Orb from '@/pages/dashboard/Orb';
import toast from 'react-hot-toast';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } };
const stagger = { animate: { transition: { staggerChildren: 0.08 } } };

const InfoField = ({ icon: Icon, label, value, accent }) => (
    <motion.div
        variants={fadeUp}
        className="group relative flex items-center gap-4 p-5 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', boxShadow: 'var(--shadow-xs)' }}
    >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" style={{ background: `${accent}08` }} />
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative" style={{ background: `${accent}15`, color: accent }}>
            <Icon className="w-4.5 h-4.5" size={18} />
        </div>
        <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
            <p className="font-semibold text-[15px]" style={{ color: 'var(--c-text)' }}>{value}</p>
        </div>
    </motion.div>
);

const Profile = () => {
    const { user, updateUser } = useAuth();

    const [profileData, setProfileData] = useState(null);
    const uiLoading = useUIStore(state => state.data.loadingStates['profile']?.loading || false);
    const uiActions = useUIStore(state => state.actions);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', notifications: true });
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchProfile(); }, []);

    const fetchProfile = async () => {
        try {
            uiActions.setLoading('profile', true, 'Loading your data...', false);
            const res = await profileService.getProfile();
            setProfileData(res.data.data);
            setEditForm({
                name: res.data.data.basic_info.name || '',
                notifications: res.data.data.settings.notifications ?? true,
            });
        } catch (err) {
            toast.error(err.message || 'Failed to load profile');
        } finally {
            uiActions.setLoading('profile', false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updates = {
                name: editForm.name,
                settings: { ...profileData.settings, notifications: editForm.notifications }
            };
            const res = await profileService.updateProfile(updates);
            setProfileData(prev => ({
                ...prev,
                basic_info: { ...prev.basic_info, name: res.data.data.name },
                settings: res.data.data.settings
            }));
            updateUser({ ...user, name: res.data.data.name });
            toast.success('Profile updated');
            setIsEditing(false);
        } catch (err) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (uiLoading && !profileData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: 'var(--c-canvas)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--c-primary-light)' }}>
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--c-primary)' }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-muted)' }}>Loading profile…</p>
            </div>
        );
    }

    if (!profileData) return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="font-semibold" style={{ color: 'var(--c-text-secondary)' }}>Couldn't load your profile.</p>
            <button onClick={fetchProfile} className="btn btn-md btn-solid">Retry</button>
        </div>
    );

    const { basic_info, settings } = profileData;

    return (
        <div className="min-h-full overflow-y-auto" style={{ background: 'var(--c-canvas)' }}>

            {/* ── Hero ── */}
            <div className="relative h-52 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(168,85,247,0.08) 50%, rgba(59,130,246,0.10) 100%)' }}>
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(var(--c-primary-muted) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.12 }} />
                <Orb style={{ background: 'var(--grad-primary)', top: '10%', left: '4%' }}  size={140} delay={0}   opacity={0.15} />
                <Orb style={{ background: 'var(--grad-candy)',   top: '5%',  right: '6%' }} size={100} delay={1.5} opacity={0.12} />
                <Orb style={{ background: 'var(--grad-cool)',    bottom: '0%', left: '40%' }} size={160} delay={2.5} opacity={0.10} />
                <div className="absolute bottom-0 left-0 right-0 h-24" style={{ background: 'linear-gradient(to top, var(--c-canvas), transparent)' }} />
            </div>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-16 pb-16 relative z-10">

                {/* ── Avatar card ── */}
                <motion.div {...fadeUp} className="relative flex flex-col items-center text-center mb-8">
                    {/* avatar ring */}
                    <div className="p-1 rounded-full mb-5" style={{ background: 'var(--grad-primary)', boxShadow: 'var(--shadow-primary)' }}>
                        <div className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden" style={{ background: 'var(--c-primary-ultra)', color: 'var(--c-primary)', border: '4px solid var(--c-surface)' }}>
                            {basic_info.avatar_url ? (
                                <img src={basic_info.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-5xl font-black font-serif select-none">
                                    {basic_info.name?.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>

                    <h1 className="text-3xl font-black tracking-tight mb-1 text-gradient font-serif">{basic_info.name}</h1>
                    <p className="font-medium mb-3" style={{ color: 'var(--c-text-muted)' }}>{basic_info.email}</p>
                    <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest" style={{ background: 'var(--c-success-light)', color: 'var(--c-success)' }}>
                        {basic_info.role}
                    </span>
                </motion.div>

                {/* ── Main card ── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-3xl overflow-hidden"
                    style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', boxShadow: 'var(--shadow-md)' }}
                >
                    {/* Card header */}
                    <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
                                <User size={15} />
                            </div>
                            <h2 className="font-bold text-[15px]" style={{ color: 'var(--c-text)' }}>
                                {isEditing ? 'Edit Profile' : 'Basic Information'}
                            </h2>
                        </div>
                        {!isEditing && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                                style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)', border: '1px solid rgba(124,58,237,0.15)' }}
                            >
                                <Pencil size={13} />
                                Edit Profile
                            </motion.button>
                        )}
                        {isEditing && (
                            <button
                                onClick={() => setIsEditing(false)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                                style={{ color: 'var(--c-text-muted)' }}
                                disabled={saving}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="p-8">
                        {isEditing ? (
                            <form onSubmit={handleSave} className="space-y-5">
                                {/* Name field */}
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--c-text-muted)' }}>Full Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="input-field"
                                        required
                                        disabled={saving}
                                        autoFocus
                                    />
                                </div>

                                {/* Email (read-only) */}
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--c-text-muted)' }}>Email Address</label>
                                    <input type="email" value={basic_info.email} className="input-field opacity-50 cursor-not-allowed" disabled />
                                    <p className="text-xs mt-1.5 ml-1" style={{ color: 'var(--c-text-placeholder)' }}>Email cannot be changed.</p>
                                </div>

                                {/* Notifications toggle */}
                                <div className="flex items-center justify-between p-5 rounded-2xl" style={{ background: 'var(--c-surface-alt)', border: '1px solid var(--c-border-soft)' }}>
                                    <div>
                                        <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Email Notifications</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>Receive alerts about courses and quizzes.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.notifications}
                                            onChange={e => setEditForm(prev => ({ ...prev, notifications: e.target.checked }))}
                                            className="sr-only peer"
                                            disabled={saving}
                                        />
                                        <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all transition-colors duration-200"
                                            style={{ backgroundColor: editForm.notifications ? 'var(--c-primary)' : '#E4E4E7' }}
                                        />
                                    </label>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setIsEditing(false)} disabled={saving}
                                        className="btn btn-md btn-secondary">
                                        Cancel
                                    </button>
                                    <motion.button
                                        type="submit"
                                        disabled={saving}
                                        whileTap={{ scale: 0.97 }}
                                        className="btn btn-md btn-solid flex items-center gap-2"
                                    >
                                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                        {saving ? 'Saving…' : 'Save Changes'}
                                    </motion.button>
                                </div>
                            </form>
                        ) : (
                            <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <InfoField icon={User}     label="Full Name"     value={basic_info.name}  accent="var(--c-primary)" />
                                <InfoField icon={Mail}     label="Email"         value={basic_info.email} accent="var(--c-teal)" />
                                <InfoField icon={Calendar} label="Member Since"  value={new Date(basic_info.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} accent="var(--c-amber)" />
                                <InfoField icon={Bell}     label="Notifications" value={settings.notifications ? 'Enabled' : 'Disabled'} accent={settings.notifications ? 'var(--c-success)' : 'var(--c-text-muted)'} />
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Profile;
