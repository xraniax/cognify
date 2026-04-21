import React from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { X, Pin, FileText, Sparkles, BrainCircuit, Layers, CheckCircle2, Trash2 } from 'lucide-react';

const WorkspaceTabs = ({
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    renderTabContent
}) => {

    const handleClose = (e, tabId) => {
        e.stopPropagation();

        // Don't close pinned tabs
        const tab = tabs.find(t => t.id === tabId);
        if (tab?.pinned) return;

        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);

        // If we closed the active tab, fallback to the previous one or the generator tab
        if (activeTabId === tabId) {
            const index = tabs.findIndex(t => t.id === tabId);
            if (newTabs.length > 0) {
                // Try to select the one to the left, fallback to 0
                const nextIndex = index > 0 ? index - 1 : 0;
                setActiveTabId(newTabs[nextIndex].id);
            } else {
                setActiveTabId(null);
            }
        }
    };

    const handleCloseAll = () => {
        const pinnedTabs = tabs.filter(t => t.pinned);
        setTabs(pinnedTabs);
        // If current tab is closed, switch to the first pinned one (usually generator)
        if (!pinnedTabs.some(t => t.id === activeTabId)) {
            setActiveTabId(pinnedTabs[0]?.id || null);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--c-canvas)' }}>
            {/* Tab Header Bar */}
            <div className="flex-shrink-0 pb-0 pt-1.5 px-2 border-b flex items-end justify-between overflow-hidden" style={{ background: 'var(--c-surface-alt)', borderColor: 'var(--c-border)' }}>
                <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth flex items-end pr-2">
                    <Reorder.Group
                        axis="x"
                        values={tabs}
                        onReorder={setTabs}
                        className="flex gap-1.5 min-w-max pb-0"
                    >
                        <AnimatePresence>
                            {tabs.map((tab) => {
                                const isActive = activeTabId === tab.id;
                                return (
                                    <Reorder.Item
                                        key={tab.id}
                                        value={tab}
                                        className={`relative flex items-center gap-2 px-3 py-2 rounded-t-xl cursor-pointer select-none transition-all flex-shrink-0 group
                                            ${isActive
                                                ? 'translate-y-[1px] z-10'
                                                : '-translate-y-[1px]'
                                            }`}
                                        style={isActive ? {
                                            background: 'var(--c-surface)',
                                            borderTop: '1px solid var(--c-border)',
                                            borderLeft: '1px solid var(--c-border)',
                                            borderRight: '1px solid var(--c-border)',
                                            boxShadow: 'var(--shadow-xs)'
                                        } : {
                                            background: 'var(--c-canvas)',
                                            borderTop: '1px solid transparent',
                                            borderLeft: '1px solid transparent',
                                            borderRight: '1px solid transparent',
                                            color: 'var(--c-text-muted)'
                                        }}
                                        onClick={() => setActiveTabId(tab.id)}
                                    >
                                        {/* Icon */}
                                        <div className={`flex-shrink-0 ${isActive ? '' : 'opacity-70'}`}>
                                            {tab.id === 'generator' ? (
                                                <BrainCircuit className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                            ) : tab.type === 'upload' ? (
                                                <FileText className="w-3.5 h-3.5" style={{ color: 'var(--c-text-muted)' }} />
                                            ) : tab.type === 'summary' ? (
                                                <FileText className="w-3.5 h-3.5" style={{ color: 'var(--c-accent)' }} />
                                            ) : tab.type === 'quiz' ? (
                                                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--c-success)' }} />
                                            ) : tab.type === 'flashcards' ? (
                                                <Layers className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                            ) : tab.type === 'exam' || tab.type === 'exam_session' ? (
                                                <BrainCircuit className="w-3.5 h-3.5" style={{ color: 'var(--c-warning)' }} />
                                            ) : (
                                                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--c-accent)' }} />
                                            )}
                                        </div>

                                        {/* Title */}
                                        <span
                                            className={`text-[11px] font-bold max-w-[140px] truncate transition-all
                                                ${tab.isDeleted ? 'line-through opacity-70' : ''}
                                            `}
                                            style={{
                                                color: isActive ? 'var(--c-text)' : (tab.isDeleted ? 'var(--c-danger)' : 'inherit')
                                            }}
                                            title={tab.isDeleted ? "This file has been deleted" : tab.title}
                                        >
                                            {tab.title}
                                        </span>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 ml-2 pl-1 border-l" style={{ borderColor: 'var(--c-border-soft)' }}>
                                            {tab.pinned ? (
                                                <Pin className={`w-3 h-3`} style={{ color: isActive ? 'var(--c-accent)' : 'var(--c-text-muted)' }} />
                                            ) : (
                                                <button
                                                    onClick={(e) => handleClose(e, tab.id)}
                                                    className={`p-0.5 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors ${isActive ? '' : 'opacity-0 group-hover:opacity-100'}`}
                                                    style={{ color: isActive ? 'var(--c-text-muted)' : 'inherit' }}
                                                    title="Close tab"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </Reorder.Item>
                                );
                            })}
                        </AnimatePresence>
                    </Reorder.Group>
                </div>

                {/* Close All Action */}
                {tabs.some(t => !t.pinned) && (
                    <div className="flex-shrink-0 flex items-center mb-1.5 ml-2">
                        <button
                            onClick={handleCloseAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-transparent group shadow-sm hover:border-red-100 hover:text-red-500 hover:bg-red-50"
                            style={{ color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}
                            title="Close all non-pinned tabs"
                        >
                            <Trash2 className="w-3 h-3 transition-transform group-hover:scale-110" />
                            <span className="hidden sm:inline">Close All</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Tab Content Area — overflow-hidden here so absolute inset-0 fills correctly; each content renders its own scroll */}
            <div className="flex-1 overflow-hidden min-h-0 relative" style={{ background: 'var(--c-surface)' }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTabId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="h-full absolute inset-0"
                    >
                        {renderTabContent(activeTabId)}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WorkspaceTabs;
