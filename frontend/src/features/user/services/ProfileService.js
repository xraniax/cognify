import api from '@/services/api';

export const profileService = {
    getProfile: () => api.get('/profile'),
    updateProfile: (data) => api.put('/profile', data),
    deleteProfile: () => api.delete('/profile'),
};

export default profileService;
