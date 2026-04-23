import api from '@/services/api';

/**
 * MaterialService
 * Orchestrates all material-related API interactions including uploads, 
 * generation, streaming, and lifecycle management (trash/recovery).
 */

export const MaterialService = {
    // Retrieval & Collections
    getHistory: () => api.get('/materials/history'),
    getTrash: () => api.get('/materials/trash'),
    getSettings: () => api.get('/materials/settings'),
    getOne: (id) => api.get(`/materials/${id}`),

    // Lifecycle Actions
    upload: (data) => {
        const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        return api.post('/materials/upload', data, config);
    },
    rename: (id, title) => api.patch(`/materials/${id}`, { title }),
    delete: (id) => api.delete(`/materials/${id}`),
    restore: (id) => api.post(`/materials/${id}/restore`),
    permanentDelete: (id) => api.delete(`/materials/${id}/permanent`),
    emptyTrash: () => api.delete('/materials/trash'),
    cancel: (id) => api.post(`/materials/${id}/cancel`),

    // AI Generation & Streaming
    generate: (materialIds, taskType, subjectId, genOptions) =>
        api.post('/materials/generate-combined', { materialIds, taskType, subjectId, genOptions }),

    generateStream: async (materialIds, taskType, subjectId, genOptions, signal) => {
        const token = localStorage.getItem('token');
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${API_URL}/materials/generate-combined/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ materialIds, taskType, subjectId, genOptions }),
            signal,
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(detail || `Stream failed with status ${response.status}`);
        }

        return response;
    },

    sync: (id, signal) => api.get(`/materials/${id}/sync`, { signal }),

    chat: (materialIds, question) => api.post('/materials/chat-combined', { materialIds, question }),

    /**
     * streamMaterial — Standardized cancellable async primitive for AI streams.
     */
    stream: async (id, signal, onChunk, onComplete, onError) => {
        const token = localStorage.getItem('token');
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const url = `${API_URL}/materials/${id}/stream`;

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
                signal,
            });

            if (!response.ok) {
                onError(new Error(`Stream failed with status ${response.status}`));
                return;
            }

            const decoder = new TextDecoder();
            for await (const rawChunk of response.body) {
                if (signal.aborted) return;

                const text = decoder.decode(rawChunk, { stream: true });
                for (const line of text.split('\n')) {
                    if (signal.aborted) return;
                    if (!line.startsWith('data: ')) continue;

                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.chunk) onChunk(parsed.chunk);
                        if (parsed.is_final) {
                            onComplete();
                            return;
                        }
                    } catch { /* parse error, skip chunk */ }
                }
            }
            onComplete();
        } catch (err) {
            if (err.name === 'AbortError') return;
            onError(err);
        }
    },

    // Exams (System Insights)
    generateExam: (payload) => api.post('/exams/generate', payload),
    saveAttempt: (payload) => api.post('/exams/attempts/save', payload),
    getAttempt: (examId) => api.get(`/exams/attempts/${examId}`),
    submitExam: (payload) => api.post('/exams/submit', payload),
};

export default MaterialService;
