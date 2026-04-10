import api from '@/services/api';

export const subjectService = {
    // Subject Management
    getAll: () => api.get('/subjects'),
    getOne: (id) => api.get(`/subjects/${id}`),
    create: (name, description) => api.post('/subjects', { name, description }),
    rename: (id, name) => api.patch(`/subjects/${id}`, { name }),
    delete: (id) => api.delete(`/subjects/${id}`),
};

export default subjectService;
