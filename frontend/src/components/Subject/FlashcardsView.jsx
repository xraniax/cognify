import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, 
    ChevronRight, 
    RotateCw, 
    Brain,
    Layers,
    Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const FlashcardsView = ({ flashcardsData }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [direction, setDirection] = useState(0);
    const [viewedCount, setViewedCount] = useState(new Set([0]));

    if (!flashcardsData || !flashcardsData.cards || flashcardsData.cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <Layers className="w-12 h-12 mb-4 opacity-20" />
                <p>No flashcards available.</p>
            </div>
        );
    }

    const { cards } = flashcardsData;
    const currentCard = cards[currentIndex];
    const progress = ((currentIndex + 1) / cards.length) * 100;

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleNext = () => {
        if (currentIndex < cards.length - 1) {
            setDirection(1);
            setIsFlipped(false);
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setViewedCount(prev => new Set(prev).add(currentIndex + 1));
            }, 50);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setDirection(-1);
            setIsFlipped(false);
            setTimeout(() => {
                setCurrentIndex(prev => prev - 1);
            }, 50);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 md:py-12 px-6">
            {/* Header Control */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Active Recall</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                                {cards.length} Cards
                            </span>
                            <span className="text-[10px] font-bold text-gray-400">
                                • {viewedCount.size} reviewed
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm self-start md:self-auto">
                    <button 
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            currentIndex === 0 ? "text-gray-200 cursor-not-allowed" : "text-gray-500 hover:bg-gray-50 hover:text-indigo-600"
                        )}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="px-4 text-sm font-black text-gray-900 min-w-[70px] text-center">
                        {currentIndex + 1} <span className="text-gray-300 mx-1">/</span> {cards.length}
                    </div>
                    <button 
                        onClick={handleNext}
                        disabled={currentIndex === cards.length - 1}
                        className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            currentIndex === cards.length - 1 ? "text-gray-200 cursor-not-allowed" : "text-gray-500 hover:bg-gray-50 hover:text-indigo-600"
                        )}
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full mb-12 overflow-hidden max-w-sm mx-auto">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-indigo-600 rounded-full"
                />
            </div>

            {/* Flashcard Component */}
            <div className="relative perspective-1000 h-[350px] md:h-[450px] w-full max-w-2xl mx-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ x: direction * 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -direction * 50, opacity: 0 }}
                        className="w-full h-full cursor-pointer relative"
                        onClick={handleFlip}
                    >
                        <motion.div
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                            className="w-full h-full relative transform-style-preserve-3d"
                        >
                            {/* Front of Card */}
                            <div className={cn(
                                "absolute inset-0 w-full h-full rounded-[2.5rem] bg-indigo-600 p-8 md:p-12 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl shadow-indigo-200",
                                isFlipped ? "pointer-events-none" : ""
                            )}>
                                <div className="absolute top-8 left-8 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                        <Brain className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Question</span>
                                </div>
                                
                                <h3 className="text-2xl md:text-4xl font-bold text-white leading-snug">
                                    {currentCard.front}
                                </h3>

                                <div className="absolute bottom-8 text-white/40 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                                    <RotateCw className="w-4 h-4" /> Click to reveal answer
                                </div>
                            </div>

                            {/* Back of Card */}
                            <div className={cn(
                                "absolute inset-0 w-full h-full rounded-[2.5rem] bg-white p-8 md:p-12 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl border-2 border-indigo-100",
                                !isFlipped ? "pointer-events-none" : ""
                            )} style={{ transform: 'rotateY(180deg)' }}>
                                <div className="absolute top-8 left-8 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Answer</span>
                                </div>

                                <h3 className="text-2xl md:text-4xl font-bold text-gray-800 leading-snug">
                                    {currentCard.back}
                                </h3>

                                <div className="absolute bottom-8 text-gray-300 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                                    <RotateCw className="w-4 h-4" /> Click to flip back
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Keyboard Hint */}
            <p className="text-center mt-12 text-gray-400 text-xs font-medium uppercase tracking-widest">
                Use your keyboard or the buttons above to navigate
            </p>
        </div>
    );
};

export default FlashcardsView;
