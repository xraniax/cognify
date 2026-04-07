import asyncHandler from '../utils/asyncHandler.js';
import ExamService from '../services/exam.service.js';

class ExamController {
    static generate = asyncHandler(async (req, res) => {
        const exam = await ExamService.generateExam(req.user.id, req.body);
        res.status(201).json({
            status: 'success',
            data: exam,
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
