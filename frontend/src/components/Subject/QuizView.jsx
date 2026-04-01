import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, 
    XCircle, 
    ChevronRight, 
    RotateCcw, 
    Trophy,
    HelpCircle,
    Info,
    ArrowRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const QuizView = ({ quizData }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [userAnswers, setUserAnswers] = useState([]);

    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <HelpCircle className="w-12 h-12 mb-4 opacity-20" />
                <p>No quiz questions available.</p>
            </div>
        );
    }

    const { questions } = quizData;
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / questions.length) * 100;

    const handleOptionSelect = (option) => {
        if (isSubmitted) return;
        setSelectedOption(option);
    };

    const handleSubmit = () => {
        if (selectedOption === null || isSubmitted) return;
        
        const isCorrect = selectedOption === currentQuestion.correct_answer;
        if (isCorrect) setScore(prev => prev + 1);
        
        setIsSubmitted(true);
        setUserAnswers(prev => [...prev, {
            questionId: currentQuestion.id,
            selected: selectedOption,
            isCorrect
        }]);
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
        } else {
            setShowResults(true);
        }
    };

    const resetQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsSubmitted(false);
        setScore(0);
        setShowResults(false);
        setUserAnswers([]);
    };

    if (showResults) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto py-12 px-6"
            >
                <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-100/50 border border-gray-100 p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
                    
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", damping: 12 }}
                        className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <Trophy className="w-12 h-12 text-indigo-500" />
                    </motion.div>

                    <h2 className="text-3xl font-black text-gray-900 mb-2">Quiz Complete!</h2>
                    <p className="text-gray-500 mb-8 font-medium">You've mastered some new knowledge today.</p>

                    <div className="grid grid-cols-2 gap-4 mb-10">
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-2">
                            <div className="text-4xl font-black text-indigo-600 mb-1">{score}/{questions.length}</div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Correct Answers</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-2">
                            <div className="text-4xl font-black text-purple-600 mb-1">{percentage}%</div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Overall Score</div>
                        </div>
                    </div>

                    <button 
                        onClick={resetQuiz}
                        className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all mx-auto shadow-lg shadow-gray-200"
                    >
                        <RotateCcw className="w-5 h-5" />
                        Try Again
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 md:py-12 px-6">
            {/* Header / Progress */}
            <div className="mb-10">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider mb-2">
                            Level {currentQuestionIndex + 1}
                        </span>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">Knowledge Check</h2>
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-black text-indigo-600">{currentQuestionIndex + 1}</span>
                        <span className="text-sm font-bold text-gray-300"> / {questions.length}</span>
                    </div>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    />
                </div>
            </div>

            {/* Question Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-[2rem] shadow-xl shadow-indigo-100/20 border border-gray-100 p-8 md:p-10 mb-8"
                >
                    <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-10 leading-tight">
                        {currentQuestion.question}
                    </h3>

                    <div className="space-y-4">
                        {currentQuestion.options && currentQuestion.options.length > 0 ? (
                            currentQuestion.options.map((option, idx) => {
                                const isSelected = selectedOption === option;
                                const isCorrect = isSubmitted && option === currentQuestion.correct_answer;
                                const isWrong = isSubmitted && isSelected && option !== currentQuestion.correct_answer;

                                return (
                                    <motion.button
                                        key={idx}
                                        whileHover={!isSubmitted ? { scale: 1.01 } : {}}
                                        whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                                        onClick={() => handleOptionSelect(option)}
                                        disabled={isSubmitted}
                                        className={cn(
                                            "w-full p-5 rounded-2xl text-left font-bold transition-all border-2 flex items-center justify-between group",
                                            !isSubmitted && isSelected && "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-lg shadow-indigo-100",
                                            !isSubmitted && !isSelected && "border-gray-50 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white",
                                            isSubmitted && isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-700",
                                            isSubmitted && isWrong && "border-rose-500 bg-rose-50 text-rose-700",
                                            isSubmitted && !isCorrect && !isWrong && "border-gray-50 bg-gray-50 text-gray-300 opacity-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-colors",
                                                !isSubmitted && isSelected ? "bg-indigo-500 text-white" : "bg-white text-gray-400 group-hover:text-indigo-400 border border-gray-100 shadow-sm",
                                                isSubmitted && isCorrect && "bg-emerald-500 text-white",
                                                isSubmitted && isWrong && "bg-rose-500 text-white"
                                            )}>
                                                {String.fromCharCode(65 + idx)}
                                            </div>
                                            <span className="flex-1">{option}</span>
                                        </div>
                                        
                                        {isSubmitted && (
                                            <div className="flex-shrink-0 ml-4">
                                                {isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                                                {isWrong && <XCircle className="w-6 h-6 text-rose-500" />}
                                            </div>
                                        )}
                                    </motion.button>
                                );
                            })
                        ) : (
                            <div className="p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                                <p className="text-gray-500 font-medium mb-2 italic">Thinking of the answer?</p>
                                <p className="text-gray-400 text-xs">This is a short-answer question. Press 'Reveal Answer' when you're ready.</p>
                            </div>
                        )}
                    </div>

                    <AnimatePresence>
                        {isSubmitted && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-10 overflow-hidden"
                            >
                                <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <Info className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm text-indigo-900 mb-1 uppercase tracking-wider">The Insight</h4>
                                        <p className="text-indigo-800/80 text-sm leading-relaxed font-medium">
                                            {currentQuestion.explanation}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </AnimatePresence>

            {/* Footer Actions */}
            <div className="flex justify-end gap-4">
                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
                        disabled={currentQuestion.options && currentQuestion.options.length > 0 && selectedOption === null}
                        className={cn(
                            "px-10 py-5 rounded-2xl font-black transition-all flex items-center gap-3 shadow-xl",
                            (currentQuestion.options && currentQuestion.options.length > 0 && selectedOption === null)
                                ? "bg-gray-100 text-gray-300 transform-none cursor-not-allowed" 
                                : "bg-gray-900 text-white hover:bg-black hover:-translate-y-1 shadow-gray-200"
                        )}
                    >
                        {currentQuestion.options && currentQuestion.options.length > 0 ? 'Submit Answer' : 'Reveal Answer'}
                        <CheckCircle2 className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onClick={handleNext}
                        className="px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center gap-3 shadow-xl shadow-indigo-100 hover:-translate-y-1"
                    >
                        {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Summary'}
                        <ArrowRight className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default QuizView;
