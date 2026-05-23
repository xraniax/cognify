import asyncHandler from '../utils/asyncHandler.js';
import MaterialService from '../services/material.service.js';
import ExamService from '../services/exam.service.js';

class ExamController {
    static generate = asyncHandler(async (req, res) => {
        const { subject_id, numberOfQuestions, difficulty, topics, types, title, timeLimit, mode, material_ids } = req.body;

        const result = await ExamService.generateExam(req.user.id, {
            subject_id,
            numberOfQuestions,
            difficulty,
            topics,
            types,
            title,
            timeLimit,
            mode,
            material_ids: Array.isArray(material_ids) && material_ids.length > 0 ? material_ids : null,
        });

        res.status(200).json({
            status: 'success',
            data: result,
        });
    });

    static nextBatch = asyncHandler(async (req, res) => {
        const result = await ExamService.nextBatch(req.user.id, req.body);
        res.status(200).json({
            status: 'success',
            data: result,
        });
    });

    static submit = asyncHandler(async (req, res) => {
        const result = await ExamService.submitExam(req.user.id, req.body);
        res.status(200).json({
            status: 'success',
            data: result,
        });
    });

    static saveAttempt = asyncHandler(async (req, res) => {
        const result = await ExamService.saveAttempt(req.user.id, req.body);
        res.status(200).json({
            status: 'success',
            data: result,
        });
    });

    static getAttempt = asyncHandler(async (req, res) => {
        const attempt = await ExamService.getAttempt(req.user.id, req.params.examId);
        res.status(200).json({
            status: 'success',
            data: attempt,
        });
    });
}

export default ExamController;
