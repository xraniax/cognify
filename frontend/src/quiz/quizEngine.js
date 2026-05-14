export const normalizeOptions = (question) => {
    return Array.isArray(question?.options) 
        ? question.options.filter(Boolean).map(String) 
        : [];
};

export const getSafeIndex = (key, optionsLength) => {
    if (!key || typeof key !== 'string') return null;
    const lowerKey = key.toLowerCase();
    if (!/^[a-z]$/.test(lowerKey)) return null;
    const idx = lowerKey.charCodeAt(0) - 97;
    return idx >= 0 && idx < optionsLength ? idx : null;
};

export const isCorrectAnswer = (selectedOption, correctAnswer) => {
    if (selectedOption == null || correctAnswer == null) return false;
    return String(selectedOption).trim() === String(correctAnswer).trim();
};

export const getKeyboardMappedOption = (key, options) => {
    if (!Array.isArray(options)) return null;
    const idx = getSafeIndex(key, options.length);
    return idx !== null ? options[idx] : null;
};
