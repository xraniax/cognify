import api from '@/services/api';

export const subjectService = {
    // Subject Management
    getAll: () => api.get('/subjects'),
    getOne: (id) => api.get(`/subjects/${id}`),
    create: (name, description) => api.post('/subjects', { name, description }),
    update: (id, name, description) => api.patch(`/subjects/${id}`, { name, description }),
    delete: (id) => api.delete(`/subjects/${id}`),
};

export default subjectService;
