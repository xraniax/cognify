import React, { useMemo } from 'react';
import { BookOpen, Clock, Hash, Lightbulb, ChevronRight, AlignLeft } from 'lucide-react';

// ─── Inline Markdown Parser ───────────────────────────────────────────────────
// Converts **bold**, *italic*, `code` within a text string into React elements.
function parseInline(text, key = 0) {
    const parts = [];
    // combined regex for **bold**, *italic*, `code`
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0, m, i = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        if (m[2] !== undefined) parts.push(<strong key={`b${i}`} className="font-bold text-gray-900">{m[2]}</strong>);
        else if (m[3] !== undefined) parts.push(<em key={`e${i}`} className="italic text-indigo-700">{m[3]}</em>);
        else if (m[4] !== undefined) parts.push(<code key={`c${i}`} className="px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-mono">{m[4]}</code>);
        last = m.index + m[0].length;
        i++;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

// ─── Block Parser ─────────────────────────────────────────────────────────────
// Splits raw markdown text into structured block objects.
function parseBlocks(raw) {
    const lines = raw.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines (they act as separators between blocks)
        if (!trimmed) { i++; continue; }

        // H1
        if (/^# (.+)/.test(trimmed)) {
            blocks.push({ type: 'h1', text: trimmed.replace(/^# /, '') });
            i++; continue;
        }
        // H2
        if (/^## (.+)/.test(trimmed)) {
            blocks.push({ type: 'h2', text: trimmed.replace(/^## /, '') });
            i++; continue;
        }
        // H3
        if (/^### (.+)/.test(trimmed)) {
            blocks.push({ type: 'h3', text: trimmed.replace(/^### /, '') });
            i++; continue;
        }
        // Blockquote (highlight)
        if (/^> (.+)/.test(trimmed)) {
            blocks.push({ type: 'quote', text: trimmed.replace(/^> /, '') });
            i++; continue;
        }
        // Bullet list — collect consecutive items
        if (/^[-*+] (.+)/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^[-*+] (.+)/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[-*+] /, ''));
                i++;
            }
            blocks.push({ type: 'list', items });
            continue;
        }
        // Numbered list
        if (/^\d+\. (.+)/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^\d+\. (.+)/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+\. /, ''));
                i++;
            }
            blocks.push({ type: 'olist', items });
            continue;
        }
        // Paragraph
        const paraLines = [];
        while (i < lines.length && lines[i].trim() && !/^(#|>|[-*+] |\d+\. )/.test(lines[i].trim())) {
            paraLines.push(lines[i].trim());
            i++;
        }
        if (paraLines.length) blocks.push({ type: 'p', text: paraLines.join(' ') });
    }
    return blocks;
}

// ─── Section colors (cycles through) ─────────────────────────────────────────
const SECTION_PALETTES = [
    { border: 'border-indigo-200',   bg: 'bg-indigo-50/40',  icon: 'text-indigo-400',  dot: 'bg-indigo-400'  },
    { border: 'border-purple-200',   bg: 'bg-purple-50/40',  icon: 'text-purple-400',  dot: 'bg-purple-400'  },
    { border: 'border-violet-200',   bg: 'bg-violet-50/40',  icon: 'text-violet-400',  dot: 'bg-violet-400'  },
    { border: 'border-sky-200',      bg: 'bg-sky-50/40',     icon: 'text-sky-400',     dot: 'bg-sky-400'     },
    { border: 'border-teal-200',     bg: 'bg-teal-50/40',    icon: 'text-teal-400',    dot: 'bg-teal-400'    },
    { border: 'border-emerald-200',  bg: 'bg-emerald-50/40', icon: 'text-emerald-400', dot: 'bg-emerald-400' },
];

// ─── Block Renderer ───────────────────────────────────────────────────────────
function BlockRenderer({ block, idx }) {
    switch (block.type) {
        case 'h1':
            return (
                <h2 key={idx} className="text-2xl font-black text-gray-900 tracking-tight leading-snug mt-2 mb-1">
                    {parseInline(block.text)}
                </h2>
            );
        case 'h2': {
            const palette = SECTION_PALETTES[(idx) % SECTION_PALETTES.length];
            return (
                <div key={idx} className={`flex items-center gap-2.5 mt-6 mb-2 pb-2 border-b ${palette.border}`}>
                    <span className={`w-1.5 h-5 rounded-full ${palette.dot}`} />
                    <h3 className={`text-base font-black tracking-tight ${palette.icon.replace('text-', 'text-').replace('-400', '-700')}`}>
                        {parseInline(block.text)}
                    </h3>
                </div>
            );
        }
        case 'h3':
            return (
                <h4 key={idx} className="text-sm font-bold text-gray-700 uppercase tracking-wider mt-4 mb-1.5">
                    {parseInline(block.text)}
                </h4>
            );
        case 'quote':
            return (
                <div key={idx} className="flex gap-3 my-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200/70">
                    <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 leading-relaxed font-medium">
                        {parseInline(block.text)}
                    </p>
                </div>
            );
        case 'list':
            return (
                <ul key={idx} className="my-2 space-y-1.5">
                    {block.items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <span>{parseInline(item)}</span>
                        </li>
                    ))}
                </ul>
            );
        case 'olist':
            return (
                <ol key={idx} className="my-2 space-y-1.5">
                    {block.items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                            <span className="w-5 h-5 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-black flex items-center justify-center mt-0.5">
                                {ii + 1}
                            </span>
                            <span>{parseInline(item)}</span>
                        </li>
                    ))}
                </ol>
            );
        case 'p':
        default:
            return (
                <p key={idx} className="text-sm text-gray-700 leading-relaxed my-1.5">
                    {parseInline(block.text)}
                </p>
            );
    }
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ wordCount, readingMins, sectionCount }) {
    return (
        <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <AlignLeft className="w-3.5 h-3.5" />
                <span><strong className="text-gray-600 font-bold">{wordCount.toLocaleString()}</strong> words</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span><strong className="text-gray-600 font-bold">{readingMins}</strong> min read</span>
            </div>
            {sectionCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Hash className="w-3.5 h-3.5" />
                    <span><strong className="text-gray-600 font-bold">{sectionCount}</strong> sections</span>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const SummaryView = ({ summaryData, title }) => {

    const rawText = useMemo(() => {
        if (!summaryData) return '';
        if (typeof summaryData === 'string') return summaryData;
        // Handle {result: "..."}, {content: "..."}, or {summary: "..."}
        if (typeof summaryData === 'object') {
            return summaryData.result || summaryData.content || summaryData.summary
                || JSON.stringify(summaryData, null, 2);
        }
        return String(summaryData);
    }, [summaryData]);

    const blocks = useMemo(() => parseBlocks(rawText), [rawText]);

    const stats = useMemo(() => {
        const words = rawText.trim().split(/\s+/).filter(Boolean).length;
        const mins = Math.max(1, Math.round(words / 200));
        const sections = blocks.filter(b => b.type === 'h2').length;
        return { wordCount: words, readingMins: mins, sectionCount: sections };
    }, [rawText, blocks]);

    if (!rawText.trim()) {
        return (
            <div className="flex-1 h-full flex items-center justify-center text-gray-300">
                <p className="text-sm">No summary content available.</p>
            </div>
        );
    }

    // Extract H1 title from blocks (if any), else use prop
    const h1Block = blocks.find(b => b.type === 'h1');
    const displayTitle = h1Block ? h1Block.text : (title || 'Summary');
    const contentBlocks = h1Block ? blocks.filter(b => b !== h1Block) : blocks;

    return (
        <div className="flex-1 h-full overflow-y-auto bg-[#FAFBFF]">
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-8 space-y-0 animate-in fade-in duration-500">

                {/* ── Header Card ── */}
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 p-6 md:p-8 mb-6 shadow-xl shadow-indigo-200/40">
                    {/* decorative blobs */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-8 -translate-x-8 pointer-events-none" />

                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                                <BookOpen className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">AI Summary</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight mb-4">
                            {displayTitle}
                        </h1>
                        {/* Stats */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs text-white/70">
                                <AlignLeft className="w-3 h-3" />
                                <span><strong className="text-white font-bold">{stats.wordCount.toLocaleString()}</strong> words</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-white/70">
                                <Clock className="w-3 h-3" />
                                <span><strong className="text-white font-bold">{stats.readingMins}</strong> min read</span>
                            </div>
                            {stats.sectionCount > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-white/70">
                                    <Hash className="w-3 h-3" />
                                    <span><strong className="text-white font-bold">{stats.sectionCount}</strong> sections</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="bg-white border border-gray-100 rounded-2xl px-7 py-6 shadow-lg shadow-indigo-50/30">
                    {contentBlocks.map((block, idx) => (
                        <BlockRenderer key={idx} block={block} idx={idx} />
                    ))}
                </div>

            </div>
        </div>
    );
};

export default SummaryView;
