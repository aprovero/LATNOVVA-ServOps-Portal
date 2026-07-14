import { useEffect, useRef, useState } from 'react';
import { Mail, MapPin, ArrowRight, Zap, Train, Rss, Globe, Factory, CheckCircle2, ChevronDown } from 'lucide-react';

/* ─── Scroll reveal hook ─────────────────────────────────────────────── */
function useReveal(threshold = 0.15) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, visible };
}

function Reveal({ children, className = '', delay = 0, y = 28 }: {
    children: React.ReactNode; className?: string; delay?: number; y?: number;
}) {
    const { ref, visible } = useReveal();
    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : `translateY(${y}px)`,
                transition: `opacity 0.75s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.75s cubic-bezier(.4,0,.2,1) ${delay}ms`,
            }}
        >
            {children}
        </div>
    );
}

/* ─── Animated counter ───────────────────────────────────────────────── */
function Counter({ value, suffix = '', duration = 1800 }: { value: number; suffix?: string; duration?: number }) {
    const [count, setCount] = useState(0);
    const { ref, visible } = useReveal(0.3);
    useEffect(() => {
        if (!visible) return;
        let start = 0;
        const step = value / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= value) { setCount(value); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [visible, value, duration]);
    return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── Section label ───────────────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-2 text-[11px] font-black text-brand-teal uppercase tracking-[0.25em] mb-4">
            <span className="w-6 h-px bg-brand-teal" />
            {children}
            <span className="w-6 h-px bg-brand-teal" />
        </span>
    );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function LatnovvaESPBrochure() {
    return (
        <div className="w-full bg-white overflow-y-auto" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ══════════════════════════════════════════════════════════
                HERO
            ══════════════════════════════════════════════════════════ */}
            <section className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden">
                {/* Background photo */}
                <div className="absolute inset-0">
                    <img src="/latnovva-esp/slide_01.png" alt="" className="w-full h-full object-cover object-right" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d3d38]/95 via-[#0d3d38]/75 to-[#0d3d38]/20" />
                </div>

                <div className="relative z-10 px-10 md:px-20 pb-20 max-w-3xl">
                    <Reveal delay={100}>
                        <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-10 mb-10 brightness-0 invert" />
                    </Reveal>
                    <Reveal delay={200}>
                        <div className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-5">
                            International Engineering Company
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.02] tracking-tight mb-8">
                            Engineering that<br />
                            <span className="text-emerald-300">transforms</span><br />
                            the world.
                        </h1>
                    </Reveal>
                    <Reveal delay={350}>
                        <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-xl">
                            Since 2018, we deploy specialized crews for construction, commissioning, and O&amp;M
                            on renewable energy, industrial, and railway projects across 10+ countries.
                        </p>
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                            <Globe size={16} />
                            <span>latnovva.com</span>
                        </div>
                    </Reveal>
                </div>

                {/* Scroll cue */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/50 animate-bounce">
                    <ChevronDown size={22} />
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                KEY NUMBERS
            ══════════════════════════════════════════════════════════ */}
            <section className="bg-brand-teal py-16 px-8">
                <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
                    {[
                        { value: 2500, suffix: '+', unit: 'MW', label: 'Executed in Renewable Energy' },
                        { value: 285, suffix: '+', unit: '', label: 'Employees Across the Group' },
                        { value: 40, suffix: 'M', unit: 'USD', label: 'Revenue 2024' },
                        { value: 18, suffix: '+', unit: 'MW', label: 'in E-Mobility' },
                        { value: 100, suffix: '+', unit: '', label: 'Tertiary Installation Projects' },
                    ].map((s, i) => (
                        <Reveal key={s.label} delay={i * 80} className="flex flex-col items-center">
                            <div className="text-4xl font-black text-white mb-0.5 tabular-nums">
                                <Counter value={s.value} suffix={s.suffix} />
                                {s.unit && <span className="text-2xl ml-1 text-emerald-300">{s.unit}</span>}
                            </div>
                            <div className="text-[11px] font-semibold text-white/65 uppercase tracking-wider leading-tight max-w-[120px]">
                                {s.label}
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                ABOUT US
            ══════════════════════════════════════════════════════════ */}
            <section className="py-28 px-8 bg-white">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
                    <div>
                        <Reveal>
                            <Label>Corporate Overview</Label>
                            <h2 className="text-4xl font-black text-gray-900 mb-6 leading-tight">
                                A global company<br />built on innovation.
                            </h2>
                            <p className="text-gray-500 text-base leading-relaxed mb-8">
                                Founded in 2018 by a group of young engineers with deep expertise in mechanical and electrical installations, commissioning, and O&amp;M. Today we operate across 10 countries with over 320 people in our structure.
                            </p>
                        </Reveal>
                        <div className="space-y-3">
                            {[
                                'Presence in Mexico, USA, Colombia, Chile, Dominican Republic, Costa Rica, Panama, Peru, Portugal, and Spain',
                                'Direct integration with owner and EPC teams',
                                'Rapid response capability and massive personnel deployment',
                                'Over 2,500 MW executed in renewable energy projects',
                            ].map((item, i) => (
                                <Reveal key={item} delay={i * 60}>
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 size={16} className="text-brand-teal shrink-0 mt-0.5" />
                                        <p className="text-sm text-gray-600 font-medium leading-snug">{item}</p>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                    {/* World presence visual — High fidelity custom vector SVG map */}
                    <Reveal delay={150} className="relative">
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
                            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:16px_16px]"></div>
                            
                            {/* Title inside the card */}
                            <div className="relative z-10 flex items-center justify-between">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                    Global Network
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">10 Countries Operations</span>
                            </div>

                            {/* Stylized SVG Map */}
                            <div className="relative w-full flex-1 min-h-[200px] flex items-center justify-center my-2">
                                <svg viewBox="0 0 800 450" className="w-full h-full text-slate-700 fill-current opacity-70">
                                    {/* North America */}
                                    <path d="M80,60 L240,65 L280,110 L285,150 L200,195 L145,210 L120,180 L70,120 Z" className="fill-slate-800" />
                                    {/* Central America */}
                                    <path d="M190,195 L225,230 L250,250 L235,260 L210,240 L180,210 Z" className="fill-slate-800" />
                                    {/* South America */}
                                    <path d="M225,250 L280,280 L310,310 L290,380 L250,420 L230,350 L220,300 Z" className="fill-slate-800" />
                                    {/* Greenland */}
                                    <path d="M280,30 L350,25 L340,60 L290,65 Z" className="fill-slate-800" />
                                    {/* Europe & Africa outline */}
                                    <path d="M420,70 L520,75 L560,110 L500,185 L445,190 L425,130 Z" className="fill-slate-800" />
                                    <path d="M430,200 L490,210 L530,250 L500,320 L440,300 L420,240 Z" className="fill-slate-800/40" />

                                    {/* Highlighted Country Polygons (Teal) */}
                                    {/* US */}
                                    <path d="M130,110 L260,115 L265,150 L195,185 Z" className="fill-emerald-500/25 stroke-emerald-500/30 stroke-1" />
                                    {/* Mexico */}
                                    <path d="M145,185 L195,185 L200,212 L165,215 Z" className="fill-emerald-500/35 stroke-emerald-500/40 stroke-1" />
                                    {/* Colombia */}
                                    <path d="M225,250 L255,260 L250,285 L230,280 Z" className="fill-emerald-500/35 stroke-emerald-500/40 stroke-1" />
                                    {/* Peru */}
                                    <path d="M230,280 L258,290 L248,328 L228,318 Z" className="fill-emerald-500/35 stroke-emerald-500/40 stroke-1" />
                                    {/* Chile */}
                                    <path d="M245,340 L257,342 L248,410 L238,408 Z" className="fill-emerald-500/35 stroke-emerald-500/40 stroke-1" />
                                    {/* Spain & Portugal */}
                                    <path d="M428,135 L455,135 L452,158 L426,155 Z" className="fill-emerald-500/35 stroke-emerald-500/40 stroke-1" />

                                    {/* Glowing Radar Beacons */}
                                    {/* US (Miami / East Coast) */}
                                    <g transform="translate(230, 145)">
                                        <circle r="9" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="4" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                    {/* Mexico (Mérida / CDMX) */}
                                    <g transform="translate(175, 202)">
                                        <circle r="9" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="4" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                    {/* Costa Rica / Panama */}
                                    <g transform="translate(218, 238)">
                                        <circle r="7" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="3.5" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                    {/* Dominican Republic */}
                                    <g transform="translate(262, 210)">
                                        <circle r="7" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="3.5" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                    {/* Colombia */}
                                    <g transform="translate(242, 268)">
                                        <circle r="8" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="4" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                    {/* Peru */}
                                    <g transform="translate(238, 305)">
                                        <circle r="7" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="3.5" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                    {/* Chile */}
                                    <g transform="translate(248, 375)">
                                        <circle r="8" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="4" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                    {/* Spain & Portugal */}
                                    <g transform="translate(440, 146)">
                                        <circle r="8" className="fill-emerald-400/20 animate-ping" />
                                        <circle r="4" className="fill-emerald-400 stroke-slate-900 stroke-2" />
                                    </g>
                                </svg>
                            </div>

                            {/* Footer inside the card */}
                            <div className="relative z-10 bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3 backdrop-blur-sm">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1">Active Offices & Hubs</p>
                                <p className="text-[11px] font-bold text-white tracking-wide">
                                    MX · US · CO · CL · DO · CR · PA · PE · PT · ES
                                </p>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                LÍNEAS DE NEGOCIO — SECTOR CARDS
            ══════════════════════════════════════════════════════════ */}
            <section className="py-28 px-8 bg-gray-950 text-white overflow-hidden">
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <Label>Lines of Business</Label>
                        <h2 className="text-4xl md:text-5xl font-black text-white mt-2">
                            Five sectors.<br />
                            <span className="text-emerald-300">One company.</span>
                        </h2>
                    </Reveal>

                    <div className="grid md:grid-cols-5 gap-4">
                        {[
                            {
                                icon: Zap,
                                title: 'Green Energies',
                                desc: 'Solar, BESS, wind. EPC/BOS/BOP construction, commissioning, COD & O&M.',
                                border: 'border-teal-500/30',
                                iconColor: 'text-teal-300',
                                img: '/latnovva-esp/slide_09.png',
                            },
                            {
                                icon: Factory,
                                title: 'Industrial Facilities',
                                desc: 'MPE installations, maintenance in hospitals, hotels and industrial warehouses.',
                                border: 'border-amber-500/30',
                                iconColor: 'text-amber-300',
                                img: '/latnovva-esp/slide_07.png',
                            },
                            {
                                icon: Train,
                                title: 'Railway Infrastructure',
                                desc: 'HV/MV/LV induced works, full railway systems and catenary from design to maintenance.',
                                border: 'border-indigo-500/30',
                                iconColor: 'text-indigo-300',
                                img: '/latnovva-esp/slide_14.png',
                            },
                            {
                                icon: Rss,
                                title: 'Communications',
                                desc: 'Design, construction and commissioning of fiber optic networks and telemetry backbones.',
                                border: 'border-rose-500/30',
                                iconColor: 'text-rose-300',
                                img: '/latnovva-esp/slide_16.png',
                            },
                            {
                                icon: Globe,
                                title: 'E-Mobility',
                                desc: 'EV charging infrastructure, fleet management, storage optimization and software integration.',
                                border: 'border-emerald-500/30',
                                iconColor: 'text-emerald-300',
                                img: '/latnovva-esp/charger_custom.png',
                            },
                        ].map((sector, i) => (
                            <Reveal key={sector.title} delay={i * 80}>
                                <div className={`relative group rounded-3xl overflow-hidden border ${sector.border} bg-slate-900 p-6 flex flex-col gap-4 h-full min-h-[340px] cursor-default`}>
                                    {/* Photo background */}
                                    <div className="absolute inset-0 opacity-40 group-hover:opacity-75 transition-opacity duration-500">
                                        <img src={sector.img} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-slate-950/20" />
                                    <div className="relative z-10 flex flex-col justify-between h-full">
                                        <div className="flex flex-col gap-4">
                                            <div className={`w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm ${sector.iconColor}`}>
                                                <sector.icon size={22} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-white text-base mb-2 leading-tight">{sector.title}</h3>
                                                <p className="text-white/85 text-xs leading-relaxed font-semibold">{sector.desc}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                ENERGÍA — Detail section
            ══════════════════════════════════════════════════════════ */}
            <section className="relative py-32 px-8 overflow-hidden">
                <div className="absolute inset-0">
                    <img 
                        src="/latnovva-esp/slide_08.png" 
                        alt="" 
                        className="w-full h-full object-cover scale-[1.3] translate-x-[10%] translate-y-[10%]" 
                    />
                    <div className="absolute inset-0 bg-brand-teal/96" />
                </div>
                <div className="relative z-10 max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-20 items-center">
                        <div>
                            <Reveal>
                                <Label>Energy</Label>
                                <h2 className="text-4xl font-black text-white mb-6 leading-tight mt-2">
                                    The technical partner your solar and BESS project needs.
                                </h2>
                                <p className="text-emerald-100 font-bold text-base leading-relaxed">
                                    From basic engineering to COD testing and continuous operation, we cover every critical phase of utility-scale PV and energy storage projects.
                                </p>
                            </Reveal>
                        </div>
                        <div className="grid grid-cols-2 gap-3 auto-rows-fr">
                            {[
                                { n: '01', label: 'Basic & Detail Engineering' },
                                { n: '02', label: 'Owner\'s Engineering' },
                                { n: '03', label: 'EPC, BOS or BOP Construction' },
                                { n: '04', label: 'Full Commissioning Services' },
                                { n: '05', label: 'Grid Interconnection Management' },
                                { n: '06', label: 'Power Quality Studies' },
                                { n: '07', label: 'COD & PR Testing' },
                                { n: '08', label: 'Operations & Maintenance' },
                            ].map((item, i) => (
                                <Reveal key={item.n} delay={100 + i * 50} className="h-full">
                                    <div className="bg-white/12 backdrop-blur border border-white/20 rounded-2xl p-4 hover:bg-white/20 transition-all h-full flex flex-col justify-center">
                                        <div className="text-emerald-300 font-black text-xs mb-1">{item.n}</div>
                                        <div className="text-white font-semibold text-sm leading-snug">{item.label}</div>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                INDUSTRIAL + FERROVIARIO + COMUNICACIONES — 3 col
            ══════════════════════════════════════════════════════════ */}
            <section className="py-28 px-8 bg-white">
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <Label>Activity Lines</Label>
                        <h2 className="text-4xl font-black text-gray-900 mt-2">
                            Capabilities that make the difference.
                        </h2>
                    </Reveal>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Industrial */}
                        <Reveal delay={0}>
                            <div className="group">
                                <div className="relative rounded-3xl overflow-hidden aspect-[4/3] mb-6 shadow-lg bg-slate-900">
                                    <img 
                                        src="/latnovva-esp/slide_07.png" 
                                        alt="Industrial" 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 scale-[2.2] origin-left" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-gray-900/10 to-transparent" />
                                    <div className="absolute bottom-4 left-5">
                                        <div className="inline-flex items-center gap-2 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                            <Factory size={10} /> Industrial
                                        </div>
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-3">Industrial Installations<br />&amp; Maintenance</h3>
                                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                                    MV supply connections, under-slab piping, HVAC systems, earthing networks and commissioning in hospitals, hotels and industrial warehouses.
                                </p>
                                <ul className="space-y-2">
                                    {['Basic & Detail Engineering (MPE)', 'Hydraulic, megger & VLF testing', 'Preventive & corrective maintenance', "Owner's Engineering"].map(s => (
                                        <li key={s} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>

                        {/* Ferroviario */}
                        <Reveal delay={120}>
                            <div className="group">
                                <div className="relative rounded-3xl overflow-hidden aspect-[4/3] mb-6 shadow-lg bg-slate-900">
                                    <img 
                                        src="/latnovva-esp/slide_14.png" 
                                        alt="Ferroviario" 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 scale-[2.2] origin-left" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-gray-900/10 to-transparent" />
                                    <div className="absolute bottom-4 left-5">
                                        <div className="inline-flex items-center gap-2 bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                            <Train size={10} /> Railway
                                        </div>
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-3">Railway<br />Infrastructure</h3>
                                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                                    HV/MV/LV induced works, electrical grid rerouting, complete railway systems and catenary from engineering through maintenance.
                                </p>
                                <ul className="space-y-2">
                                    {['Induced Works: Engineering & Construction', 'Complete Railway Systems', 'Catenary: Supply & Assembly', 'Commissioning & Maintenance'].map(s => (
                                        <li key={s} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />{s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>

                        {/* Comunicaciones */}
                        <Reveal delay={240}>
                            <div className="group">
                                <div className="relative rounded-3xl overflow-hidden aspect-[4/3] mb-6 shadow-lg bg-slate-900">
                                    <img 
                                        src="/latnovva-esp/slide_16.png" 
                                        alt="Comunicaciones" 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 scale-[2.2] origin-left" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-gray-900/10 to-transparent" />
                                    <div className="absolute bottom-4 left-5">
                                        <div className="inline-flex items-center gap-2 bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                            <Rss size={10} /> Communications
                                        </div>
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-3">Communications</h3>
                                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                                    Design, layout, construction and commissioning of structured communication arrays, fiber optic networks and dedicated telemetry backbones.
                                </p>
                                <ul className="space-y-2">
                                    {['Network Engineering & Design', 'Infrastructure Construction', 'Commissioning', 'Preventive Maintenance'].map(s => (
                                        <li key={s} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />{s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                E-MOBILITY — Split
            ══════════════════════════════════════════════════════════ */}
            <section className="py-28 px-8 bg-gray-50">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
                    <Reveal>
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-square max-w-md bg-slate-900">
                            <img 
                                src="/latnovva-esp/charger_custom.png" 
                                alt="E-Mobility EV Charger" 
                                className="w-full h-full object-cover " 
                            />
                            {/* Callout badge */}
                            <div className="absolute top-5 right-5 bg-emerald-500 text-white rounded-2xl px-4 py-3 text-center shadow-xl">
                                <div className="text-2xl font-black">4 MW</div>
                                <div className="text-[10px] font-bold uppercase tracking-wider leading-tight">Largest EV hub<br />in Latin America</div>
                            </div>
                        </div>
                    </Reveal>
                    <div>
                        <Reveal delay={100}>
                            <Label>E-Mobility</Label>
                            <h2 className="text-4xl font-black text-gray-900 mb-6 mt-2 leading-tight">
                                The largest EV charging<br />hub in Latin America —<br />
                                <span className="text-brand-teal">built by us.</span>
                            </h2>
                            <p className="text-gray-500 text-base leading-relaxed mb-8">
                                We delivered the highest-capacity EV charging hub (4 MW) in Latin America, in Mérida, Yucatán. We offer end-to-end charging infrastructure solutions from feasibility to ongoing operations.
                            </p>
                        </Reveal>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { title: 'Feasibility Study', icon: '📋' },
                                { title: 'Electrical Infrastructure', icon: '⚡' },
                                { title: 'Vehicle Selection', icon: '🚌' },
                                { title: 'Fleet Monitoring', icon: '📡' },
                                { title: 'Capex / Opex Strategy', icon: '💼' },
                                { title: 'PPA / EPC / BoS Modalities', icon: '📝' },
                                { title: 'Software Integration', icon: '🖥️' },
                                { title: 'Ongoing O&M', icon: '🔧' },
                            ].map((item, i) => (
                                <Reveal key={item.title} delay={120 + i * 40}>
                                    <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                        <span className="text-xl">{item.icon}</span>
                                        <span className="text-xs font-bold text-gray-700">{item.title}</span>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                METODOLOGÍA
            ══════════════════════════════════════════════════════════ */}
            <section className="py-28 px-8 bg-white">
                <div className="max-w-5xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <Label>04 Step Methodology</Label>
                        <h2 className="text-4xl font-black text-gray-900 mt-2">
                            A process engineered<br />to maximize results.
                        </h2>
                    </Reveal>
                    <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-100 hidden md:block" />
                        <div className="space-y-10">
                            {[
                                {
                                    step: '01',
                                    title: 'Coordination',
                                    color: 'bg-brand-teal',
                                    items: ['Identify all project activities', 'Arrange tasks chronologically', 'Identify prerequisites and required resources', 'Define responsibilities and deadlines'],
                                },
                                {
                                    step: '02',
                                    title: 'Operational Dynamics',
                                    color: 'bg-amber-500',
                                    items: ['Zone descriptions and code definitions', 'Task-specific methodology', 'Technical work instructions', 'Daily and periodic task plans'],
                                },
                                {
                                    step: '03',
                                    title: 'Execution',
                                    color: 'bg-indigo-600',
                                    items: ['Increased productivity', 'Optimal time control', 'Faster and more effective decision-making', 'More time for high-value client activities'],
                                },
                                {
                                    step: '04',
                                    title: 'Evaluation',
                                    color: 'bg-emerald-500',
                                    items: ['Visual and timeline-based review', 'Compliance with scheduled milestones', 'Internal audit', 'Joint client/LATNOVVA assessment'],
                                },
                            ].map((phase, i) => (
                                <Reveal key={phase.step} delay={i * 80}>
                                    <div className="flex gap-8 items-start">
                                        <div className={`${phase.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-lg relative z-10`}>
                                            {phase.step}
                                        </div>
                                        <div className="flex-1 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                            <h3 className="font-black text-gray-900 text-lg mb-4">{phase.title}</h3>
                                            <ul className="grid sm:grid-cols-2 gap-2">
                                                {phase.items.map(item => (
                                                    <li key={item} className="flex items-start gap-2 text-sm text-gray-500 font-medium">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0 mt-1.5" />{item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                CLIENTS
            ══════════════════════════════════════════════════════════ */}
            <section className="relative py-28 px-8 overflow-hidden">
                <div className="absolute inset-0">
                    <img 
                        src="/latnovva-esp/slide_20.png" 
                        alt="" 
                        className="w-full h-full object-cover scale-[1.3] translate-x-[12%] origin-right" 
                    />
                    <div className="absolute inset-0 bg-gray-950/92" />
                </div>
                <div className="relative z-10 max-w-6xl mx-auto">
                    <Reveal className="text-center mb-14">
                        <Label>Our Clients</Label>
                        <h2 className="text-4xl font-black text-white mt-2">
                            Trusted by the leaders<br />of the energy sector.
                        </h2>
                    </Reveal>

                    {/* Cropped client logos image wrapper */}
                    <Reveal delay={100}>
                        <div className="bg-white rounded-3xl overflow-hidden p-0 shadow-2xl aspect-[16/9] md:aspect-[3/1] relative border border-gray-100 flex items-center justify-center">
                            <img 
                                src="/latnovva-esp/slide_21.png" 
                                alt="Our Clients Logos" 
                                className="w-full h-full object-cover scale-[1.35] origin-right" 
                            />
                        </div>
                    </Reveal>

                    <Reveal delay={400}>
                        <p className="text-center text-white/35 text-xs font-semibold mt-10 tracking-widest uppercase">
                            And many more across 10 countries
                        </p>
                    </Reveal>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                CASOS DE ÉXITO
            ══════════════════════════════════════════════════════════ */}
            <section className="py-28 px-8 bg-white">
                <div className="max-w-6xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <Label>Success Stories</Label>
                        <h2 className="text-4xl font-black text-gray-900 mt-2">
                            Projects that<br />speak for themselves.
                        </h2>
                    </Reveal>

                    {/* Featured pair — equal height */}
                    <div className="grid md:grid-cols-2 gap-6 mb-6 auto-rows-fr">
                        {[
                            {
                                code: 'MX', codeColor: 'bg-brand-teal', country: 'Mexico',
                                title: 'PFV Peñasco Phase II',
                                client: 'China Energy', mw: '300 MW',
                                scope: 'Full electrical commissioning of the solar field and 300 MW transformation center. Grid code testing management with CFE and CENACE, COD & PR tests, TICs manual.',
                                headerBg: 'bg-brand-teal',
                            },
                            {
                                code: 'MX', codeColor: 'bg-indigo-400', country: 'Mexico',
                                title: 'Tren Maya',
                                client: 'Railway Infrastructure', mw: 'MV Connections',
                                scope: 'Basic and detailed engineering. CFE authorization management. Construction and commissioning of medium voltage supply connections.',
                                headerBg: 'bg-indigo-600',
                            },
                        ].map((p, i) => (
                            <Reveal key={p.title} delay={i * 100} className="h-full">
                                <div className="rounded-3xl border border-gray-100 overflow-hidden shadow-md hover:shadow-xl transition-shadow h-full flex flex-col">
                                    <div className={`${p.headerBg} px-6 py-4 flex items-center justify-between`}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`${p.codeColor} text-white font-black text-[10px] tracking-widest px-2 py-0.5 rounded-md`}>{p.code}</span>
                                                <span className="text-white/70 text-[11px] font-bold uppercase tracking-widest">{p.country}</span>
                                            </div>
                                            <div className="text-white font-black text-xl">{p.title}</div>
                                        </div>
                                        <div className="text-right shrink-0 ml-4">
                                            <div className="text-emerald-300 font-black text-lg">{p.mw}</div>
                                            <div className="text-white/60 text-xs">{p.client}</div>
                                        </div>
                                    </div>
                                    <div className="p-6 flex-1">
                                        <p className="text-gray-500 text-sm leading-relaxed">{p.scope}</p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>

                    {/* Secondary trio — equal height */}
                    <div className="grid md:grid-cols-3 gap-5 mb-6 auto-rows-fr">
                        {[
                            {
                                codes: [{ code: 'CO', color: 'bg-yellow-500' }, { code: 'CL', color: 'bg-red-600' }],
                                client: 'Sungrow', tagColor: 'text-brand-teal',
                                title: 'Guayepo · La Unión · Sierra Gorda',
                                items: ['Cold & Hot Commissioning of Sungrow conversion centers', 'Equipment configuration and commissioning', 'Preventive and corrective maintenance', 'Mechanical assembly of trackers and solar panels'],
                            },
                            {
                                codes: [{ code: 'MX', color: 'bg-emerald-600' }],
                                client: 'Eiffage', tagColor: 'text-amber-600',
                                title: 'PFV Andalucía II',
                                items: ['Panel stringing and AC/DC cable installation', 'Inverter and combiner box mounting', 'Transformer mounting and terminations', 'Full commissioning'],
                            },
                            {
                                codes: [{ code: 'US', color: 'bg-blue-600' }],
                                client: 'Grupo Ortiz / Power Electronics', tagColor: 'text-indigo-600',
                                title: '7V Solar Ranch · Blythe Solar',
                                items: ['Operational control from commissioning to COD', 'Performance test advisory', 'Cold & Hot Commissioning of inverters and BESS', 'Troubleshooting and retrofitting'],
                            },
                        ].map((p, i) => (
                            <Reveal key={p.title} delay={i * 80} className="h-full">
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 h-full flex flex-col">
                                    <div className="flex items-center gap-2 mb-2">
                                        {p.codes.map(c => (
                                            <span key={c.code} className={`${c.color} text-white font-black text-[10px] tracking-widest px-2 py-0.5 rounded-md`}>{c.code}</span>
                                        ))}
                                        <span className={`text-xs font-black uppercase tracking-wider ${p.tagColor}`}>{p.client}</span>
                                    </div>
                                    <h4 className="font-black text-gray-800 text-sm mb-3 leading-tight">{p.title}</h4>
                                    <ul className="space-y-1.5 flex-1">
                                        {p.items.map(item => (
                                            <li key={item} className="flex items-start gap-2 text-xs text-gray-500 font-medium">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0 mt-1" />{item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </Reveal>
                        ))}
                    </div>

                    {/* E-Mobility case */}
                    <Reveal>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex gap-5 items-start">
                            <div className="bg-emerald-500 text-white font-black text-[10px] tracking-widest px-2.5 py-1 rounded-lg shrink-0 mt-0.5">MX</div>
                            <div>
                                <div className="text-[11px] font-black text-emerald-700 uppercase tracking-wider mb-1">Mexico City — RTP / Yutong</div>
                                <h4 className="font-black text-gray-900 text-base mb-2">Full EPC EV Charging Hubs — 5 MW</h4>
                                <div className="flex flex-wrap gap-x-6 gap-y-1">
                                    {['Basic & detailed engineering', 'Full electrical installation', 'Commissioning & startup', 'Operations & maintenance'].map(s => (
                                        <span key={s} className="text-xs text-gray-600 font-semibold flex items-center gap-1.5">
                                            <CheckCircle2 size={12} className="text-emerald-500" />{s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                CONTÁCTENOS
            ══════════════════════════════════════════════════════════ */}
            <section className="bg-brand-teal py-28 px-8">
                <div className="max-w-5xl mx-auto">
                    <Reveal className="text-center mb-16">
                        <h2 className="text-5xl font-black text-white mb-4">Let's talk.</h2>
                        <p className="text-white/70 text-lg max-w-md mx-auto leading-relaxed">
                            Have a project that needs expert technical support in the field? Let's connect.
                        </p>
                        <a
                            href="mailto:contacto@latnovva.com"
                            className="inline-flex items-center gap-3 bg-white text-brand-teal rounded-full px-8 py-4 text-base font-black mt-8 hover:bg-emerald-50 transition-all shadow-xl"
                        >
                            <Mail size={18} />
                            contacto@latnovva.com
                        </a>
                    </Reveal>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                        {[
                            { code: 'MX', country: 'Mexico — Mérida', address: 'Calle 56 #500, Office 1 Building 6, Itzimina, Mérida, Yuc.' },
                            { code: 'MX', country: 'Mexico — CDMX', address: 'Río Nilo 80, Office 301, Cuauhtémoc, Mexico City' },
                            { code: 'US', country: 'United States', address: '1801 NE 123rd Street Suite 336, Miami, Florida' },
                            { code: 'CO', country: 'Colombia', address: 'Calle 93 #15-27, Office 702. Bogotá' },
                            { code: 'DO', country: 'Dominican Republic', address: 'C/ Ensanche 1B, Punta Cana' },
                            { code: 'CL', country: 'Chile', address: 'Apoquindo 5950, Floor 21 Office 21-116, Las Condes, Santiago' },
                        ].map((office, i) => (
                            <Reveal key={office.country} delay={100 + i * 50} className="h-full">
                                <div className="bg-white/12 backdrop-blur border border-white/20 rounded-2xl p-5 hover:bg-white/20 transition-all h-full flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-white/15 text-emerald-300 font-black text-[10px] tracking-wider px-2 py-0.5 rounded-md">
                                                {office.code}
                                            </span>
                                            <span className="font-black text-white text-sm">{office.country}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <MapPin size={12} className="text-emerald-300 shrink-0 mt-0.5" />
                                            <p className="text-white/65 text-xs font-medium leading-relaxed">{office.address}</p>
                                        </div>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-950 py-10 px-8 text-center">
                <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-8 mx-auto mb-4 brightness-0 invert opacity-60" />
                <p className="text-gray-600 text-xs">© {new Date().getFullYear()} LATNOVVA. All rights reserved.</p>
            </footer>

        </div>
    );
}
