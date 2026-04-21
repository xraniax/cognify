import React, { useState } from 'react';
import { PanelRightClose, MessageSquarePlus, Mic, MicOff, Send, Bot, User, Volume2 } from 'lucide-react';

const ChatPanel = ({
    messages,
    currentQuestion,
    setCurrentQuestion,
    handleChat,
    handleVoiceInput,
    handleTTS,
    isThinking,
    isListening,
    chatEndRef,
    contextInfo,
    chatError,
    onClearChat,
    onCollapse
}) => {
    return (
        <div className={`panel-inner chat-panel`} style={{ background: 'var(--c-canvas)' }}>
            {/* Panel Header — always visible */}
            <div className="panel-header px-6 py-5 bg-white/80 backdrop-blur-md sticky top-0 z-10 transition-all border-b-2 border-indigo-50 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                    </div>
                    <span className="panel-title font-black tracking-[0.2em] uppercase text-[10px] text-gray-400">AI Tutor</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="p-2 rounded-2xl transition-all hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 hover:scale-110 active:scale-90"
                        onClick={onClearChat}
                        title="Clear conversation"
                    >
                        <MessageSquarePlus className="w-5 h-5" />
                    </button>
                    <button
                        className="p-2 rounded-2xl transition-all hover:bg-red-50 text-gray-400 hover:text-red-500 hover:scale-110 active:scale-90"
                        onClick={onCollapse}
                        title="Hide panel"
                    >
                        <PanelRightClose className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Chat body */}
            <>
                {/* Context info */}
                <div className="px-3 py-1 border-b" style={{ background: 'var(--c-surface-alt)', borderColor: 'var(--c-border-soft)' }}>
                    <span className="text-xs" style={{ color: 'var(--c-text-muted)' }}>{contextInfo}</span>
                </div>

                {/* Messages */}
                <div className="chat-messages p-4 space-y-6" style={{ background: 'var(--c-canvas)' }}>
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-10 space-y-6">
                            <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center animate-bounce shadow-inner">
                                <Bot className="w-12 h-12 text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-black uppercase tracking-[0.2em] text-indigo-950">Your Tutor Awaits</p>
                                <p className="text-xs font-bold text-gray-400 max-w-[220px] leading-relaxed uppercase tracking-widest">Ask anything about your selected documents to begin.</p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                            <div className={`flex items-end gap-3 max-w-[92%] group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-10 h-10 rounded-2xl shadow-sm border-2 flex items-center justify-center shrink-0 mb-1 transition-transform group-hover:scale-110 ${
                                    msg.role === 'ai' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-purple-50 border-purple-100 text-purple-600'
                                }`}>
                                    {msg.role === 'ai' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                </div>
                                <div className={`px-6 py-5 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 relative ${
                                    msg.role === 'user'
                                        ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-none'
                                        : 'bg-white text-indigo-950 border-2 border-indigo-50 rounded-bl-none'
                                }`}>
                                    <div className="whitespace-pre-wrap font-bold text-[13px] leading-relaxed">{msg.content}</div>
                                    {msg.role === 'ai' && (
                                        <button
                                            onClick={() => handleTTS(msg.content)}
                                            className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 text-indigo-400 hover:text-indigo-600"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                <Volume2 className="w-3.5 h-3.5" />
                                            </div>
                                            Speak
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex items-start gap-2 max-w-[90%] animate-in fade-in duration-300">
                            <div className="w-8 h-8 rounded-full shadow-sm border flex items-center justify-center shrink-0" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                                <Bot className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                            </div>
                            <div className="px-5 py-4 rounded-[1.25rem] rounded-bl-none shadow-xl flex items-center gap-2 border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-primary-light)' }}>
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: 'var(--c-primary-light)' }}></div>
                                    <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: 'var(--c-primary)' }}></div>
                                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--c-primary-dark)' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {chatError && (
                        <div className="p-3 border rounded-xl text-[10px] font-bold uppercase tracking-widest text-center mx-4" style={{ background: 'var(--c-danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--c-danger)' }}>
                            {chatError}
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="chat-input-area border-t-2 border-indigo-50 p-5 bg-indigo-50/20">
                    <form onSubmit={handleChat} className="flex items-center gap-3 p-3 rounded-[2rem] border-4 border-white bg-white/80 backdrop-blur-md transition-all shadow-lg focus-within:shadow-xl focus-within:-translate-y-0.5">
                        <button
                            type="button"
                            onClick={handleVoiceInput}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${isListening ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}
                        >
                            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                        <input
                            className="flex-grow bg-transparent border-none outline-none text-sm font-black placeholder:text-gray-300 placeholder:uppercase placeholder:tracking-widest px-2"
                            placeholder="Ask your tutor..."
                            value={currentQuestion}
                            onChange={(e) => setCurrentQuestion(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isThinking || !currentQuestion.trim()}
                            className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-30 disabled:bg-indigo-400 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-indigo-200"
                        >
                            <Send className="w-5 h-5 ml-1" />
                        </button>
                    </form>
                </div>
            </>
        </div>
    );
};

export default ChatPanel;
