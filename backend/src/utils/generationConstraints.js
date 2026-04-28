const MATERIAL_COUNT_LIMITS = {
    quiz: 50,
    flashcards: 50,
    exam: 100,
};

const toValidPositiveInt = (value) => {
    if (!Number.isInteger(value) || value <= 0) return null;
    return value;
};

const resolveCountLimit = (materialType, requestedCount) => {
    const maxLimit = MATERIAL_COUNT_LIMITS[materialType] || null;
    const normalizedRequested = toValidPositiveInt(requestedCount);

    if (maxLimit == null) return normalizedRequested;
    if (normalizedRequested == null) return maxLimit;
    return Math.min(normalizedRequested, maxLimit);
};

const trimArray = (list, countLimit) => {
    if (!Array.isArray(list) || !Number.isInteger(countLimit) || countLimit <= 0) {
        return list;
    }
    return list.slice(0, countLimit);
};

const enforceStructuredCount = (payload, materialType, requestedCount) => {
    if (!payload || typeof payload !== 'object') return payload;

    const countLimit = resolveCountLimit(materialType, requestedCount);
    if (!Number.isInteger(countLimit) || countLimit <= 0) return payload;

    if (materialType === 'quiz' && Array.isArray(payload.questions)) {
        return {
            ...payload,
            questions: trimArray(payload.questions, countLimit),
        };
    }

    if (materialType === 'flashcards' && Array.isArray(payload.cards)) {
        return {
            ...payload,
            cards: trimArray(payload.cards, countLimit),
        };
    }

    if (materialType === 'exam' && Array.isArray(payload.questions)) {
        return {
            ...payload,
            questions: trimArray(payload.questions, countLimit),
        };
    }

    return payload;
};

export const enforceGenerationConstraintsForPersistence = (aiResult, constraints = {}) => {
    if (!aiResult || typeof aiResult !== 'object') return aiResult;

    const materialType = typeof constraints.materialType === 'string' ? constraints.materialType : aiResult.type;
    const requestedCount = constraints.count;

    // Engine task payload shape: { type, content, metadata }
    if (Object.prototype.hasOwnProperty.call(aiResult, 'content')) {
        const nextContent = enforceStructuredCount(aiResult.content, materialType, requestedCount);
        if (nextContent === aiResult.content) return aiResult;
        return {
            ...aiResult,
            content: nextContent,
        };
    }

    // Synchronous backend-generated shape (e.g., exam object with questions)
    return enforceStructuredCount(aiResult, materialType, requestedCount);
};
