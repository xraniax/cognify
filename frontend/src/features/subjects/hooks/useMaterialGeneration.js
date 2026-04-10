import { useState, useRef, useEffect, useCallback } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { subjectService } from '@/features/subjects/services/SubjectService';
import { setFlashcardsExpectedCount } from '@/features/subjects/components/FlashcardsView';

/**
 * useMaterialGeneration
 * Owns: standard material streaming, polling fallback, genResult state.
 * Depends on: subject context + panel callbacks to update workspace state.
 */
export const useMaterialGeneration = ({
    subjectId,
    normalizedId,
    selectedUploads,
    tabsRef,
    setTabs,
    setActiveTabId,
}) => {
    const fetchMaterials  = useMaterialStore(s => s.actions.fetchMaterials);
    const startPolling    = useMaterialStore(s => s.actions.startPolling);
    const clearAllPolling = useMaterialStore(s => s.actions.clearAllPolling);
    const jobProgress     = useMaterialStore(s => s.data.jobProgress);

    const [materialGenError, setMaterialGenError] = useState('');
    const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
    const [genResult, setGenResult] = useState('');

    const streamControllerRef = useRef(null);
    const currentSubjectIdRef = useRef(normalizedId);
    useEffect(() => { currentSubjectIdRef.current = normalizedId; }, [normalizedId]);

    useEffect(() => {
        return () => {
            streamControllerRef.current?.abort();
            clearAllPolling();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerateMaterial = useCallback(async (genType, singleId = null, genOptions = undefined) => {
        setMaterialGenError('');

        const targets = (singleId ? [singleId] : selectedUploads)
            .filter(t => t && typeof t === 'string' && t !== '[object Object]')
            .map(String);

        if (targets.length === 0) {
            setMaterialGenError('Select at least one document from the Source Files panel first.');
            return;
        }

        setIsGeneratingMaterial(true);
        setGenResult('');
        
        if (genType === 'flashcards' && genOptions?.count) {
            setFlashcardsExpectedCount(genOptions.count);
        }

        try {
            const res = await subjectService.generate(targets, genType, subjectId, genOptions);
            const { material_id } = res.data.data;

            if (material_id) {
                fetchMaterials();
                setActiveTabId('generator');
                
                streamControllerRef.current?.abort();
                const controller = new AbortController();
                streamControllerRef.current = controller;

                subjectService.streamMaterial(
                    material_id, 
                    controller.signal,
                    chunk => { 
                        setGenResult(prev => (prev || '') + chunk); 
                        setIsGeneratingMaterial(true); 
                    },
                    () => {
                        streamControllerRef.current = null;
                        setIsGeneratingMaterial(false);
                        if (String(currentSubjectIdRef.current) !== normalizedId) return;
                        
                        subjectService.sync(material_id, controller.signal).then(() => {
                            if (String(currentSubjectIdRef.current) !== normalizedId) return;
                            fetchMaterials().then(() => {
                                const mat = useMaterialStore.getState().data.materials
                                    .find(m => String(m.id) === String(material_id));
                                if (!mat) return;
                                if (!tabsRef.current.find(t => String(t.id) === String(mat.id))) {
                                    setTabs(prev => [...prev, { 
                                        id: mat.id, title: mat.title || mat.type,
                                        type: mat.type, material: mat, pinned: false 
                                    }]);
                                }
                                setActiveTabId(mat.id);
                                setGenResult('');
                            });
                        });
                    },
                    () => { 
                        streamControllerRef.current = null; 
                        setIsGeneratingMaterial(false); 
                        startPolling(String(material_id)); 
                    }
                );
            } else {
                const fallback = res.data.data.result || res.data.data.content || '';
                setGenResult(typeof fallback === 'object' ? JSON.stringify(fallback, null, 2) : String(fallback));
                setIsGeneratingMaterial(false);
            }
        } catch (err) {
            setMaterialGenError(err.message || 'Generation failed.');
            setIsGeneratingMaterial(false);
        }
    }, [selectedUploads, subjectId, normalizedId, fetchMaterials, startPolling, tabsRef, setTabs, setActiveTabId]);

    return { 
        materialGenError, 
        setMaterialGenError, 
        isGeneratingMaterial, 
        setIsGeneratingMaterial, 
        genResult, 
        setGenResult, 
        jobProgress, 
        handleGenerateMaterial 
    };
};
