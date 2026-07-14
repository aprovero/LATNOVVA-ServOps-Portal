import { useEffect, useRef, useState } from 'react';
import { Mail, MapPin, Zap, Train, Rss, Globe, Factory, CheckCircle2, ChevronDown } from 'lucide-react';

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
                transition: `all 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
            }}
        >
            {children}
        </div>
    );
}

const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="inline-flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
        <span className="text-[10px] font-black text-brand-teal uppercase tracking-[0.25em]">{children}</span>
    </div>
);

const CountryFlag = ({ code }: { code: string }) => {
    switch (code) {
        case 'MX':
            return (
                <svg className="w-5 h-3.5 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
                    <rect width="10" height="20" fill="#006847" />
                    <rect x="10" width="10" height="20" fill="#FFFFFF" />
                    <rect x="20" width="10" height="20" fill="#C8102E" />
                    <circle cx="15" cy="10" r="1.5" fill="#8B5A2B" />
                </svg>
            );
        case 'CO':
            return (
                <svg className="w-5 h-3.5 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">
                    <rect width="3" height="1" fill="#FCD116" />
                    <rect y="1" width="3" height="0.5" fill="#003893" />
                    <rect y="1.5" width="3" height="0.5" fill="#CE1126" />
                </svg>
            );
        case 'CL':
            return (
                <svg className="w-5 h-3.5 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">
                    <rect width="3" height="1" fill="#FFFFFF" />
                    <rect y="1" width="3" height="1" fill="#D52B1E" />
                    <rect width="1" height="1" fill="#0039A6" />
                    <polygon points="0.5,0.25 0.58,0.48 0.83,0.48 0.63,0.63 0.7,0.86 0.5,0.72 0.3,0.86 0.37,0.63 0.17,0.48 0.42,0.48" fill="#FFFFFF" />
                </svg>
            );
        case 'US':
            return (
                <svg className="w-5 h-3.5 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 190 100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="190" height="100" fill="#B22234" />
                    <path d="M0,0 H190 M0,15.4 H190 M0,30.8 H190 M0,46.2 H190 M0,61.5 H190 M0,76.9 H190 M0,92.3 H190" stroke="#FFFFFF" strokeWidth="7.7" />
                    <rect width="76" height="53.85" fill="#3C3B6E" />
                    <circle cx="10" cy="7" r="1.5" fill="#FFFFFF" />
                    <circle cx="22" cy="7" r="1.5" fill="#FFFFFF" />
                    <circle cx="34" cy="7" r="1.5" fill="#FFFFFF" />
                    <circle cx="46" cy="7" r="1.5" fill="#FFFFFF" />
                    <circle cx="58" cy="7" r="1.5" fill="#FFFFFF" />
                    <circle cx="70" cy="7" r="1.5" fill="#FFFFFF" />
                    <circle cx="16" cy="14" r="1.5" fill="#FFFFFF" />
                    <circle cx="28" cy="14" r="1.5" fill="#FFFFFF" />
                    <circle cx="40" cy="14" r="1.5" fill="#FFFFFF" />
                    <circle cx="52" cy="14" r="1.5" fill="#FFFFFF" />
                    <circle cx="64" cy="14" r="1.5" fill="#FFFFFF" />
                    <circle cx="10" cy="21" r="1.5" fill="#FFFFFF" />
                    <circle cx="22" cy="21" r="1.5" fill="#FFFFFF" />
                    <circle cx="34" cy="21" r="1.5" fill="#FFFFFF" />
                    <circle cx="46" cy="21" r="1.5" fill="#FFFFFF" />
                    <circle cx="58" cy="21" r="1.5" fill="#FFFFFF" />
                    <circle cx="70" cy="21" r="1.5" fill="#FFFFFF" />
                    <circle cx="16" cy="28" r="1.5" fill="#FFFFFF" />
                    <circle cx="28" cy="28" r="1.5" fill="#FFFFFF" />
                    <circle cx="40" cy="28" r="1.5" fill="#FFFFFF" />
                    <circle cx="52" cy="28" r="1.5" fill="#FFFFFF" />
                    <circle cx="64" cy="28" r="1.5" fill="#FFFFFF" />
                </svg>
            );
        case 'DO':
            return (
                <svg className="w-5 h-3.5 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
                    <rect width="30" height="20" fill="#FFFFFF" />
                    <rect x="0" y="0" width="13" height="8.5" fill="#002D62" />
                    <rect x="17" y="0" width="13" height="8.5" fill="#CE1126" />
                    <rect x="0" y="11.5" width="13" height="8.5" fill="#CE1126" />
                    <rect x="17" y="11.5" width="13" height="8.5" fill="#002D62" />
                    <rect x="14" y="9" width="2" height="2" fill="#006847" />
                </svg>
            );
        default:
            return null;
    }
};

const CountUp = ({ to, duration = 1500 }: { to: number; duration?: number }) => {
    const [count, setCount] = useState(0);
    const elementRef = useRef<HTMLDivElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    let startTime: number | null = null;
                    const animate = (timestamp: number) => {
                        if (!startTime) startTime = timestamp;
                        const progress = Math.min((timestamp - startTime) / duration, 1);
                        const easeProgress = progress * (2 - progress); // Ease out quad
                        setCount(Math.floor(easeProgress * to));
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            setCount(to);
                        }
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.1 }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, [to, duration]);

    return <span ref={elementRef}>{count}</span>;
};

/* ═══════════════════════════════════════════════════════════════════════ */
export default function LatnovvaESPBrochure() {
    return (
        <div className="flex flex-col w-full bg-white font-sans text-gray-800 antialiased selection:bg-brand-teal selection:text-white">

            {/* ══════════════════════════════════════════════════════════
                HERO SECTION
            ══════════════════════════════════════════════════════════ */}
            <section className="relative h-[92vh] flex items-center px-8 overflow-hidden bg-slate-950">
                {/* Background image & gradient overlay */}
                <div className="absolute inset-0">
                    <img src="/latnovva-esp/slide_01.png" alt="" className="w-full h-full object-contain p-4 object-center opacity-45" />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/40 to-transparent" />
                </div>
                <div className="relative z-10 max-w-5xl mx-auto w-full">
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
                        <p className="text-white/70 text-base md:text-lg max-w-xl mb-10 leading-relaxed font-medium">
                            Since 2018, we deploy specialized crews for construction, commissioning, and O&amp;M
                            on renewable energy, industrial, and railway projects across 10+ countries.
                        </p>
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                            <Globe size={16} />
                            <span>Mexico · USA · Colombia · Chile</span>
                        </div>
                    </Reveal>
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40 animate-bounce">
                        <span className="text-[9px] font-black tracking-widest uppercase text-white">Scroll</span>
                        <ChevronDown size={14} className="text-white" />
                    </div>
                </div>
            </section>

            {/* Stats section */}
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
                                <CountUp to={s.value} />{s.suffix}
                            </div>
                            <div className="text-[10px] font-black text-emerald-200 uppercase tracking-wider leading-tight">
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
                    {/* World presence visual — Custom map image directly on white page */}
                    <Reveal delay={150} className="relative flex items-center justify-center w-full">
                        <img 
                            src="/latnovva-esp/map_custom.png" 
                            alt="International Presence Map" 
                            className="w-full max-h-[550px] md:scale-125 object-contain" 
                        />
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
                                img: '/latnovva-esp/green_energies_bg.png',
                                imgStyle: 'object-contain p-2 opacity-50 group-hover:scale-105 transition-transform duration-500',
                            },
                            {
                                icon: Factory,
                                title: 'Industrial Facilities',
                                desc: 'MPE installations, maintenance in hospitals, hotels and industrial warehouses.',
                                border: 'border-amber-500/30',
                                iconColor: 'text-amber-300',
                                img: '/latnovva-esp/industrial_bg.png',
                                imgStyle: 'object-contain p-2 opacity-50 group-hover:scale-105 transition-transform duration-500',
                            },
                            {
                                icon: Train,
                                title: 'Railway Infrastructure',
                                desc: 'HV/MV/LV induced works, full railway systems and catenary from design to maintenance.',
                                border: 'border-indigo-500/30',
                                iconColor: 'text-indigo-300',
                                img: '/latnovva-esp/railway_bg.png',
                                imgStyle: 'object-contain p-2 opacity-50 group-hover:scale-105 transition-transform duration-500',
                            },
                            {
                                icon: Rss,
                                title: 'Communications',
                                desc: 'Design, construction and commissioning of fiber optic networks and telemetry backbones.',
                                border: 'border-rose-500/30',
                                iconColor: 'text-rose-300',
                                img: '/latnovva-esp/communications_bg.png',
                                imgStyle: 'object-contain p-2 opacity-50 group-hover:scale-105 transition-transform duration-500',
                            },
                            {
                                icon: Globe,
                                title: 'E-Mobility',
                                desc: 'EV charging infrastructure, fleet management, storage optimization and software integration.',
                                border: 'border-emerald-500/30',
                                iconColor: 'text-emerald-300',
                                img: '/latnovva-esp/emobility_bg.png',
                                imgStyle: 'object-contain p-2 opacity-50 group-hover:scale-105 transition-transform duration-500',
                            },
                        ].map((sector, i) => (
                            <Reveal key={sector.title} delay={i * 80}>
                                <div className={`relative group rounded-3xl overflow-hidden border ${sector.border} bg-slate-900 p-6 flex flex-col gap-4 h-full min-h-[340px] cursor-default`}>
                                    {/* Photo background */}
                                    <div className="absolute inset-0 opacity-45 group-hover:opacity-75 transition-opacity duration-500">
                                        <img src={sector.img} alt="" className={`w-full h-full ${sector.imgStyle}`} />
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
            <section className="relative py-32 px-8 overflow-hidden bg-brand-teal">
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
                                        className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-110 scale-[2.2] origin-left" 
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
                                        className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-110 scale-[2.2] origin-left" 
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
                                        className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-110 scale-[2.2] origin-left" 
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
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-[310px] mx-auto border border-gray-100 bg-transparent">
                            <img 
                                src="/latnovva-esp/charger_custom.png" 
                                alt="E-Mobility EV Charger" 
                                className="w-full h-auto block" 
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
                                <span className="text-brand-teal">with our participation.</span>
                            </h2>
                            <p className="text-gray-500 text-base leading-relaxed mb-8">
                                We participated in the delivery of the highest-capacity EV charging hub (4 MW) in Latin America, in Mérida, Yucatán. We offer charging infrastructure support and solutions from feasibility to ongoing operations.
                            </p>
                        </Reveal>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { title: 'Operation & Maintenance Services', icon: '🔧' },
                                { title: 'Property Engineering', icon: '🏢' },
                                { title: 'Basic and/or Detail Engineering', icon: '📐' },
                                { title: 'EPC and/or BoS Delivery Models', icon: '🏗️' },
                                { title: 'Capex and Opex Modality', icon: '💼' },
                                { title: 'PPA Modality', icon: '🔌' },
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
                                    items: ['Increased productivity', 'Optimal time control', 'Faster and more effective decision-making', 'More time for high-value customer activities'],
                                },
                                {
                                    step: '04',
                                    title: 'Evaluation',
                                    color: 'bg-emerald-500',
                                    items: ['Visual and timeline-based review', 'Compliance with scheduled milestones', 'Internal audit', 'Joint customer/LATNOVVA assessment'],
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
                        src="/latnovva-esp/clients_clean.jpg" 
                        alt="" 
                        className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gray-950/85" />
                </div>
                <div className="relative z-10 max-w-6xl mx-auto">
                    <Reveal className="text-center mb-14">
                        <Label>Our Customers</Label>
                        <h2 className="text-4xl font-black text-white mt-2">
                            Trusted by the leaders<br />of the energy sector.
                        </h2>
                    </Reveal>

                    {/* Interactive Customers Showcase with Individual PNG Logo Files */}
                    <Reveal delay={100}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-10">
                            {[
                                { name: 'CEEC (China Energy)', type: 'Energy Giant', file: 'ceec.png', color: 'hover:border-red-500/40' },
                                { name: 'Sungrow', type: 'Solar & Storage', file: 'sungrow.png', color: 'hover:border-orange-500/40' },
                                { name: 'Trina Solar', type: 'Solar PV Tech', file: 'trina_solar.png', color: 'hover:border-red-500/40' },
                                { name: 'Canadian Solar', type: 'Module & Storage EPC', file: 'canadian_solar.png', color: 'hover:border-yellow-500/40' },
                                { name: 'GE Vernova', type: 'Power Systems', file: 'ge.png', color: 'hover:border-blue-600/40', imgClass: 'max-w-[95%] max-h-[90%] scale-[1.08]' },
                                { name: 'NextEra Energy', type: 'Utility Developer', file: 'nextera_energy.png', color: 'hover:border-emerald-500/40', imgClass: 'max-w-[92%] max-h-[90%] scale-105 translate-y-1.5' },
                                { name: 'Enel', type: 'Global Utility', file: 'enel.png', color: 'hover:border-rose-500/40' },
                                { name: 'ENGIE', type: 'Energy Developer', file: 'engie.png', color: 'hover:border-cyan-500/40' },
                                { name: 'Acciona', type: 'Renewables EPC', file: 'acciona.png', color: 'hover:border-red-600/40' },
                                { name: 'Eiffage Energía', type: 'Infrastructure', file: 'eiffage_energia.png', color: 'hover:border-red-500/40', imgClass: 'max-w-[98%] max-h-[95%] scale-[1.12]' },
                                { name: 'Elecnor', type: 'Power Grid EPC', file: 'elecnor.png', color: 'hover:border-blue-600/40' },
                                { name: 'Power Electronics', type: 'Solar Inverters', file: 'power_electronics.png', color: 'hover:border-orange-650/40' },
                                { name: 'Grupo Cobra', type: 'Industrial BOP', file: 'grupo_cobra.png', color: 'hover:border-green-600/40' },
                                { name: 'TSK', type: 'BOP/BOS Leader', file: 'tsk.png', color: 'hover:border-blue-500/40' },
                                { name: 'Ferrovial', type: 'Railway & Infra', file: 'ferrovial.png', color: 'hover:border-yellow-500/40' },
                                { name: 'CFE', type: 'Utility Operator', file: 'cfe.png', color: 'hover:border-emerald-600/40', imgClass: 'max-w-[92%] max-h-[90%] scale-105' },
                                { name: 'CEN Solutions', type: 'Auxiliary Systems', file: 'cen_solutions.png', color: 'hover:border-emerald-500/40', imgClass: 'max-w-[95%] max-h-[90%] scale-[1.05]' },
                                { name: 'CJR Renewable', type: 'Wind & Solar EPC', file: 'cjr_renewable.png', color: 'hover:border-green-500/40', imgClass: 'max-w-[72%] max-h-[70%]' },
                                { name: 'SAFT', type: 'Industrial Batteries', file: 'saft.png', color: 'hover:border-blue-500/40', imgClass: 'max-w-[70%] max-h-[65%]' },
                                { name: 'AXIAL', type: 'Solar Trackers', file: 'axial.png', color: 'hover:border-yellow-500/40' },
                                { name: 'EKS', type: 'Power Conversion', file: 'eks.png', color: 'hover:border-indigo-500/40', imgClass: 'max-w-[95%] max-h-[90%] scale-[1.08]' },
                                { name: 'EOSOL', type: 'Engineering Consultant', file: 'eosol.png', color: 'hover:border-blue-600/40' },
                                { name: 'Greening Group', type: 'Global Developer', file: 'greening_group.png', color: 'hover:border-green-500/40' },
                                { name: 'Greensol', type: 'Solar Operations', file: 'greensol.png', color: 'hover:border-orange-500/40', imgClass: 'max-w-[95%] max-h-[95%] scale-[1.25]' },
                                { name: 'Grupo Ortiz', type: 'Infrastructure EPC', file: 'grupo_ortiz.png', color: 'hover:border-amber-600/40' },
                            ].map((c) => (
                                <div 
                                    key={c.name} 
                                    className={`bg-white border border-gray-150 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-300 shadow-sm cursor-default h-[155px] ${c.color} hover:bg-slate-50 hover:shadow-xl hover:scale-[1.03]`}
                                >
                                    {/* Logo Image Container */}
                                    <div className="w-full h-16 flex items-center justify-center overflow-hidden">
                                        <img 
                                            src={`/Company Logos/${c.file}`} 
                                            alt={`${c.name} logo`} 
                                            className={`${c.imgClass || 'max-w-[85%] max-h-[85%]'} object-contain object-center mx-auto filter hover:brightness-105 transition-all duration-300`}
                                        />
                                    </div>
                                    <div className="flex flex-col items-center mt-auto justify-end">
                                        <span className="font-extrabold text-xs text-gray-900 leading-tight">{c.name}</span>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">{c.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Reveal>

                    {/* Expandable Project Customers database */}
                    <Reveal delay={250}>
                        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur">
                            <h3 className="text-white font-black text-sm tracking-wide mb-4 uppercase text-emerald-400">
                                ...and more
                            </h3>
                            <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                {[
                                    'AZVINDI', 'Agencia de Transporte de Yucatán', 'CUPISA', 
                                    'ENTIA', 'Energoya', 'Entoria', 'GES', 
                                    'Grupo Enhol', 'Grupo Tradeco', 'Grupotec', 'ICA', 'IMDUT', 'Kempinski', 'Maracof', 
                                    'Marriott', 'NIKO', 'Negratín', 'OHL', 'OPDE', 'Prodiel', 'RTP', 'Riverstone', 'Solventia', 
                                    'Sterling and Wilson', 'TOZZI'
                                ].map((clientName) => (
                                    <span 
                                        key={clientName} 
                                        className="bg-white/8 hover:bg-white/12 border border-white/5 rounded-full px-3.5 py-1.5 text-xs text-white/70 font-semibold tracking-wide transition-all"
                                    >
                                        {clientName}
                                    </span>
                                ))}
                            </div>
                        </div>
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
                                                <CountryFlag code={p.code} />
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
                                            <CountryFlag key={c.code} code={c.code} />
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
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex gap-4 items-center">
                            <CountryFlag code="MX" />
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
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <CountryFlag code={office.code} />
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





