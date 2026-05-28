// This module is part of the Orchestration Layer.
// It owns exam generation (adaptive + static), server-side grading, and exam session lifecycle.
// LLM calls go directly to Ollama (Engine Layer); adaptive state is managed via engine /exam/* routes.
import { randomUUID } from 'crypto';
import axios from 'axios';
import engineClient from './engine.client.js';
import Material from '../models/material.model.js';
import { COMPLETED, PROCESSING } from '../constants/status.enum.js';
import { query } from '../utils/config/db.js';

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://ollama:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_GENERATION_MODEL || 'qwen2.5:3b';
const OLLAMA_GENERATE_URL = `${OLLAMA_BASE_URL}/api/generate`;
const ENGINE_URL = (process.env.ENGINE_URL || 'http://engine:8000').replace(/\/$/, '');

const EXAM_CACHE_TTL_MS = 1000 * 60 * 60 * 2;
const EXAM_CACHE_LIMIT = 500;
const FORBIDDEN_TOKENS = /\b(almost correct|almost right|that'?s correct|that'?s incorrect|you are correct|you are incorrect)\b/i;
const MAX_GENERATION_ATTEMPTS = 10;
const MAX_REGEN_ROUNDS = 5;
const OVERFETCH_FACTOR = 1.5;
const SUPPORTED_TYPES = [
    'single_choice',
    'multiple_select',
    'short_answer',
    'problem',
    'fill_blank',
    'matching',
    'scenario',
];
const PLACEHOLDER_PATTERN = /^(string|option\s*[a-d]|choice\s*[a-d]|answer|n\/a|none)$/i;

// Max chars of RAG context fed to the LLM per batch.
// 2500 was too restrictive (~625 tokens); 6000 gives ~1500 tokens while staying safe for a 4096-token context window.
const EXAM_CONTEXT_MAX_CHARS = parseInt(process.env.EXAM_CONTEXT_MAX_CHARS, 10) || 6000;

// Common LLM aliases for question types → canonical pipeline values.
const QUESTION_TYPE_ALIASES = {
    multiple_choice: 'single_choice',
    true_false:      'single_choice',
    open_ended:      'short_answer',
    essay:           'short_answer',
    completion:      'fill_blank',
    fill_in_blank:   'fill_blank',
    fill_in_the_blank: 'fill_blank',
    match:           'matching',
};

const examCache = new Map();

const normalizeDifficulty = (difficulty) => {
    if (difficulty === 'mixed') return 'medium';
    return difficulty || 'medium';
};

// Convert backend difficulty enum values to the three-level scale the engine expects.
const toEngineDifficulty = (d) => {
    const lower = String(d || '').toLowerCase();
    if (['intro', 'introductory', 'easy', 'beginner'].includes(lower)) return 'beginner';
    if (['adv', 'advanced', 'hard', 'expert'].includes(lower)) return 'advanced';
    return 'intermediate';
};

const cleanupCache = () => {
    const now = Date.now();
    for (const [examId, value] of examCache.entries()) {
        if (now - value.createdAtMs > EXAM_CACHE_TTL_MS) examCache.delete(examId);
    }
    if (examCache.size <= EXAM_CACHE_LIMIT) return;
    const ordered = [...examCache.entries()].sort((a, b) => a[1].createdAtMs - b[1].createdAtMs);
    const overLimit = examCache.size - EXAM_CACHE_LIMIT;
    for (let i = 0; i < overLimit; i += 1) examCache.delete(ordered[i][0]);
};

const stripCodeFences = (value) => String(value || '').replace(/```json|```/gi, '').trim();

const extractJsonPayload = (raw) => {
    const cleaned = stripCodeFences(raw);
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (objectStart >= 0 && objectEnd > objectStart) return cleaned.slice(objectStart, objectEnd + 1);
    if (arrayStart >= 0 && arrayEnd > arrayStart) return cleaned.slice(arrayStart, arrayEnd + 1);
    return cleaned;
};

const safeParseJSON = (raw) => {
    try {
        const extracted = extractJsonPayload(raw);
        const parsed = JSON.parse(extracted);
        const topKeys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];
        const qLen = Array.isArray(parsed)
            ? parsed.length
            : Array.isArray(parsed?.questions) ? parsed.questions.length : '—';
        console.log('[ExamGen][Parse] OK top_keys=%s question_count=%s', JSON.stringify(topKeys), qLen);
        return parsed;
    } catch (e) {
        const extracted = extractJsonPayload(raw);
        console.error('[ExamGen][Parse] FAIL err=%s extracted_preview="%s"',
            e.message, extracted.slice(0, 300).replace(/\n/g, '\\n'));
        return null;
    }
};

const sanitizeString = (value) => String(value ?? '').trim();
const normalizeText = (value) => sanitizeString(value).toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
const isPlaceholderText = (value) => PLACEHOLDER_PATTERN.test(sanitizeString(value));
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

// Normalize raw LLM field names → canonical camelCase schema before validateQuestion.
// Small models (qwen2.5:3b) often use snake_case or alternative field names.
const coerceQuestion = (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const q = { ...raw };

    // type: accept question_type, and map known aliases to SUPPORTED_TYPES
    if (!q.type && q.question_type) q.type = q.question_type;
    const rawType = sanitizeString(q.type || '').toLowerCase();
    if (QUESTION_TYPE_ALIASES[rawType]) {
        console.log('[ExamGen][Coerce] type "%s" → "%s"', rawType, QUESTION_TYPE_ALIASES[rawType]);
        q.type = QUESTION_TYPE_ALIASES[rawType];
    } else if (rawType) {
        q.type = rawType; // ensure lowercase
    }

    // options: accept 'choices'
    if (!Array.isArray(q.options) && Array.isArray(q.choices)) {
        console.log('[ExamGen][Coerce] choices → options len=%d', q.choices.length);
        q.options = q.choices;
    }

    // correctAnswers: accept correct_answer (int|string), correct_answers (array), correctAnswer
    if (!Array.isArray(q.correctAnswers)) {
        if (Array.isArray(q.correct_answers)) {
            q.correctAnswers = q.correct_answers.map(Number);
        } else {
            const scalar = q.correct_answer ?? q.correctAnswer;
            if (scalar !== undefined && scalar !== null) {
                const idx = Number(scalar);
                if (Number.isInteger(idx) && idx >= 0) {
                    console.log('[ExamGen][Coerce] correct_answer %s → correctAnswers=[%d]', scalar, idx);
                    q.correctAnswers = [idx];
                }
            }
        }
    }

    // acceptedAnswers: accept accepted_answers (array), accepted_answer (string)
    if (!Array.isArray(q.acceptedAnswers)) {
        if (Array.isArray(q.accepted_answers)) q.acceptedAnswers = q.accepted_answers;
        else if (typeof q.accepted_answer === 'string' && q.accepted_answer.trim()) {
            q.acceptedAnswers = [q.accepted_answer];
        }
    }

    // blankAnswers: accept blank_answers, blanks
    if (!Array.isArray(q.blankAnswers)) {
        if (Array.isArray(q.blank_answers)) q.blankAnswers = q.blank_answers;
        else if (Array.isArray(q.blanks)) q.blankAnswers = q.blanks;
    }

    return q;
};

const hasNullOrEmptyFields = (question) => {
    if (!question || typeof question !== 'object') return true;
    if (question.type == null || sanitizeString(question.type) === '') return true;
    if (question.question == null || sanitizeString(question.question) === '') return true;
    const type = sanitizeString(question.type);
    if (['short_answer', 'problem', 'scenario'].includes(type)) {
        // Allow empty acceptedAnswers, we will auto-repair in validateQuestion
    } else if (type === 'fill_blank') {
        // Allow empty blankAnswers, we will auto-repair in validateQuestion
    } else if (type === 'matching') {
        // Allow empty pairs, we will auto-repair
    } else {
        if (!Array.isArray(question.options) || question.options.length < 2) return true;
        // Allow empty correctAnswers, we will auto-repair
    }
    // Difficulty and Topic will be auto-repaired, so we don't return true (fail) here
    return false;
};

const hasForbiddenLabels = (question) => {
    if (hasNullOrEmptyFields(question)) return true;
    const q = sanitizeString(question.question);
    // Only strictly block if the question itself is a placeholder or forbidden
    if (!q || isPlaceholderText(q) || FORBIDDEN_TOKENS.test(q)) return true;
    return false;
};

const validateQuestion = (rawQuestion, allowedTypes, fallbackTopic, fallbackDifficulty) => {
    if (!rawQuestion || typeof rawQuestion !== 'object') {
        console.log('[ExamGen][Validate] DROP not-object: %s', JSON.stringify(rawQuestion));
        return null;
    }

    // Expand hasForbiddenLabels checks inline for precise rejection diagnostics
    if (hasNullOrEmptyFields(rawQuestion)) {
        console.log('[ExamGen][Validate] DROP null-or-empty-fields: type=%s options=%d q="%s"',
            rawQuestion.type ?? '(none)',
            Array.isArray(rawQuestion.options) ? rawQuestion.options.length : -1,
            String(rawQuestion.question ?? '').slice(0, 80));
        return null;
    }
    const qText = sanitizeString(rawQuestion.question);
    if (isPlaceholderText(qText)) {
        console.log('[ExamGen][Validate] DROP placeholder-text: q="%s"', qText.slice(0, 80));
        return null;
    }
    if (FORBIDDEN_TOKENS.test(qText)) {
        console.log('[ExamGen][Validate] DROP forbidden-token matched in: q="%s"', qText.slice(0, 80));
        return null;
    }

    const questionText = sanitizeString(rawQuestion.question);
    let options = Array.isArray(rawQuestion.options)
        ? rawQuestion.options.map((opt) => sanitizeString(opt)).filter(Boolean)
        : [];

    if (!questionText) return null;

    const requestedType = sanitizeString(rawQuestion.type);
    const type = allowedTypes.includes(requestedType) ? requestedType : allowedTypes[0];

    if (['short_answer', 'problem', 'scenario'].includes(type)) {
        let acceptedAnswers = Array.isArray(rawQuestion.acceptedAnswers)
            ? [...new Set(rawQuestion.acceptedAnswers.map((a) => sanitizeString(a)).filter(Boolean))]
            : [];
        // Auto-repair
        if (acceptedAnswers.length === 0 || acceptedAnswers.some(isPlaceholderText)) {
            console.log('[ExamGen][Repair] acceptedAnswers type=%s q="%s" → fallback', type, questionText.slice(0, 60));
            acceptedAnswers = ["Answer provided in context"];
        }
        return {
            id: randomUUID(),
            type,
            question: questionText,
            options: [],
            correctAnswers: [],
            acceptedAnswers,
            explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
            difficulty: ['Introductory', 'Intermediate', 'Advanced', 'easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
                ? rawQuestion.difficulty
                : fallbackDifficulty,
            topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
        };
    }

    if (type === 'fill_blank') {
        let blankAnswers = Array.isArray(rawQuestion.blankAnswers)
            ? rawQuestion.blankAnswers.map((a) => sanitizeString(a)).filter(Boolean)
            : [];
        // Auto-repair
        if (blankAnswers.length === 0 || blankAnswers.some(isPlaceholderText)) {
            console.log('[ExamGen][Repair] blankAnswers q="%s" → fallback', questionText.slice(0, 60));
            blankAnswers = ["(Blank)"];
        }
        return {
            id: randomUUID(),
            type,
            question: questionText,
            options: [],
            correctAnswers: [],
            blankAnswers,
            explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
            difficulty: ['Introductory', 'Intermediate', 'Advanced', 'easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
                ? rawQuestion.difficulty
                : fallbackDifficulty,
            topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
        };
    }

    if (type === 'matching') {
        let pairs = Array.isArray(rawQuestion.pairs)
            ? rawQuestion.pairs
                .map((pair) => ({ left: sanitizeString(pair?.left), right: sanitizeString(pair?.right) }))
                .filter((pair) => pair.left && pair.right)
            : [];
        // Auto-repair
        if (pairs.length < 2 || pairs.some((pair) => isPlaceholderText(pair.left) || isPlaceholderText(pair.right))) {
            console.log('[ExamGen][Repair] pairs len=%d q="%s" → fallback', pairs.length, questionText.slice(0, 60));
            pairs = [{ left: "Concept A", right: "Definition A" }, { left: "Concept B", right: "Definition B" }];
        }
        return {
            id: randomUUID(),
            type,
            question: questionText,
            options: [],
            correctAnswers: [],
            pairs,
            rightOptions: shuffle([...new Set(pairs.map((p) => p.right))]),
            explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
            difficulty: ['Introductory', 'Intermediate', 'Advanced', 'easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
                ? rawQuestion.difficulty
                : fallbackDifficulty,
            topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
        };
    }

    // Auto-repair options
    if (options.length < 2 || options.some(isPlaceholderText) || new Set(options.map((opt) => normalizeText(opt))).size < 2) {
        console.log('[ExamGen][Repair] options len=%d type=%s q="%s" → ["True","False"]', options.length, type, questionText.slice(0, 60));
        options = ["True", "False"];
    }

    let correctAnswers = Array.isArray(rawQuestion.correctAnswers)
        ? [...new Set(rawQuestion.correctAnswers
            .map((idx) => Number(idx))
            .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length))]
        : [];

    // Auto-repair correctAnswers
    if (correctAnswers.length === 0) {
        console.log('[ExamGen][Repair] correctAnswers empty type=%s q="%s" → [0]', type, questionText.slice(0, 60));
        correctAnswers = [0];
    }
    if (type === 'single_choice' && correctAnswers.length !== 1) {
        console.log('[ExamGen][Repair] correctAnswers multi-for-single_choice len=%d q="%s" → [0]', correctAnswers.length, questionText.slice(0, 60));
        correctAnswers = [0];
    }

    return {
        id: randomUUID(),
        type,
        question: questionText,
        options,
        correctAnswers: correctAnswers.sort((a, b) => a - b),
        explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
        difficulty: ['easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
            ? rawQuestion.difficulty
            : fallbackDifficulty,
        topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
    };
};

const normalizeQuestionsFromModel = (parsed) => {
    if (!parsed) {
        console.log('[ExamGen][Normalize] input=null → []');
        return [];
    }
    if (Array.isArray(parsed)) {
        console.log('[ExamGen][Normalize] path=direct-array len=%d', parsed.length);
        return parsed.map(coerceQuestion);
    }
    if (Array.isArray(parsed.questions)) {
        console.log('[ExamGen][Normalize] path=.questions len=%d', parsed.questions.length);
        return parsed.questions.map(coerceQuestion);
    }
    if (Array.isArray(parsed.items)) {
        console.log('[ExamGen][Normalize] path=.items len=%d', parsed.items.length);
        return parsed.items.map(coerceQuestion);
    }

    if (typeof parsed === 'object') {
        // One level of nesting: { "exam": { "questions": [...] } } or similar
        for (const key of Object.keys(parsed)) {
            const nested = parsed[key];
            if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
                if (Array.isArray(nested.questions)) {
                    console.log('[ExamGen][Normalize] path=nested "%s".questions len=%d', key, nested.questions.length);
                    return nested.questions.map(coerceQuestion);
                }
                if (Array.isArray(nested.items)) {
                    console.log('[ExamGen][Normalize] path=nested "%s".items len=%d', key, nested.items.length);
                    return nested.items.map(coerceQuestion);
                }
            }
        }
        // Last resort: any top-level array value
        for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key])) {
                console.log('[ExamGen][Normalize] path=fallback-key key="%s" len=%d', key, parsed[key].length);
                return parsed[key].map(coerceQuestion);
            }
        }
    }
    console.warn('[ExamGen][Normalize] FAIL all-paths-exhausted keys=%s', JSON.stringify(parsed ? Object.keys(parsed) : null));
    return [];
};

const gatherValidQuestions = (candidates, allowedTypes, fallbackTopic, fallbackDifficulty, seen, limit) => {
    const accepted = [];
    for (const candidate of candidates) {
        const normalized = validateQuestion(candidate, allowedTypes, fallbackTopic, fallbackDifficulty);
        if (!normalized) {
            console.log('[ExamService] Candidate rejected by validation:', candidate?.question || 'Unknown Question');
            continue;
        }
        const dedupeKey = normalized.question.toLowerCase();
        if (seen.has(dedupeKey)) {
            console.log('[ExamService] Candidate rejected (duplicate):', dedupeKey);
            continue;
        }
        seen.add(dedupeKey);
        accepted.push(normalized);
        if (accepted.length >= limit) break;
    }
    return accepted;
};

const requestQuestionBatch = async ({
    numberOfQuestions,
    difficulty,
    topics,
    allowedTypes,
    fallbackTopic,
    fallbackDifficulty,
    seen,
    existingQuestions,
    options = {},
}) => {
    console.log('[ExamGen][Batch] → ask=%d difficulty=%s types=[%s] context_chars=%d',
        numberOfQuestions, difficulty, allowedTypes.join(','), options.context?.length ?? 0);
    const prompt = buildPrompt({
        numberOfQuestions,
        difficulty,
        topics,
        types: allowedTypes,
        existingQuestions,
        context: options.context,
    });
    const raw = await askModel(prompt.systemInstruction, prompt.userPrompt, options.subjectId);
    const parsed = safeParseJSON(raw);
    if (parsed !== null) {
        const shape = Array.isArray(parsed)
            ? `array[${parsed.length}]`
            : `object{${Object.keys(parsed).join(',')}}`;
        console.log('[ExamGen][ParsedShape] %s', shape);
    }
    const candidates = normalizeQuestionsFromModel(parsed);
    console.log('[ExamGen][Batch] ← raw_len=%d candidates=%d', raw.length, candidates.length);
    const valid = gatherValidQuestions(
        candidates,
        allowedTypes,
        fallbackTopic,
        fallbackDifficulty,
        seen,
        numberOfQuestions
    );
    console.log('[ExamGen][Batch] accepted=%d of %d candidates (wanted %d)',
        valid.length, candidates.length, numberOfQuestions);
    return valid;
};

const regenerateQuestions = async ({
    missing,
    difficulty,
    topics,
    allowedTypes,
    fallbackTopic,
    fallbackDifficulty,
    seen,
    existingQuestions,
    context,
    subjectId,
}) => {
    const regenerated = [];
    let rounds = 0;
    while (regenerated.length < missing && rounds < MAX_REGEN_ROUNDS) {
        rounds += 1;
        const needed = missing - regenerated.length;
        const extra = await requestQuestionBatch({
            numberOfQuestions: needed,
            difficulty,
            topics,
            allowedTypes,
            fallbackTopic,
            fallbackDifficulty,
            seen,
            existingQuestions: [...existingQuestions, ...regenerated.map((q) => q.question)],
            options: { context, subjectId },
        });
        regenerated.push(...extra);
    }
    return regenerated.slice(0, missing);
};

const buildTypeDistribution = (types, total) => {
    const base = Math.floor(total / types.length);
    const remainder = total % types.length;
    return types.map((t, i) => ({ type: t, count: base + (i < remainder ? 1 : 0) }));
};

const buildPrompt = ({ numberOfQuestions, difficulty, topics, types, existingQuestions, context }) => {
    const contextStr = context ? `Use the following context to generate questions:\n---\n${context}\n---\n` : '';
    const blocked = existingQuestions.length > 0
        ? `Avoid duplicating these already accepted questions:\n${existingQuestions.map((q) => `- ${q}`).join('\n')}\n`
        : '';

    const distribution = buildTypeDistribution(types, numberOfQuestions);
    const distributionStr = distribution.map(({ type, count }) => `  - ${count} question${count !== 1 ? 's' : ''} of type "${type}"`).join('\n');

    const systemInstruction = `You are a strict JSON generator for an exam testing system.
You MUST output ONLY a valid JSON object matching the requested schema.
Do not output any conversational text, formatting, or markdown code blocks around the JSON.
Your JSON must strictly use double quotes for keys and string values.
If you are unsure of a field, provide a sensible default rather than omitting it.`;

    const typeToSchema = {
        "single_choice": {"id": "1", "question": "Single choice question?", "type": "single_choice", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswers": [0], "explanation": "Explain the key concept and why option A is the right answer." },
        "multiple_select": {"id": "2", "question": "Multiple select question?", "type": "multiple_select", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswers": [0, 1], "explanation": "Explain why options A and B are both correct." },
        "short_answer": {"id": "3", "question": "Short answer question?", "type": "short_answer", "acceptedAnswers": ["A concise factual answer"], "explanation": "Explain the underlying concept that makes this the answer." },
        "problem": {"id": "4", "question": "Problem solving question?", "type": "problem", "acceptedAnswers": ["Step-by-step solution"], "explanation": "Walk through the reasoning and method used to solve this." },
        "fill_blank": {"id": "5", "question": "The capital of France is ___.", "type": "fill_blank", "blankAnswers": ["Paris"], "explanation": "Paris is the capital and largest city of France." },
        "matching": {"id": "6", "question": "Match each term to its definition.", "type": "matching", "pairs": [{"left": "Term A", "right": "Definition of Term A"}, {"left": "Term B", "right": "Definition of Term B"}], "explanation": "Each term maps to its definition based on the topic covered." }
    };

    let hintQuestions = [];
    if (distribution && distribution.length > 0) {
        distribution.forEach((d, i) => {
            if (typeToSchema[d.type]) {
                hintQuestions.push({ ...typeToSchema[d.type], id: String(i + 1) });
            }
        });
    } else {
        hintQuestions = Object.values(typeToSchema);
    }

    const schemaHint = {
        questions: hintQuestions
    };

    const userPrompt = `
Generate EXACTLY ${numberOfQuestions} exam questions as strict JSON.

You MUST spread questions across ALL of the following types using this exact distribution:
${distributionStr}
Do NOT generate any other types. Do NOT use only one type.
Difficulty: ${difficulty}
Topics: ${topics.join(', ')}

Output format (this is just an example template, adjust array sizes to respect requested COUNT):
${JSON.stringify(schemaHint, null, 2)}

Rules:
1) Return ONLY JSON, no markdown.
2) question must be non-empty.
3) if type is short_answer/problem/scenario, provide acceptedAnswers with one or more valid strings.
4) if type is fill_blank, provide blankAnswers as ordered strings for each blank.
5) if type is matching, provide pairs with left/right fields (at least 2 pairs).
6) For each question:
   - Use ONLY the fields relevant to its type
   - Do NOT include unused fields
7) Follow type-specific rules:
   - single_choice / multiple_select → MUST have options + correctAnswers
   - short_answer / problem / scenario → MUST have acceptedAnswers
   - fill_blank → MUST have blankAnswers
   - matching → MUST have pairs (at least 2)
8) NEVER include fields that do not belong to the selected type
9) Match exactly ${numberOfQuestions} items.
10) explanation must be pedagogic: briefly teach the underlying concept and why the answer is right.
${contextStr}
${blocked}`.trim();

    return { systemInstruction, userPrompt };
};

// Call Ollama directly so the system instruction is honoured and JSON mode is active.
// The engine's /chat endpoint uses UnifiedChatRequest which has no `context` field,
// so passing systemInstruction there is silently dropped by Pydantic — causing the LLM
// to reply conversationally instead of emitting the required JSON schema.
const askModel = async (systemInstruction, userPrompt, _subjectId) => {
    console.log('[ExamGen][LLM] → model=%s url=%s system_len=%d prompt_len=%d',
        OLLAMA_MODEL, OLLAMA_GENERATE_URL, systemInstruction.length, userPrompt.length);
    const payload = {
        model: OLLAMA_MODEL,
        system: systemInstruction,
        prompt: userPrompt,
        format: 'json',
        stream: false,
        options: {
            temperature: 0.4,
            num_predict: 4096,
        },
    };
    const response = await axios.post(OLLAMA_GENERATE_URL, payload, { timeout: 300000 });
    const raw = response?.data?.response || '';
    console.log('[ExamGen][LLM] ← raw_len=%d preview="%s"',
        raw.length, raw.slice(0, 300).replace(/\n/g, '\\n'));
    return raw;
};

const getDifficultyForProgress = (currentCount, targetTotal, curve) => {
    if (curve === 'Progression') {
        if (currentCount < targetTotal * 0.33) return 'Introductory';
        if (currentCount < targetTotal * 0.66) return 'Intermediate';
        return 'Advanced';
    }
    if (curve === 'Balanced') {
        const levels = ['Introductory', 'Intermediate', 'Advanced'];
        return levels[currentCount % 3];
    }
    if (curve === 'Intro') return 'Introductory';
    if (curve === 'Adv') return 'Advanced';
    return 'Intermediate'; // Default/Inter
};


class ExamService {
    /**
     * Standardizes any exam format (Engine, Fallback, DB) into a unified internal structure.
     * Enforces the "Hard Contract" for all downstream consumers (grading, frontend).
     */
     static _normalizeExam(raw) {
         if (!raw || typeof raw !== 'object') return { questions: [], answer_sheet: [] };

         let content = raw;
         // Handle nested ai_generated_content or content wrappers
         if (raw.ai_generated_content && typeof raw.ai_generated_content === 'object') {
             content = raw.ai_generated_content;
         } else if (raw.content && typeof raw.content === 'object') {
             content = raw.content;
         }

         // Extract questions from any known variation
         let questions = content.questions || content.items || (Array.isArray(content) ? content : []);
         if (content.result && content.result.questions) questions = content.result.questions;
         if (!Array.isArray(questions)) questions = [];

         // Extract answer sheet
         const answerSheet = content.answer_sheet || (content.result && content.result.answer_sheet) || [];

         // Helper: Convert text or mixed answers into canonical indices
         const _resolveAnswerToIndices = (q, rawAnswer) => {
             if (rawAnswer === undefined || rawAnswer === null) return null;
             const answers = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];

             // If it's not a choice-based question, indices don't apply.
             if (!['single_choice', 'multiple_select'].includes(q.type)) return answers;

             const indices = answers.map(val => {
                 // 1. If it's a string, try to find it in options as a VALUE first
                 if (typeof val === 'string' && q.options) {
                     const normOpt = q.options.map(o => String(o).trim().toLowerCase());
                     const idx = normOpt.indexOf(val.trim().toLowerCase());
                     if (idx !== -1) return idx;
                 }
                 
                 // 2. If it's a number or a string that's a number, try it as an INDEX
                 const num = Number(val);
                 if (Number.isInteger(num) && num >= 0 && num < (q.options?.length || 0)) {
                     return num;
                 }
                 
                 return null;
             }).filter(v => v !== null);


             return indices.length > 0 ? indices : null;
         };

         // Ensure all questions have a type field (default to 'short_answer' if missing)
         questions = questions.map(q => {
             if (!q.type || typeof q.type !== 'string' || q.type.trim() === '') {
                 // Infer type from structure if possible
                 if (q.options && Array.isArray(q.options) && q.options.length > 0) {
                     q.type = 'single_choice';
                 } else if (q.pairs && Array.isArray(q.pairs) && q.pairs.length > 0) {
                     q.type = 'matching';
                 } else if (q.blankAnswers && Array.isArray(q.blankAnswers) && q.blankAnswers.length > 0) {
                     q.type = 'fill_blank';
                 } else {
                     q.type = 'short_answer';
                 }
             }
             return q;
         });

         // Merge answer sheet into questions (Source of Truth for Grading)
         if (Array.isArray(answerSheet) && answerSheet.length > 0) {
             const sheetMap = new Map(answerSheet.map(a => [String(a.question_id || a.id), a]));
             questions = questions.map(q => {
                 const sheetItem = sheetMap.get(String(q.id));
                 if (sheetItem) {
                     return {
                         ...q,
                         // Priority: answer_sheet > existing correctAnswers
                         correctAnswers: _resolveAnswerToIndices(q, sheetItem.answer) || q.correctAnswers,
                         acceptedAnswers: !['single_choice', 'multiple_select'].includes(q.type)
                             ? (Array.isArray(sheetItem.answer) ? sheetItem.answer : [sheetItem.answer])
                             : q.acceptedAnswers,
                         explanation: sheetItem.explanation || q.explanation
                     };
                 }
                 return q;
             });
         }

         return {
             ...raw,
             type: 'exam',
             questions, // Standardized flat structure for grading/rendering
             answer_sheet: Array.isArray(answerSheet) ? answerSheet : []
         };
     }
    static async generateAdaptiveExam(userId, payload) {
        cleanupCache();
        const targetCount = payload.numberOfQuestions;
        const allowedTypes = [...new Set(payload.types)].filter((t) => SUPPORTED_TYPES.includes(t));
        if (allowedTypes.length === 0) {
            const err = new Error('No supported question types selected.');
            err.statusCode = 400;
            throw err;
        }

        console.log('[EXAM_INIT] mode=adaptive subject=%s questions=%d types=[%s] difficulty=%s topics=[%s]',
            payload.subject_id, targetCount, allowedTypes.join(','), payload.difficulty,
            (payload.topics || []).join(','));

        const title = payload.title || `Adaptive Exam - ${payload.topics.join(', ')}`;
        const createdMaterial = await Material.create(userId, payload.subject_id, title, '', 'exam', PROCESSING);
        if (!createdMaterial) {
            throw new Error('Failed to create material record for adaptive exam.');
        }
        const materialDbId = createdMaterial.id;

        // Call engine to initialize the adaptive exam session
        let nextDiff = toEngineDifficulty(payload.difficulty);
        let nextConcept = payload.topics[0];
        let progress = {};
        try {
            const initRes = await engineClient.post('/exam/init-session', {
                user_id: userId,
                subject_id: payload.subject_id,
                exam_id: materialDbId,
                ui_difficulty: toEngineDifficulty(payload.difficulty),
            });
            nextDiff = initRes.data.difficulty || toEngineDifficulty(payload.difficulty);
            nextConcept = initRes.data.target_concept || payload.topics[0];
            progress = initRes.data.progress || {};
        } catch (err) {
            console.error('[ExamService] Engine session initialization failed:', err.message);
        }

        // RAG context retrieval for first concept
        let context = '';
        try {
            const retrieveRes = await engineClient.post('/retrieve', {
                subject_id: payload.subject_id,
                topic: nextConcept,
                top_k: 20,
                ...(payload.material_ids?.length > 0 ? { material_ids: payload.material_ids } : {}),
            }, { timeout: 300000 });
            if (retrieveRes.data?.chunks) {
                const rawContext = retrieveRes.data.chunks.map(c => c.content).join('\n\n');
                context = rawContext.substring(0, EXAM_CONTEXT_MAX_CHARS);
                console.log('[EXAM_RAG_CONTEXT] mode=adaptive chunk_count=%d raw_chars=%d truncated_chars=%d injected_topic="%s"',
                    retrieveRes.data.chunks.length, rawContext.length, context.length, nextConcept);
            }
        } catch (err) {
            console.error('[ExamService] Adaptive RAG retrieval failed:', err.message);
        }

        const batchSize = Math.min(5, targetCount);
        const seen = new Set();
        const batch = await requestQuestionBatch({
            numberOfQuestions: batchSize,
            difficulty: nextDiff,
            topics: [nextConcept],
            allowedTypes,
            fallbackTopic: nextConcept,
            fallbackDifficulty: nextDiff,
            seen,
            existingQuestions: [],
            options: { context, subjectId: payload.subject_id },
        });

        if (batch.length < batchSize) {
            const missing = batchSize - batch.length;
            const regenerated = await regenerateQuestions({
                missing,
                difficulty: nextDiff,
                topics: [nextConcept],
                allowedTypes,
                fallbackTopic: nextConcept,
                fallbackDifficulty: nextDiff,
                seen,
                existingQuestions: batch.map((q) => q.question),
                context,
                subjectId: payload.subject_id,
            });
            batch.push(...regenerated);
        }

        if (batch.length === 0) {
            const err = new Error('Could not generate any valid questions for adaptive exam. Ensure your materials have sufficient content and retry.');
            err.statusCode = 422;
            throw err;
        }

        console.log('[EXAM_GENERATION] mode=adaptive batch_size=%d types=[%s] concept="%s" difficulty=%s first_q="%s"',
            batch.length,
            [...new Set(batch.map(q => q.type))].join(','),
            nextConcept, nextDiff,
            String(batch[0]?.question ?? '').slice(0, 80));

        const exam = {
            id: materialDbId,
            title,
            questions: batch.map((q) => ({
                id: q.id,
                type: q.type,
                question: q.question,
                options: q.options,
                acceptedAnswers: q.acceptedAnswers,
                blankAnswers: q.blankAnswers,
                pairs: q.pairs,
                rightOptions: q.rightOptions,
                explanation: q.explanation,
                difficulty: q.difficulty,
                topic: q.topic,
            })),
            timeLimit: payload.timeLimit,
            createdAt: new Date(),
            mode: 'adaptive',
            targetTotal: targetCount,
            batchSize: 5,
            allowedTypes,
            topics: payload.topics,
        };

        const examData = this._normalizeExam({
            ...exam,
            questions: batch,
        });

        await Material.updateAIResult(materialDbId, userId, examData.exam || examData, {
            materialType: 'exam',
            count: batch.length,
        });

        // Initialize exam_attempts record
        await query(
            `INSERT INTO exam_attempts
                (user_id, material_id, subject_id, current_index, answers, flagged, started_at, mode, batch_index, updated_at)
             VALUES ($1, $2, $3, 0, '[]'::jsonb, '{}'::jsonb, NOW(), 'adaptive', 0, NOW())`,
            [userId, materialDbId, payload.subject_id]
        );

        examCache.set(materialDbId, {
            userId,
            subjectId: payload.subject_id,
            createdAtMs: Date.now(),
            startedAt: new Date().toISOString(),
            exam: examData.exam || examData,
            mode: 'adaptive',
            batchIndex: 0,
            revealedCount: batch.length,
            targetTotal: targetCount,
            batchSize: 5,
            adaptiveState: { difficulty: nextDiff, targetConcept: nextConcept },
            batchHistory: [],
            materialIds: payload.material_ids || null,
        });

        return {
            ...exam,
            batchIndex: 0,
            progress,
            targetTotal: targetCount,
        };
    }

    static async nextBatch(userId, payload) {
        cleanupCache();
        const { examId, answers: submittedAnswers } = payload;

        let cacheEntry = examCache.get(examId);
        if (!cacheEntry) {
            const record = await this._getExamRecord(userId, examId);
            if (!record) {
                const err = new Error('Exam not found.');
                err.statusCode = 404;
                throw err;
            }
            const attemptRes = await query(
                'SELECT mode, batch_index, answers FROM exam_attempts WHERE user_id = $1 AND material_id = $2',
                [userId, examId]
            );
            const attempt = attemptRes.rows[0];
            if (!attempt || attempt.mode !== 'adaptive') {
                const err = new Error('Not an adaptive exam.');
                err.statusCode = 400;
                throw err;
            }
            cacheEntry = {
                userId,
                subjectId: record.subjectId,
                createdAtMs: record.createdAtMs,
                startedAt: record.startedAt,
                exam: record.exam,
                mode: 'adaptive',
                batchIndex: attempt.batch_index,
                revealedCount: record.exam.questions.length,
                targetTotal: record.exam.targetTotal || record.exam.questions.length + 5,
                batchSize: record.exam.batchSize || 5,
                adaptiveState: {
                    difficulty: 'intermediate',
                    targetConcept: record.exam.questions[record.exam.questions.length - 1]?.topic
                        || record.exam.topics?.[0]
                        || 'General',
                },
                batchHistory: [],
                materialIds: record.exam.materialIds || null,
            };
            examCache.set(examId, cacheEntry);
        }

        if (cacheEntry.revealedCount >= cacheEntry.targetTotal) {
            return {
                examId,
                batchIndex: cacheEntry.batchIndex,
                questions: [],
                progress: {},
                targetTotal: cacheEntry.targetTotal,
                revealedCount: cacheEntry.revealedCount,
                completed: true,
            };
        }

        // Grade current batch questions
        const currentBatchQuestions = cacheEntry.exam.questions.slice(cacheEntry.revealedCount - cacheEntry.batchSize, cacheEntry.revealedCount);
        const gradedResults = await this._gradeAnswersBatch(userId, currentBatchQuestions, submittedAnswers);

        // Call engine to process batch answers and get next target concept
        let nextDiff = 'intermediate';
        let nextConcept = cacheEntry.exam.topics?.[0] || 'General';
        let progress = {};
        console.log('[EXAM_ADAPTIVE_UPDATE] examId=%s batchIndex=%d graded=%d prevConcept="%s"',
            examId, cacheEntry.batchIndex, gradedResults.length,
            cacheEntry.adaptiveState?.targetConcept ?? 'unknown');
        try {
            const adaptiveRes = await engineClient.post('/exam/adaptive-state', {
                user_id: userId,
                subject_id: cacheEntry.subjectId,
                exam_id: examId,
                batch_results: gradedResults,
            });
            nextDiff = adaptiveRes.data.difficulty || 'intermediate';
            nextConcept = adaptiveRes.data.target_concept || cacheEntry.exam.topics?.[0] || 'General';
            progress = adaptiveRes.data.progress || {};
            console.log('[EXAM_ADAPTIVE_UPDATE] engine returned difficulty=%s nextConcept="%s"', nextDiff, nextConcept);
        } catch (err) {
            console.error('[EXAM_ADAPTIVE_UPDATE] engine call failed: %s — using fallback difficulty=%s concept="%s"',
                err.message, nextDiff, nextConcept);
        }

        // RAG Context retrieval
        let context = '';
        try {
            const retrieveRes = await engineClient.post('/retrieve', {
                subject_id: cacheEntry.subjectId,
                topic: nextConcept,
                top_k: 20,
                ...(cacheEntry.materialIds?.length > 0 ? { material_ids: cacheEntry.materialIds } : {}),
            }, { timeout: 300000 });
            if (retrieveRes.data?.chunks) {
                const rawContext = retrieveRes.data.chunks.map(c => c.content).join('\n\n');
                context = rawContext.substring(0, EXAM_CONTEXT_MAX_CHARS);
                console.log('[EXAM_RAG_CONTEXT] mode=nextBatch chunk_count=%d raw_chars=%d truncated_chars=%d injected_topic="%s"',
                    retrieveRes.data.chunks.length, rawContext.length, context.length, nextConcept);
            }
        } catch (err) {
            console.error('[ExamService] nextBatch RAG retrieval failed:', err.message);
        }

        const remaining = cacheEntry.targetTotal - cacheEntry.revealedCount;
        const currentBatchSize = Math.min(cacheEntry.batchSize, remaining);

        const seen = new Set(cacheEntry.exam.questions.map(q => q.question.toLowerCase()));
        const batch = await requestQuestionBatch({
            numberOfQuestions: currentBatchSize,
            difficulty: nextDiff,
            topics: [nextConcept],
            allowedTypes: cacheEntry.exam.allowedTypes || SUPPORTED_TYPES,
            fallbackTopic: nextConcept,
            fallbackDifficulty: nextDiff,
            seen,
            existingQuestions: cacheEntry.exam.questions.map(q => q.question),
            options: { context, subjectId: cacheEntry.subjectId },
        });

        if (batch.length < currentBatchSize) {
            const missing = currentBatchSize - batch.length;
            const regenerated = await regenerateQuestions({
                missing,
                difficulty: nextDiff,
                topics: [nextConcept],
                allowedTypes: cacheEntry.exam.allowedTypes || SUPPORTED_TYPES,
                fallbackTopic: nextConcept,
                fallbackDifficulty: nextDiff,
                seen,
                existingQuestions: [...cacheEntry.exam.questions, ...batch].map((q) => q.question),
                context,
                subjectId: cacheEntry.subjectId,
            });
            batch.push(...regenerated);
        }

        if (batch.length === 0) {
            console.warn('[ADAPTIVE_GUARD_TRIGGERED] examId=%s concept="%s" batchIndex=%d — zero questions generated; returning 422 to prevent empty batch',
                examId, nextConcept, cacheEntry.batchIndex);
            const err = new Error('Could not generate additional questions for this batch. Please submit the exam with your current answers.');
            err.statusCode = 422;
            throw err;
        }

        console.log('[EXAM_GENERATION] mode=nextBatch examId=%s batch=%d concept="%s" difficulty=%s',
            examId, batch.length, nextConcept, nextDiff);

        const updatedQuestions = [...cacheEntry.exam.questions, ...batch];
        const updatedExamData = this._normalizeExam({
            ...cacheEntry.exam,
            questions: updatedQuestions,
        });

        await Material.updateAIResult(examId, userId, updatedExamData.exam || updatedExamData, {
            materialType: 'exam',
            count: updatedQuestions.length,
        });

        // Save submitted answers and increment batch index in DB
        const attemptRes = await query('SELECT answers FROM exam_attempts WHERE user_id = $1 AND material_id = $2', [userId, examId]);
        const currentAnswers = attemptRes.rows[0]?.answers || [];
        const newAnswers = [...currentAnswers];
        for (const ans of submittedAnswers) {
            const idx = newAnswers.findIndex(a => a.questionId === ans.questionId);
            if (idx !== -1) {
                newAnswers[idx] = ans;
            } else {
                newAnswers.push(ans);
            }
        }

        const nextBatchIndex = cacheEntry.batchIndex + 1;
        await query(
            `UPDATE exam_attempts
             SET answers = $1, batch_index = $2, updated_at = NOW()
             WHERE user_id = $3 AND material_id = $4 AND submitted_at IS NULL`,
            [JSON.stringify(newAnswers), nextBatchIndex, userId, examId]
        );

        cacheEntry.exam = updatedExamData.exam || updatedExamData;
        cacheEntry.batchIndex = nextBatchIndex;
        cacheEntry.revealedCount = updatedQuestions.length;
        cacheEntry.adaptiveState = { difficulty: nextDiff, targetConcept: nextConcept };
        // materialIds is already set on cacheEntry; preserve it across batches (no reassignment needed)

        return {
            examId,
            batchIndex: nextBatchIndex,
            questions: batch.map((q) => ({
                id: q.id,
                type: q.type,
                question: q.question,
                options: q.options,
                acceptedAnswers: q.acceptedAnswers,
                blankAnswers: q.blankAnswers,
                pairs: q.pairs,
                rightOptions: q.rightOptions,
                explanation: q.explanation,
                difficulty: q.difficulty,
                topic: q.topic,
            })),
            progress,
            targetTotal: cacheEntry.targetTotal,
            revealedCount: cacheEntry.revealedCount,
            completed: false,
        };
    }

    /**
     * Unified function to grade a single question answer.
     * Shared by both mid-exam scoring (_gradeAnswersBatch) and final submission (submitExam).
     */
    static async gradeQuestionAnswer(userId, question, answer, cachedScoring = null) {
        let isCorrect = false;
        let isAlmost = false;
        let aiExplanation = null;
        let aiScoreComponents = null;
        let isCached = false;

        const correctAnswers = [...(question.correctAnswers || [])].sort((a, b) => a - b);
        const selectedAnswers = answer.selectedAnswers || [];

        // Check if we can reuse cached scoring components to avoid double scoring
        if (cachedScoring && cachedScoring.scoreComponents) {
            isCorrect = !!cachedScoring.isCorrect;
            isAlmost = !!cachedScoring.isAlmost;
            aiExplanation = cachedScoring.explanation || null;
            aiScoreComponents = cachedScoring.scoreComponents;
            isCached = true;
        } else {
            if (question.type === 'single_choice') {
                isCorrect = Number(selectedAnswers[0]) === Number(correctAnswers[0]);
            } else if (['short_answer', 'problem', 'scenario'].includes(question.type)) {
                const userInput = answer.answerText;
                const referenceAnswer = (question.acceptedAnswers || [])[0] || 'No reference answer provided.';
                if (!userInput) {
                    isCorrect = false;
                } else {
                    try {
                        const evalRes = await engineClient.post('/scoring/score', {
                            rubric: {
                                question_id: String(question.id),
                                question_text: question.question,
                                reference_answer: referenceAnswer,
                                concepts: [],
                                important_keywords: [],
                                score_scale: '0-1',
                            },
                            answer: {
                                student_id: String(userId),
                                question_id: String(question.id),
                                answer_text: userInput,
                            },
                        }, { timeout: 300000 });

                        const evalData = evalRes.data;
                        const finalScore = typeof evalData.final_score === 'number' ? evalData.final_score : 0;
                        isCorrect = finalScore >= 0.8;
                        isAlmost = finalScore >= 0.4 && finalScore < 0.8;
                        aiExplanation = evalData.feedback || null;
                        aiScoreComponents = {
                            semantic: { score: evalData.semantic_score ?? 0 },
                            keyword:  { score: evalData.keyword_score ?? 0 },
                            concept:  { score: evalData.concept_score ?? 0 },
                            raw_combined_score: finalScore,
                        };
                    } catch (err) {
                        console.error('[ExamService] Semantic grading failed:', err.message);
                        isCorrect = false;
                    }
                }
            } else if (question.type === 'fill_blank') {
                const submitted = (answer.blankAnswers || []).map(normalizeText);
                const expected = (question.blankAnswers || []).map(normalizeText);
                const matches = expected.filter((ans, idx) => submitted[idx] === ans).length;
                isCorrect = submitted.length === expected.length && matches === expected.length;
                isAlmost = !isCorrect && matches > 0;
            } else if (question.type === 'matching') {
                const expectedMap = new Map((question.pairs || []).map((pair) => [pair.left, pair.right]));
                const submittedMap = answer.matchAnswers || {};
                const totalPairs = expectedMap.size;
                let matches = 0;
                for (const [left, right] of expectedMap.entries()) {
                    if (normalizeText(submittedMap[left]) === normalizeText(right)) matches += 1;
                }
                isCorrect = totalPairs > 0 && matches === totalPairs;
                isAlmost = !isCorrect && matches > 0;
            } else {
                const sNum = selectedAnswers.map(Number);
                const cNum = correctAnswers.map(Number);
                const exact = sNum.length === cNum.length && sNum.every((v, i) => v === cNum[i]);
                const overlap = sNum.some((v) => cNum.includes(v));
                isCorrect = exact;
                isAlmost = !exact && overlap;
            }
        }

        // Logging: [SCORING] id=... semantic=... keyword=... concept=... final=... cached=true/false
        let semantic = 0;
        let keyword = 0;
        let concept = 0;
        let finalVal = isCorrect ? 1.0 : 0.0;

        if (aiScoreComponents) {
            semantic = aiScoreComponents.semantic?.score ?? 0;
            keyword = aiScoreComponents.keyword?.score ?? 0;
            concept = aiScoreComponents.concept?.score ?? 0;
            finalVal = aiScoreComponents.raw_combined_score ?? (isCorrect ? 1.0 : 0.0);
        }

        console.log(`[SCORING] id=${question.id} semantic=${semantic} keyword=${keyword} concept=${concept} final=${finalVal} cached=${isCached}`);

        return {
            isCorrect,
            isAlmost,
            explanation: aiExplanation || question.explanation,
            scoreComponents: aiScoreComponents,
        };
    }

    static async _gradeAnswersBatch(userId, questions, submittedAnswers) {
        const answerMap = new Map(
            submittedAnswers.map((item) => [
                item.questionId,
                {
                    selectedAnswers: [...new Set((item.selectedAnswers || []).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b),
                    answerText: String(item.answerText ?? '').trim(),
                    blankAnswers: Array.isArray(item.blankAnswers) ? item.blankAnswers.map((ans) => String(ans).trim()) : [],
                    matchAnswers: item.matchAnswers && typeof item.matchAnswers === 'object' ? item.matchAnswers : {},
                    responseTime: Number(item.responseTime || 0) / 1000,
                            // Never carry client-supplied scoring — always grade server-side

                },
            ])
        );

        const gradedResults = [];
        for (const question of questions) {
            const answer = answerMap.get(String(question.id));
            if (!answer) {
                gradedResults.push({
                    concept: question.topic || 'General',
                    is_correct: false,
                    response_time: 0.0,
                });
                continue;
            }

            // Always grade server-side — never pass client answer as cachedScoring
            const result = await this.gradeQuestionAnswer(userId, question, answer, null);
            
            // Enrich the answer in the original submittedAnswers array so it gets saved to DB
            const originalAns = submittedAnswers.find(a => String(a.questionId) === String(question.id));
            if (originalAns) {
                originalAns.isCorrect = result.isCorrect;
                originalAns.isAlmost = result.isAlmost;
                originalAns.explanation = result.explanation;
                originalAns.scoreComponents = result.scoreComponents;
            }

            gradedResults.push({
                concept: question.topic || 'General',
                is_correct: result.isCorrect,
                response_time: answer.responseTime || 0.0,
            });
        }
        return gradedResults;
    }

    static async generateExam(userId, payload) {
        cleanupCache();
        if (payload.mode === 'adaptive') {
            return this.generateAdaptiveExam(userId, payload);
        }
        const targetCount = payload.numberOfQuestions;
        const allowedTypes = [...new Set(payload.types)].filter((t) => SUPPORTED_TYPES.includes(t));
        if (allowedTypes.length === 0) {
            const err = new Error('No supported question types selected.');
            err.statusCode = 400;
            throw err;
        }
        const fallbackDifficulty = normalizeDifficulty(payload.difficulty);
        const fallbackTopic = payload.topics[0];

        console.log('[EXAM_INIT] mode=static subject=%s questions=%d types=[%s] difficulty=%s topic="%s"',
            payload.subject_id, targetCount, allowedTypes.join(','), payload.difficulty, fallbackTopic);

        // --- RAG Retrieval Stage ---
        let context = '';
        try {
            const retrieveRes = await engineClient.post('/retrieve', {
                subject_id: payload.subject_id,
                topic: fallbackTopic,
                top_k: 20,
                ...(payload.material_ids?.length > 0 ? { material_ids: payload.material_ids } : {}),
            }, { timeout: 300000 });

            if (retrieveRes.data?.chunks) {
                const rawContext = retrieveRes.data.chunks.map(c => c.content).join('\n\n');
                context = rawContext.substring(0, EXAM_CONTEXT_MAX_CHARS);
                console.log('[EXAM_RAG_CONTEXT] mode=static chunk_count=%d raw_chars=%d truncated_chars=%d injected_topic="%s"',
                    retrieveRes.data.chunks.length, rawContext.length, context.length, fallbackTopic);
            }
        } catch (err) {
            console.error('[ExamService] RAG retrieval failed, falling back to zero-shot:', err.message);
        }

        const accepted = [];
        const seen = new Set();

        let attempts = 0;
        while (accepted.length < targetCount && attempts < MAX_GENERATION_ATTEMPTS) {
            attempts += 1;
            const missing = targetCount - accepted.length;
            const currentDifficulty = getDifficultyForProgress(accepted.length, targetCount, payload.difficulty);

            const batch = await requestQuestionBatch({
                numberOfQuestions: Math.ceil(missing * OVERFETCH_FACTOR),
                difficulty: currentDifficulty,
                topics: payload.topics,
                allowedTypes,
                fallbackTopic,
                fallbackDifficulty: currentDifficulty,
                seen,
                existingQuestions: accepted.map((q) => q.question),
                options: { context },
            });
            accepted.push(...batch);
        }

        let questions = accepted;
        if (questions.length > targetCount) {
            questions = questions.slice(0, targetCount);
        }
        if (questions.length < targetCount) {
            const missing = targetCount - questions.length;
            const regenerated = await regenerateQuestions({
                missing,
                difficulty: payload.difficulty,
                topics: payload.topics,
                allowedTypes,
                fallbackTopic,
                fallbackDifficulty,
                seen,
                existingQuestions: questions.map((q) => q.question),
                context,
            });
            questions = [...questions, ...regenerated];
        }

        if (questions.length === 0) {
            const err = new Error('Could not generate any valid questions. Ensure your materials have sufficient content and retry.');
            err.statusCode = 422;
            throw err;
        }
        if (questions.length < targetCount) {
            console.warn('[EXAM_GENERATION] mode=static partial-result have=%d wanted=%d — returning partial exam', questions.length, targetCount);
        }

        const createdAt = new Date();
        const fullQuestions = questions.slice(0, targetCount);
        console.log('[EXAM_GENERATION] mode=static total_valid=%d using=%d types=[%s] first_q="%s"',
            questions.length, fullQuestions.length,
            [...new Set(fullQuestions.map(q => q.type))].join(','),
            String(fullQuestions[0]?.question ?? '').slice(0, 80));
        const examId = randomUUID();
        const exam = {
            id: examId,
            title: payload.title || `Mock Exam - ${payload.topics.join(', ')}`,
            questions: fullQuestions.map((q) => ({
                id: q.id,
                type: q.type,
                question: q.question,
                options: q.options,
                acceptedAnswers: q.acceptedAnswers,
                blankAnswers: q.blankAnswers,
                pairs: q.pairs,
                rightOptions: q.rightOptions,
                explanation: q.explanation,
                difficulty: q.difficulty,
                topic: q.topic,
            })),
            timeLimit: payload.timeLimit,
            createdAt,
        };

        const examData = this._normalizeExam({
            ...exam,
            questions: fullQuestions,
        });

        examCache.set(examId, {
            userId,
            subjectId: payload.subject_id,
            createdAtMs: Date.now(),
            startedAt: createdAt.toISOString(),
            exam: examData.exam || examData,
            mode: 'static',
        });

        const materialExam = examData.exam || examData;

        // --- NEW: Persist to Materials table so it appears in history ---
        // materialDbId holds the DB-assigned UUID. All downstream calls (saveAttempt,
        // submitExam, exam_attempts FK) must use this ID, not the temporary examId.
        let materialDbId = null;
        try {
            const createdMat = await Material.create(
                userId,
                payload.subject_id,
                exam.title,
                '', // No text content for exams
                'exam',
                PROCESSING
            );
            if (createdMat) {
                materialDbId = createdMat.id;
                await Material.updateAIResult(materialDbId, userId, materialExam, {
                    materialType: 'exam',
                    count: payload.numberOfQuestions,
                });
                // Re-key the cache under the DB material UUID so saveAttempt/submitExam
                // FK references on exam_attempts.material_id resolve correctly.
                examCache.delete(examId);
                examCache.set(materialDbId, {
                    userId,
                    subjectId: payload.subject_id,
                    createdAtMs: Date.now(),
                    startedAt: createdAt.toISOString(),
                    exam: examData.exam || examData,
                    mode: 'static',
                    materialIds: payload.material_ids || null,
                });
            }
        } catch (dbErr) {
            console.error('[ExamService] Failed to persist exam to history:', dbErr.message);
            // Non-blocking: cache is still keyed by temporary examId for this session
        }

        cleanupCache();
        return { ...exam, id: materialDbId ?? examId };
    }

    static async submitExam(userId, payload) {
        cleanupCache();
        const record = await this._getExamRecord(userId, payload.examId);
        if (!record || record.userId !== userId) {
            const err = new Error('Exam not found or expired. Generate a new exam and try again.');
            err.statusCode = 404;
            throw err;
        }

        // Fetch existing attempt from DB to check for cached scoreComponents
        let existingAnswers = [];
        try {
            const attemptRes = await query(
                'SELECT answers FROM exam_attempts WHERE user_id = $1 AND material_id = $2 AND submitted_at IS NULL',
                [userId, payload.examId]
            );
            if (attemptRes.rows.length > 0) {
                existingAnswers = attemptRes.rows[0].answers || [];
            }
        } catch (err) {
            console.error('[ExamService] Failed to load existing attempt for submission:', err.message);
        }

        const dbAnswerMap = new Map(
            existingAnswers.map((item) => [String(item.questionId), item])
        );

        const answerMap = new Map(
            payload.answers.map((item) => [
                item.questionId,
                {
                    selectedAnswers: [...new Set((item.selectedAnswers || []).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b),
                    answerText: sanitizeString(item.answerText || ''),
                    blankAnswers: Array.isArray(item.blankAnswers) ? item.blankAnswers.map((ans) => sanitizeString(ans)) : [],
                    matchAnswers: item.matchAnswers && typeof item.matchAnswers === 'object' ? item.matchAnswers : {},
                    // Never carry scoring fields from the client — always grade server-side
                },
            ])
        );

        // --- MANDATORY NORMALIZATION LAYER ---
        const normalizedExam = this._normalizeExam(record.exam);
        const questionsToGrade = normalizedExam.questions || [];

        console.log('[EXAM_SUBMISSION] examId=%s questions=%d answers=%d mode=%s',
            payload.examId, questionsToGrade.length, (payload.answers || []).length,
            record.exam?.mode || 'static');

        if (questionsToGrade.length === 0) {
            const err = new Error('Exam has no gradable questions. The exam may be corrupted — please generate a new one.');
            err.statusCode = 422;
            throw err;
        }
        const detailsPromises = questionsToGrade.map(async (question) => {
            const answer = answerMap.get(String(question.id)) || { selectedAnswers: [], answerText: '', blankAnswers: [], matchAnswers: {} };
            const dbAnswer = dbAnswerMap.get(String(question.id));

            // Only reuse server-stored scoring (same answer text) — never trust client-supplied values
            const cachedScoring = (dbAnswer && dbAnswer.scoreComponents && dbAnswer.answerText === answer.answerText)
                ? dbAnswer
                : null;

            // Grade using the unified function
            const result = await this.gradeQuestionAnswer(userId, question, answer, cachedScoring);

            return {
                questionId: String(question.id),
                isCorrect: result.isCorrect,
                ...(result.isAlmost ? { isAlmost: true } : {}),
                userAnswer: answer.selectedAnswers,
                userAnswerText: answer.answerText,
                correctAnswers: [...(question.correctAnswers || [])].sort((a, b) => a - b),
                correctAnswerText: (question.acceptedAnswers || [])[0],
                acceptedAnswers: question.acceptedAnswers,
                blankAnswers: question.blankAnswers,
                pairs: question.pairs,
                explanation: result.explanation,
                scoreComponents: result.scoreComponents,
            };
        });

        const details = await Promise.all(detailsPromises);
        const score = details.filter((d) => d.isCorrect).length;
        const total = questionsToGrade.length;
        const semanticCount = details.filter((d) => d.scoreComponents !== undefined).length;
        const silentFails = details.filter((d) => !d.isCorrect && d.userAnswerText && !d.scoreComponents).length;

        console.log('[EXAM_SCORING] examId=%s score=%d/%d semantic_graded=%d silent_engine_fails=%d',
            payload.examId, score, total, semanticCount, silentFails);

        // Persist graded result to exam_attempts so it survives page refreshes.
        // Upserts unconditionally — re-submissions (retry flow) overwrite the previous result.
        try {
            await query(
                `INSERT INTO exam_attempts
                    (user_id, material_id, subject_id, answers, started_at,
                     submitted_at, score, max_score, result_details, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, NOW())
                 ON CONFLICT (user_id, material_id) DO UPDATE SET
                    submitted_at   = NOW(),
                    score          = EXCLUDED.score,
                    max_score      = EXCLUDED.max_score,
                    result_details = EXCLUDED.result_details,
                    answers        = EXCLUDED.answers,
                    updated_at     = NOW()`,
                [
                    userId,
                    payload.examId,
                    record.subjectId ?? null,
                    JSON.stringify(payload.answers || []),
                    payload.startedAt ? new Date(payload.startedAt) : new Date(record.startedAt),
                    score,
                    total,
                    JSON.stringify(details),
                ]
            );
        } catch (dbErr) {
            console.error('[ExamService] Failed to persist exam result to DB:', dbErr.message);
            // Non-blocking: still return the graded result to the client
        }

        return { score, total, details };
    }

    static async saveAttempt(userId, payload) {
        cleanupCache();
        const record = await this._getExamRecord(userId, payload.examId);
        if (!record || record.userId !== userId) {
            const err = new Error('Exam not found or expired. Generate a new exam and try again.');
            err.statusCode = 404;
            throw err;
        }

        const { rows } = await query(
            `INSERT INTO exam_attempts
                (user_id, material_id, subject_id, current_index, answers, flagged, started_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (user_id, material_id) DO UPDATE SET
                current_index = EXCLUDED.current_index,
                answers       = EXCLUDED.answers,
                flagged       = EXCLUDED.flagged,
                started_at    = COALESCE(exam_attempts.started_at, EXCLUDED.started_at),
                updated_at    = NOW()
             WHERE exam_attempts.submitted_at IS NULL
             RETURNING updated_at`,
            [
                userId,
                payload.examId,
                record.subjectId ?? null,
                Number.isInteger(payload.currentIndex) ? payload.currentIndex : 0,
                JSON.stringify(Array.isArray(payload.answers) ? payload.answers : []),
                JSON.stringify(payload.flagged && typeof payload.flagged === 'object' ? payload.flagged : {}),
                payload.startedAt ? new Date(payload.startedAt) : null,
            ]
        );

        const updatedAt = rows[0]?.updated_at?.toISOString() ?? new Date().toISOString();
        return { saved: rows.length > 0, updatedAt };
    }

    static async getAttempt(userId, examId) {
        cleanupCache();
        const record = await this._getExamRecord(userId, examId);
        if (!record || record.userId !== userId) {
            const err = new Error('Exam not found or expired. Generate a new exam and try again.');
            err.statusCode = 404;
            throw err;
        }

        const { rows } = await query(
            `SELECT current_index, answers, flagged, started_at,
                    submitted_at, score, max_score, result_details, updated_at,
                    mode, batch_index
             FROM exam_attempts
             WHERE user_id = $1 AND material_id = $2`,
            [userId, examId]
        );

        if (!rows[0]) {
            return {
                examId,
                currentIndex: 0,
                answers: [],
                flagged: {},
                startedAt: record.startedAt,
                updatedAt: null,
            };
        }

        const row = rows[0];
        const base = {
            examId,
            currentIndex: row.current_index,
            answers:      Array.isArray(row.answers) ? row.answers : [],
            flagged:      (row.flagged && typeof row.flagged === 'object' && !Array.isArray(row.flagged))
                              ? row.flagged : {},
            startedAt:    row.started_at?.toISOString() ?? record.startedAt,
            updatedAt:    row.updated_at?.toISOString() ?? null,
            mode:         row.mode || 'static',
            batchIndex:   row.batch_index || 0,
        };

        if (row.submitted_at) {
            return {
                ...base,
                submittedAt: row.submitted_at.toISOString(),
                result: (row.score !== null && row.max_score !== null) ? {
                    score:   row.score,
                    total:   row.max_score,
                    details: Array.isArray(row.result_details) ? row.result_details : [],
                } : null,
            };
        }

        return base;
    }

    static async _getExamRecord(userId, examId) {
        let record = examCache.get(examId);
        if (record && record.userId === userId) return record;

        try {
            const dbRes = await query('SELECT id, subject_id, title, type, ai_generated_content, created_at FROM materials WHERE id = $1 AND user_id = $2', [examId, userId]);
            if (dbRes.rows.length === 0) return null;

            const mat = dbRes.rows[0];
            if (mat.type !== 'exam' && mat.type !== 'mock_exam') return null;

            let contentObj;
            try {
                contentObj = typeof mat.ai_generated_content === 'string' ? JSON.parse(mat.ai_generated_content) : mat.ai_generated_content;
            } catch (e) {
                return null;
            }

            const normalized = this._normalizeExam(contentObj);
            const questions = normalized.questions;


            record = {
                userId,
                subjectId: mat.subject_id,
                createdAtMs: new Date(mat.created_at).getTime(),
                startedAt: new Date(mat.created_at).toISOString(),
                exam: {
                    id: mat.id,
                    title: mat.title || 'Mock Exam',
                    questions: questions,
                    timeLimit: contentObj?.timeLimit || null,
                    mode: contentObj?.mode || 'static',
                    targetTotal: contentObj?.targetTotal || questions.length,
                    batchSize: contentObj?.batchSize || 5,
                    allowedTypes: contentObj?.allowedTypes || [],
                    topics: contentObj?.topics || [],
                }
            };
            examCache.set(examId, record);
            return record;
        } catch (dbErr) {
            console.error('[ExamService] DB fetch failed in _getExamRecord', dbErr.message);
            return null;
        }
    }
}

export default ExamService;
