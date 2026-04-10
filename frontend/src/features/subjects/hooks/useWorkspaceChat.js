import { useState, useRef, useCallback } from 'react';
import { useSpeech } from '@/hooks/useSpeech';
import { MaterialService } from '@/services/MaterialService';

/**
 * useWorkspaceChat
 * Owns: chat messages, current question, thinking state, speech, handleChat.
 * Depends on: uploads + selectedUploads passed from the orchestrator.
 */
export const useWorkspaceChat = ({ uploads, selectedUploads }) => {
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [chatError, setChatError] = useState('');
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const chatEndRef = useRef(null);

    const { speak, listen, isListening, cancel } = useSpeech();

    const handleChat = useCallback(async (e) => {
        if (e) e.preventDefault();
        if (!currentQuestion.trim() || isThinking) return;

        setChatError('');
        const userMsg = { role: 'user', content: currentQuestion };
        setChatMessages(prev => [...prev, userMsg]);
        setCurrentQuestion('');
        setIsThinking(true);

        try {
            const contextIds = selectedUploads.length > 0
                ? selectedUploads
                : uploads.map(m => m.id);
            const res = await MaterialService.chat(contextIds, userMsg.content);
            setChatMessages(prev => [...prev, { role: 'ai', content: res.data.data.result }]);
        } catch (err) {
            const msg = err.message || 'AI engine is unreachable. Please try again.';
            setChatError(msg);
            setChatMessages(prev => [...prev, { role: 'ai', content: `Error: ${msg}` }]);
        } finally {
            setIsThinking(false);
        }
    }, [currentQuestion, isThinking, selectedUploads, uploads]);

    return {
        chatMessages,
        setChatMessages,
        currentQuestion,
        setCurrentQuestion,
        isThinking,
        chatError,
        setChatError,
        chatEndRef,
        chatCollapsed,
        setChatCollapsed,
        handleChat,
        speak,
        listen,
        isListening,
        cancel,
    };
};
