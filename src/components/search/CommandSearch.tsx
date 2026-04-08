import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import {
    Search, X, Folder, FileText, User, Wrench,
    Zap, Clock, ArrowRight, Hash
} from 'lucide-react';
import { useStore } from '../../store/useStore';

// ─── Types ──────────────────────────────────────────────────────────────────

type ResultCategory = 'project' | 'report' | 'personnel' | 'tool' | 'action' | 'recent';

interface SearchResult {
    id: string;
    category: ResultCategory;
    title: string;
    subtitle: string;
    path: string;
    score?: number;
    action?: () => void; // For quick actions that don't navigate
}

interface RecentItem {
    id: string;
    title: string;
    subtitle: string;
    path: string;
    category: ResultCategory;
    timestamp: number;
}

const RECENT_KEY = 'lnv_search_recent';
const MAX_RECENT = 6;
const MAX_PER_GROUP = 4;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRecent(): RecentItem[] {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveRecent(item: Omit<RecentItem, 'timestamp'>) {
    const existing = getRecent().filter(r => r.id !== item.id);
    const updated = [{ ...item, timestamp: Date.now() }, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ResultCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    project:   { label: 'Projects',     icon: Folder,   color: 'text-blue-600',    bg: 'bg-blue-50' },
    report:    { label: 'Reports',      icon: FileText, color: 'text-violet-600',  bg: 'bg-violet-50' },
    personnel: { label: 'Personnel',    icon: User,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
    tool:      { label: 'Tools',        icon: Wrench,   color: 'text-amber-600',   bg: 'bg-amber-50' },
    action:    { label: 'Quick Actions',icon: Zap,      color: 'text-brand-teal',  bg: 'bg-teal-50' },
    recent:    { label: 'Recent',       icon: Clock,    color: 'text-gray-500',    bg: 'bg-gray-100' },
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface CommandSearchProps {
    onNewReport: () => void;
    onNewProject: () => void;
    triggerOpen?: boolean;
    onTriggerConsumed?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommandSearch({
    onNewReport,
    onNewProject,
    triggerOpen,
    onTriggerConsumed,
}: CommandSearchProps) {
    const navigate = useNavigate();
    const { projects, reports, personnel, tools, clients, userRole } = useStore();

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [recent, setRecent] = useState<RecentItem[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // ── External trigger (from mobile button) ────────────────────────────────
    useEffect(() => {
        if (triggerOpen) {
            setIsOpen(true);
            onTriggerConsumed?.();
        }
    }, [triggerOpen, onTriggerConsumed]);

    // ── Keyboard shortcut ────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ── Focus input on open ───────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setRecent(getRecent());
            setQuery('');
            setResults([]);
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // ── Build Quick Actions (role-aware) ─────────────────────────────────────
    const quickActions = useCallback((): SearchResult[] => {
        const actions: SearchResult[] = [];
        if (['Supervisor', 'Manager'].includes(userRole)) {
            actions.push({
                id: 'qa-new-report',
                category: 'action',
                title: 'New Report',
                subtitle: 'Create a new daily report',
                path: '',
                action: () => { setIsOpen(false); onNewReport(); },
            });
            actions.push({
                id: 'qa-new-project',
                category: 'action',
                title: 'New Project',
                subtitle: 'Create a new project',
                path: '',
                action: () => { setIsOpen(false); onNewProject(); },
            });
        }
        if (['Tech', 'Supervisor'].includes(userRole)) {
            actions.push({
                id: 'qa-clock-in',
                category: 'action',
                title: 'Clock In',
                subtitle: 'GPS-verified attendance punch',
                path: '/clock-in',
            });
        }
        actions.push(
            { id: 'qa-projects',  category: 'action', title: 'Go to Projects',  subtitle: 'View all active projects', path: '/projects' },
            { id: 'qa-reports',   category: 'action', title: 'Go to Reports',   subtitle: 'View all field reports',   path: '/reports' },
        );
        if (['Supervisor', 'Manager'].includes(userRole)) {
            actions.push(
                { id: 'qa-personnel', category: 'action', title: 'Go to Personnel', subtitle: 'View team directory', path: '/personnel' },
                { id: 'qa-analysis',  category: 'action', title: 'Go to Analysis',  subtitle: 'Project intelligence', path: '/analysis' },
            );
        }
        return actions;
    }, [userRole, onNewReport, onNewProject]);

    // ── Fuse search ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!query.trim() || query.trim().length < 1) {
            setResults([]);
            setActiveIndex(0);
            return;
        }

        const q = query.trim().toLowerCase();

        // Build a typed searchable pool
        const projectItems: SearchResult[] = projects.map(p => {
            const client = clients.find(c => c.id === p.clientId);
            return {
                id: p.id,
                category: 'project' as const,
                title: p.name,
                subtitle: [client?.name, p.location, p.systemType].filter(Boolean).join(' · '),
                path: `/projects/${p.id}`,
            };
        });

        const reportItems: SearchResult[] = reports.map(r => {
            const proj = projects.find(p => p.id === r.projectId);
            return {
                id: r.id,
                category: 'report' as const,
                title: `${r.projectName || proj?.name || r.projectId} – ${r.date}`,
                subtitle: `${r.state} · ${r.id}`,
                path: `/reports/${r.id}`,
            };
        });

        const personnelItems: SearchResult[] = personnel.map(p => ({
            id: p.id,
            category: 'personnel' as const,
            title: p.name,
            subtitle: [p.position, p.appRole].filter(Boolean).join(' · '),
            path: `/personnel?q=${encodeURIComponent(p.name)}`,
        }));

        const toolItems: SearchResult[] = tools.map(t => ({
            id: t.id,
            category: 'tool' as const,
            title: t.name,
            subtitle: `${t.model} · SN: ${t.serialNumber}`,
            path: `/tools?q=${encodeURIComponent(t.serialNumber)}`,
        }));

        // Quick Actions matching
        const actionItems = quickActions().filter(a =>
            a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
        );

        // Fuzzy search per group
        const fuseOpts = {
            keys: ['title', 'subtitle'],
            threshold: 0.35,
            includeScore: true,
            minMatchCharLength: 1,
        };

        const search = <T extends SearchResult>(pool: T[]): T[] => {
            if (pool.length === 0) return [];
            const fuse = new Fuse(pool, fuseOpts);
            return fuse.search(q)
                .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
                .map(r => r.item)
                .slice(0, MAX_PER_GROUP);
        };

        const combined: SearchResult[] = [
            ...actionItems.slice(0, 3),
            ...search(projectItems),
            ...search(reportItems),
            ...search(personnelItems),
            ...search(toolItems),
        ];

        setResults(combined);
        setActiveIndex(0);
    }, [query, projects, reports, personnel, tools, clients, quickActions]);

    // ── Keyboard navigation ───────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
        const items = getDisplayedItems();
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[activeIndex]) handleSelect(items[activeIndex]);
        }
    };

    // ── Get flat displayed list (for keyboard nav) ────────────────────────────
    const getDisplayedItems = useCallback((): SearchResult[] => {
        if (query.trim().length === 0) {
            const recentAsResults: SearchResult[] = recent.map(r => ({
                id: r.id,
                category: r.category,
                title: r.title,
                subtitle: r.subtitle,
                path: r.path,
            }));
            return [...recentAsResults, ...quickActions()];
        }
        return results;
    }, [query, recent, quickActions, results]);

    // ── Select an item ────────────────────────────────────────────────────────
    const handleSelect = (item: SearchResult) => {
        if (item.action) {
            item.action();
            return;
        }
        if (item.path) {
            if (item.category !== 'action') {
                saveRecent({
                    id: item.id,
                    title: item.title,
                    subtitle: item.subtitle,
                    path: item.path,
                    category: item.category,
                });
            }
            navigate(item.path);
        }
        setIsOpen(false);
    };

    // ── Scroll active item into view ──────────────────────────────────────────
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    // ── Group results for rendering ───────────────────────────────────────────
    const groupedResults = useCallback(() => {
        const groups: Record<ResultCategory, SearchResult[]> = {
            action: [], project: [], report: [], personnel: [], tool: [], recent: [],
        };
        results.forEach(r => groups[r.category].push(r));
        return groups;
    }, [results]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            {/* Trigger Button */}
            <button
                id="command-search-trigger"
                onClick={() => setIsOpen(true)}
                className="relative flex items-center gap-3 w-full max-w-md px-4 h-10 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 text-sm hover:border-brand-teal/40 hover:bg-white transition-all duration-200 group hidden lg:flex"
            >
                <Search size={16} className="text-gray-400 group-hover:text-brand-teal transition-colors shrink-0" />
                <span className="flex-1 text-left">Search projects, people, reports...</span>
                <kbd className="hidden xl:flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-400 shadow-sm">
                    <span className="text-[9px]">⌘</span>K
                </kbd>
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]"
                    style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.45)' }}
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                        style={{
                            animation: 'cmdSearchIn 0.15s cubic-bezier(0.22,1,0.36,1)',
                            maxHeight: '75vh',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                            <Search size={20} className="text-brand-teal shrink-0" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search projects, reports, people, tools..."
                                className="flex-1 text-base text-gray-800 placeholder-gray-400 outline-none bg-transparent font-medium"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            {query && (
                                <button onClick={() => setQuery('')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={16} />
                                </button>
                            )}
                            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-mono text-gray-400">
                                ESC
                            </kbd>
                        </div>

                        {/* Results */}
                        <div ref={listRef} className="overflow-y-auto flex-1" style={{ overscrollBehavior: 'contain' }}>
                            {/* Empty state — show recent + quick actions */}
                            {query.trim().length === 0 && (
                                <div>
                                    {/* Recent Items */}
                                    {recent.length > 0 && (
                                        <div className="pt-2 pb-1">
                                            <div className="flex items-center justify-between px-4 py-1.5">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent</span>
                                                <button
                                                    onClick={() => { clearRecent(); setRecent([]); }}
                                                    className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                            {recent.map((item, idx) => {
                                                const cfg = CATEGORY_CONFIG[item.category];
                                                const Icon = cfg.icon;
                                                const flatIdx = idx;
                                                return (
                                                    <ResultRow
                                                        key={item.id}
                                                        item={{ ...item, category: item.category }}
                                                        icon={<Icon size={15} className={cfg.color} />}
                                                        iconBg={cfg.bg}
                                                        isActive={activeIndex === flatIdx}
                                                        dataIndex={flatIdx}
                                                        onSelect={() => handleSelect({ ...item, category: item.category })}
                                                        onHover={() => setActiveIndex(flatIdx)}
                                                        badge={<Clock size={11} className="text-gray-300" />}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Quick Actions */}
                                    <div className="pt-2 pb-3">
                                        <div className="px-4 py-1.5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quick Actions</span>
                                        </div>
                                        {quickActions().map((item, idx) => {
                                            const flatIdx = recent.length + idx;
                                            return (
                                                <ResultRow
                                                    key={item.id}
                                                    item={item}
                                                    icon={<Zap size={15} className="text-brand-teal" />}
                                                    iconBg="bg-teal-50"
                                                    isActive={activeIndex === flatIdx}
                                                    dataIndex={flatIdx}
                                                    onSelect={() => handleSelect(item)}
                                                    onHover={() => setActiveIndex(flatIdx)}
                                                    badge={<ArrowRight size={13} className="text-gray-300" />}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Active query — grouped results */}
                            {query.trim().length > 0 && results.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                                    <Hash size={32} className="text-gray-200" />
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-gray-500">No results for "{query}"</p>
                                        <p className="text-xs mt-1">Try a different keyword or use Quick Actions</p>
                                    </div>
                                </div>
                            )}

                            {query.trim().length > 0 && results.length > 0 && (() => {
                                const groups = groupedResults();
                                const order: ResultCategory[] = ['action', 'project', 'report', 'personnel', 'tool'];
                                let runningIdx = 0;

                                return order.map(cat => {
                                    const items = groups[cat];
                                    if (items.length === 0) return null;
                                    const cfg = CATEGORY_CONFIG[cat];
                                    const Icon = cfg.icon;

                                    return (
                                        <div key={cat} className="pt-2 pb-1">
                                            <div className="px-4 py-1.5">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cfg.label}</span>
                                            </div>
                                            {items.map(item => {
                                                const flatIdx = runningIdx++;
                                                return (
                                                    <ResultRow
                                                        key={item.id}
                                                        item={item}
                                                        icon={<Icon size={15} className={cfg.color} />}
                                                        iconBg={cfg.bg}
                                                        isActive={activeIndex === flatIdx}
                                                        dataIndex={flatIdx}
                                                        onSelect={() => handleSelect(item)}
                                                        onHover={() => setActiveIndex(flatIdx)}
                                                        badge={<ArrowRight size={13} className="text-gray-300" />}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
                                <span className="flex items-center gap-1"><kbd className="bg-white border border-gray-200 rounded px-1 font-mono text-[10px]">↑↓</kbd> navigate</span>
                                <span className="flex items-center gap-1"><kbd className="bg-white border border-gray-200 rounded px-1 font-mono text-[10px]">↵</kbd> open</span>
                                <span className="flex items-center gap-1"><kbd className="bg-white border border-gray-200 rounded px-1 font-mono text-[10px]">esc</kbd> close</span>
                            </div>
                            <span className="text-[10px] text-gray-300 font-mono">⌘K</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Animation keyframe injected inline */}
            <style>{`
                @keyframes cmdSearchIn {
                    from { opacity: 0; transform: scale(0.97) translateY(-8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </>
    );
}

// ─── ResultRow ────────────────────────────────────────────────────────────────

interface ResultRowProps {
    item: SearchResult;
    icon: React.ReactNode;
    iconBg: string;
    isActive: boolean;
    dataIndex: number;
    onSelect: () => void;
    onHover: () => void;
    badge?: React.ReactNode;
}

function ResultRow({ item, icon, iconBg, isActive, dataIndex, onSelect, onHover, badge }: ResultRowProps) {
    return (
        <div
            data-index={dataIndex}
            onClick={onSelect}
            onMouseEnter={onHover}
            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-75 ${
                isActive ? 'bg-brand-teal/5 border-l-2 border-brand-teal' : 'border-l-2 border-transparent hover:bg-gray-50'
            }`}
        >
            <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${isActive ? 'text-brand-teal' : 'text-gray-800'}`}>
                    {item.title}
                </p>
                {item.subtitle && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.subtitle}</p>
                )}
            </div>
            <div className="shrink-0 opacity-60">{badge}</div>
        </div>
    );
}
