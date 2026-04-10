import api from '@/services/api';

export const subjectService = {
    // Subject Management
    getAll: () => api.get('/subjects'),
    getOne: (id) => api.get(`/subjects/${id}`),
    create: (name, description) => api.post('/subjects', { name, description }),
    rename: (id, name) => api.patch(`/subjects/${id}`, { name }),
    delete: (id) => api.delete(`/subjects/${id}`),

    // Subject Materials (Documents)
    getMaterials: (subjectId) => api.get('/materials/history', { params: { subjectId } }),
    deleteMaterial: (id) => api.delete(`/materials/${id}`),
    renameMaterial: (id, title) => api.patch(`/materials/${id}`, { title }),
    uploadMaterial: (data) => {
        const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        return api.post('/materials/upload', data, config);
    },
    getHistory: () => api.get('/materials/history'),
    getTrash: () => api.get('/materials/trash'),
    restoreMaterial: (id) => api.post(`/materials/${id}/restore`),
    cancel: (id) => api.post(`/materials/${id}/cancel`),
    getSettings: () => api.get('/materials/settings'),

    // AI Interactions
    chat: (materialIds, question) => api.post('/materials/chat-combined', { materialIds, question }),
    generate: (materialIds, taskType, subjectId, genOptions) =>
        api.post('/materials/generate-combined', { materialIds, taskType, subjectId, genOptions }),
    sync: (id, signal) => api.get(`/materials/${id}/sync`, { signal }),

    /**
     * streamMaterial — pure cancellable async primitive.
     *
     * Contract:
     *   - Caller owns the AbortController and passes its signal.
     *   - Service has NO internal state, NO cancel return value.
     *   - AbortController.abort() is the single cancellation mechanism.
     *   - onChunk / onComplete / onError will NOT fire after abort.
     *
     * @param {string}      id         Material ID
     * @param {AbortSignal} signal     Caller-owned AbortSignal
     * @param {Function}    onChunk    Called per streamed text chunk
     * @param {Function}    onComplete Called once when stream ends naturally
     * @param {Function}    onError    Called on non-abort errors
     */
    streamMaterial: async (id, signal, onChunk, onComplete, onError) => {
        const token = localStorage.getItem('token');
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const url = `${API_URL}/materials/${id}/stream`;

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
                signal, // AbortSignal directly from the hook's AbortController
            });

            // Validate HTTP status before touching the body
            if (!response.ok) {
                onError(new Error(`Stream failed with status ${response.status}`));
                return;
            }

            const decoder = new TextDecoder();

            for await (const rawChunk of response.body) {
                // for-await will throw AbortError when signal fires —
                // this explicit check exits the inner loop immediately
                // without waiting for the next async iteration boundary.
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
                    } catch {
                        // Partial JSON or keep-alive frame — skip silently
                    }
                }
            }

            // Body exhausted cleanly (server closed without sending is_final)
            onComplete();
        } catch (err) {
            if (err.name === 'AbortError') return; // Intentional cancel — no callback
            onError(err);
        }
    },

    // Exams
    generateExam: (payload) => api.post('/exams/generate', payload),
    saveAttempt: (payload) => api.post('/exams/attempts/save', payload),
    getAttempt: (examId) => api.get(`/exams/attempts/${examId}`),
    submitExam: (payload) => api.post('/exams/submit', payload),
};

export default subjectService;
