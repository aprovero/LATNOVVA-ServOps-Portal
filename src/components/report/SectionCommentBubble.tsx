import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { ReportComment } from '../../store/useStore';

interface SectionCommentBubbleProps {
    sectionKey: string;          // e.g. 'labor', 'checklists', 'notes', 'occurrences'
    sectionLabel: string;        // display name for the section
    comments: ReportComment[];   // all report comments (filtered internally by sectionKey)
    onAdd: (text: string, sectionKey: string) => void;
    canComment: boolean;         // true when the current role can add comments
    readOnly?: boolean;
}

export default function SectionCommentBubble({
    sectionKey,
    sectionLabel,
    comments,
    onAdd,
    canComment,
    readOnly = false,
}: SectionCommentBubbleProps) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Filter to just this section's comments
    const sectionComments = comments.filter(c => c.sectionKey === sectionKey);
    const count = sectionComments.length;

    // Auto-focus input when opened
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleSubmit = () => {
        if (!text.trim()) return;
        onAdd(text.trim(), sectionKey);
        setText('');
    };

    return (
        <div className="relative inline-block" ref={panelRef}>
            {/* Bubble trigger button */}
            <button
                onClick={() => setOpen(v => !v)}
                title={`${count > 0 ? `${count} comment${count !== 1 ? 's' : ''} on ` : 'Comment on '}${sectionLabel}`}
                className={`relative flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                    count > 0
                        ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                        : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100 hover:text-gray-600'
                }`}
            >
                <MessageSquare size={12} />
                {count > 0 && (
                    <span className="min-w-[16px] h-4 flex items-center justify-center bg-blue-500 text-white rounded-full text-[9px] font-black -top-1.5 -right-1.5 absolute">
                        {count}
                    </span>
                )}
            </button>

            {/* Popover panel */}
            {open && (
                <div className="absolute right-0 top-8 z-50 w-80 bg-white border border-blue-100 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
                        <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                            <MessageSquare size={12} /> {sectionLabel} Notes
                        </span>
                        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Existing section comments */}
                    <div className="max-h-52 overflow-y-auto px-4 py-3 space-y-3">
                        {sectionComments.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">No comments on this section yet.</p>
                        ) : (
                            sectionComments.map(c => (
                                <div key={c.id} className="flex flex-col gap-0.5 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-gray-700">{c.userId}</span>
                                        <span className="text-gray-400 text-[10px]">({c.role})</span>
                                        <span className="text-gray-300 text-[10px] ml-auto">
                                            {new Date(c.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 leading-relaxed pl-1 border-l-2 border-blue-200">{c.text}</p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input — only shown if canComment && !readOnly */}
                    {canComment && !readOnly && (
                        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
                            <input
                                ref={inputRef}
                                type="text"
                                value={text}
                                onChange={e => setText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                placeholder={`Note on ${sectionLabel}…`}
                                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-300"
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={!text.trim()}
                                className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl disabled:opacity-40 transition-colors"
                            >
                                <Send size={12} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
