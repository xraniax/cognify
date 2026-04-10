import { useState, useCallback } from 'react';
import { MaterialService } from '@/services/MaterialService';

/**
 * useExamGeneration
 * Owns: mock exam generation logic and API calls.
 * Depends on: subject context and tab management to insert the new exam session.
 */
export const useExamGeneration = ({
    normalizedId,
    subject,
    setTabs,
    setActiveTabId,
}) => {
    const [isGeneratingExam, setIsGeneratingExam] = useState(false);
    const [examGenError, setExamGenError] = useState('');

    const handleGenerateExam = useCallback(async (genOptions = {}) => {
        setExamGenError('');
        setIsGeneratingExam(true);

        try {
            const topics = (genOptions?.topics || subject?.name || '')
                .split(',')
                .map(i => i.trim())
                .filter(Boolean);

            const selectedTypes = Array.isArray(genOptions?.examTypes) && genOptions.examTypes.length > 0
                ? genOptions.examTypes
                : ['single_choice', 'multiple_select', 'short_answer', 'problem', 'fill_blank', 'matching', 'scenario'];

            const payload = {
                subject_id: normalizedId,
                numberOfQuestions: genOptions?.count || 10,
                difficulty: genOptions?.difficulty || 'Inter',
                topics: topics.length > 0 ? topics : [subject?.name || 'General'],
                types: selectedTypes,
                title: `${subject?.name || 'General'} Mock Exam`,
                timeLimit: genOptions?.timeLimit || 30,
            };

            const examRes = await MaterialService.generateExam(payload);
            const exam = examRes?.data?.data;
            
            if (!exam) {
                throw new Error('Failed to generate exam. Empty response.');
            }

            const tabId = `exam-${exam.id}`;

            setTabs(prev => [
                ...prev.filter(t => t.type !== 'exam_session'),
                { 
                    id: tabId, 
                    title: exam.title || 'Mock Exam', 
                    type: 'exam_session',
                    material: { id: tabId, type: 'exam_session', ai_generated_content: exam }, 
                    pinned: false 
                },
            ]);
            setActiveTabId(tabId);
        } catch (err) {
            setExamGenError(err.message || 'Exam generation failed.');
        } finally {
            setIsGeneratingExam(false);
        }
    }, [normalizedId, subject, setTabs, setActiveTabId]);

    return {
        isGeneratingExam,
        examGenError,
        setExamGenError,
        handleGenerateExam,
    };
};
