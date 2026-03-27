import { create } from 'zustand';

/**
 * UI Store: Centralized tracking for loading states and global errors.
 * 
 * loadingStates: { [taskKey]: boolean }
 * errors: { [taskKey]: string | null }
 */
export const useUIStore = create((set, get) => ({
    data: {
        loadingStates: {},
        errors: {}
    },
    loading: false,
    error: null,
    actions: {
        setLoading: (key, isLoading, message = 'Loading...', blocking = true) =>
            set((state) => ({
                ...state,
                data: {
                    ...state.data,
                    loadingStates: { 
                        ...state.data.loadingStates, 
                        [key]: isLoading ? { loading: true, message, blocking } : { loading: false, message: '', blocking: true }
                    }
                }
            })),

        setError: (key, message) =>
            set((state) => ({
                ...state,
                data: {
                    ...state.data,
                    errors: { ...state.data.errors, [key]: message },
                    loadingStates: { 
                        ...state.data.loadingStates, 
                        [key]: { loading: false, message: '' }
                    }
                }
            })),

        clearError: (key) =>
            set((state) => ({
                ...state,
                data: {
                    ...state.data,
                    errors: { ...state.data.errors, [key]: null }
                }
            })),

        // Helper to check if ANY critical task is loading
        getGlobalLoading: (keys = []) => {
            const loadingStates = get().data.loadingStates || {};
            const activeKeys = keys.length > 0 ? keys : Object.keys(loadingStates);
            
            for (const key of activeKeys) {
                if (loadingStates[key]?.loading) {
                    return loadingStates[key];
                }
            }
            return null;
        }
    }
}));
