import { CheckCircle2, Zap, Shield, Train, Rss, Mail, Phone, Cpu, FileText } from 'lucide-react';

export default function GuestPresentationTab() {
    return (
        <div className="flex flex-col w-full h-full bg-white relative overflow-y-auto">
            
            {/* Hero Banner Section */}
            <div className="relative bg-brand-teal text-white py-28 px-8 overflow-hidden shrink-0">
                {/* Decorative grid pattern */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 opacity-15">
                    <svg width="404" height="384" fill="none" viewBox="0 0 404 384">
                        <defs>
                            <pattern id="dot-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                <rect x="0" y="0" width="4" height="4" fill="currentColor"></rect>
                            </pattern>
                        </defs>
                        <rect width="404" height="384" fill="url(#dot-pattern)"></rect>
                    </svg>
                </div>
                
                <div className="max-w-5xl mx-auto relative z-10 flex flex-col items-center text-center">
                    <span className="bg-emerald-500/35 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-6">
                        Technical Capabilities Brief 2026
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight leading-tight">
                        Engineering-Led <br/>
                        <span className="text-emerald-300">Field Execution & Integration</span>
                    </h2>
                    <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-10 font-medium leading-relaxed">
                        Deploying highly experienced field crews across construction, commissioning, and operations for renewable energy, industrial, and railway projects globally.
                    </p>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="py-12 px-8 bg-surface-alt border-b border-gray-100 shrink-0">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 text-center">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100/80 shadow-sm">
                            <div className="text-3xl font-black text-brand-teal mb-1">2,500+ MW</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Executed in Renewables</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100/80 shadow-sm">
                            <div className="text-3xl font-black text-brand-teal mb-1">285+</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Global Employees</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100/80 shadow-sm">
                            <div className="text-3xl font-black text-brand-teal mb-1">100+</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tertiary & Industrial Works</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100/80 shadow-sm">
                            <div className="text-3xl font-black text-brand-teal mb-1">18+ MW</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">E-Mobility Operations</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100/80 shadow-sm col-span-2 lg:col-span-1">
                            <div className="text-3xl font-black text-brand-teal mb-1">12</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Countries of Presence</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Core Lines of Business */}
            <div className="py-20 px-8 bg-white flex-1">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h3 className="text-brand-teal font-bold tracking-widest uppercase text-xs mb-3">Capabilities</h3>
                        <h2 className="text-3xl md:text-4xl font-black text-accent-greyDark">Lines of Business</h2>
                        <p className="text-gray-400 text-sm font-medium mt-2 max-w-xl mx-auto">
                            Comprehensive engineering, installation, and field execution across five core strategic sectors.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Green Energy */}
                        <div className="bg-surface-alt rounded-3xl p-8 border border-gray-100/60 shadow-sm hover:shadow-md transition-all group">
                            <div className="bg-brand-teal/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <Zap className="text-brand-teal" size={28} />
                            </div>
                            <h4 className="text-xl font-bold text-accent-greyDark mb-3">Green Energies</h4>
                            <p className="text-gray-500 text-xs leading-relaxed mb-6 font-medium">
                                Technical support for Solar and BESS projects. Construction in EPC, BOS, or BOP modes, grid compliance, energization, and preventive/corrective O&M.
                            </p>
                            <ul className="space-y-2 border-t border-gray-200/50 pt-4">
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-brand-teal" /> PCS & BESS Integration
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-brand-teal" /> MV Skids & Inverters
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-brand-teal" /> COD and Performance Tests
                                </li>
                            </ul>
                        </div>

                        {/* Technical Leadership */}
                        <div className="bg-gradient-to-br from-brand-teal to-brand-teal/80 text-white rounded-3xl p-8 border border-brand-teal/20 shadow-md flex flex-col justify-center">
                            <div className="bg-white/15 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <Cpu className="text-emerald-300" size={28} />
                            </div>
                            <h4 className="text-xl font-bold mb-3">Technical Leadership</h4>
                            <p className="text-white/80 text-xs leading-relaxed font-medium">
                                Led directly by engineers with hands-on, multi-decade experience in BESS, MV networks, and industrial commissions. We integrate seamlessly into owner or EPC teams to keep projects on track.
                            </p>
                        </div>

                        {/* Industrial */}
                        <div className="bg-surface-alt rounded-3xl p-8 border border-gray-100/60 shadow-sm hover:shadow-md transition-all group">
                            <div className="bg-amber-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <Shield className="text-amber-600" size={28} />
                            </div>
                            <h4 className="text-xl font-bold text-accent-greyDark mb-3">Industrial Facilities</h4>
                            <p className="text-gray-500 text-xs leading-relaxed mb-6 font-medium">
                                Design, start-up, and electromechanical maintenance for complex facilities, including MV substations, low voltage switchboards, and SCADA systems.
                            </p>
                            <ul className="space-y-2 border-t border-gray-200/50 pt-4">
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-amber-500" /> Medium Voltage Connections
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-amber-500" /> Preventive & Corrective O&M
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-amber-500" /> Property Engineering
                                </li>
                            </ul>
                        </div>

                        {/* Railway */}
                        <div className="bg-surface-alt rounded-3xl p-8 border border-gray-100/60 shadow-sm hover:shadow-md transition-all group">
                            <div className="bg-indigo-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <Train className="text-indigo-600" size={28} />
                            </div>
                            <h4 className="text-xl font-bold text-accent-greyDark mb-3">Railway Infrastructure</h4>
                            <p className="text-gray-500 text-xs leading-relaxed mb-6 font-medium">
                                Execution of complex induced works (HV/MV/LV grid rerouting) and comprehensive railway systems including catenary engineering, supply, and maintenance.
                            </p>
                            <ul className="space-y-2 border-t border-gray-200/50 pt-4">
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-indigo-500" /> Induced Electrical Works
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-indigo-500" /> Catenary Engineering
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-indigo-500" /> Detailed Site Engineering
                                </li>
                            </ul>
                        </div>

                        {/* Communications */}
                        <div className="bg-surface-alt rounded-3xl p-8 border border-gray-100/60 shadow-sm hover:shadow-md transition-all group">
                            <div className="bg-rose-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <Rss className="text-rose-600" size={28} />
                            </div>
                            <h4 className="text-xl font-bold text-accent-greyDark mb-3">Communications</h4>
                            <p className="text-gray-500 text-xs leading-relaxed mb-6 font-medium">
                                Design, layout, construction, and commissioning of structural communication arrays, fiber optic networks, and dedicated telemetry backbones.
                            </p>
                            <ul className="space-y-2 border-t border-gray-200/50 pt-4">
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-rose-500" /> Fiber Optic & Network Layout
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-rose-500" /> Telemetry & SCADA
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                    <CheckCircle2 size={14} className="text-rose-500" /> Preventative Infrastructure O&M
                                </li>
                            </ul>
                        </div>

                    </div>
                </div>
            </div>

            {/* Core Field Services for Solar & BESS */}
            <div className="py-20 px-8 bg-surface-alt border-t border-b border-gray-100">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col lg:flex-row gap-12 items-center">
                        <div className="lg:w-1/2 space-y-6">
                            <h3 className="text-brand-teal font-bold uppercase text-xs tracking-widest">Field Execution Support</h3>
                            <h2 className="text-3xl font-black text-accent-greyDark leading-tight">Solar & BESS Critical Phases</h2>
                            <p className="text-gray-500 text-sm leading-relaxed font-medium">
                                We deploy dedicated, fully equipped technical crews to manage the most challenging phases of utility-scale energy projects.
                            </p>
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div className="p-4 bg-white rounded-2xl border border-gray-200/50 shadow-sm">
                                    <h5 className="font-bold text-accent-greyDark text-sm mb-1">Commissioning</h5>
                                    <p className="text-[11px] text-gray-400 font-medium">Pre-commissioning, functional tests, PCS/BESS and MV integration.</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-gray-200/50 shadow-sm">
                                    <h5 className="font-bold text-accent-greyDark text-sm mb-1">Troubleshooting</h5>
                                    <p className="text-[11px] text-gray-400 font-medium">System fault resolution, control wiring, firmware, and telemetry troubleshooting.</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-gray-200/50 shadow-sm">
                                    <h5 className="font-bold text-accent-greyDark text-sm mb-1">Punch List Closure</h5>
                                    <p className="text-[11px] text-gray-400 font-medium">Multi-crew execution under tight deadlines to successfully secure COD.</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-gray-200/50 shadow-sm">
                                    <h5 className="font-bold text-accent-greyDark text-sm mb-1">Preventive O&M</h5>
                                    <p className="text-[11px] text-gray-400 font-medium">Continuous operational support, transformer maintenance, and mechanical reviews.</p>
                                </div>
                            </div>
                        </div>
                        <div className="lg:w-1/2 bg-white rounded-3xl p-8 border border-gray-200/50 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                <FileText className="text-brand-teal" size={24} />
                                <h4 className="text-lg font-black text-accent-greyDark">The LATNOVVA Advantage</h4>
                            </div>
                            <ul className="space-y-4">
                                {[
                                    { title: "Fast US Nationwide Deployment", desc: "Rapid mobilization of qualified field crews across all states." },
                                    { title: "OEM & EPC Integration", desc: "Working directly with leading manufacturers (Sungrow, Power Electronics, etc.) and main contractors." },
                                    { title: "Technical Depth under Pressure", desc: "Resolving active, high-priority issues on-site without interrupting project progress." },
                                    { title: "Flexible Operational Scale", desc: "From single specialist dispatches to full field supervision crews depending on timeline." }
                                ].map((adv, idx) => (
                                    <li key={idx} className="flex gap-4 items-start">
                                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <h5 className="font-bold text-accent-greyDark text-sm">{adv.title}</h5>
                                            <p className="text-xs text-gray-500 mt-0.5">{adv.desc}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Call to Action & Technical Contacts */}
            <div className="bg-accent-greyDark text-white py-20 px-8 shrink-0">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 justify-between items-start">
                    <div className="space-y-4 max-w-md">
                        <h3 className="text-emerald-400 font-bold uppercase text-xs tracking-widest">Connect with Us</h3>
                        <h2 className="text-3xl font-black leading-tight">Need On-Site Technical Support?</h2>
                        <p className="text-gray-400 text-sm leading-relaxed font-medium">
                            Let's set up a quick call to understand your site's operational needs and see how we can assist.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full md:w-auto">
                        <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5 min-w-[240px]">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">US Operations</span>
                            <h4 className="font-bold text-sm text-white">Fernando Asensio</h4>
                            <span className="text-xs text-gray-400 block font-medium">CEO</span>
                            <div className="space-y-1.5 pt-3 border-t border-white/5">
                                <a href="mailto:fasensio@latnovva.com" className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-emerald-400 transition-colors">
                                    <Mail size={13} /> fasensio@latnovva.com
                                </a>
                                <a href="tel:+17867372139" className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-emerald-400 transition-colors">
                                    <Phone size={13} /> +1 786 737 2139
                                </a>
                            </div>
                        </div>

                        <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5 min-w-[240px]">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Technical & Field Support</span>
                            <h4 className="font-bold text-sm text-white">Andres Provero</h4>
                            <span className="text-xs text-gray-400 block font-medium">Service Director</span>
                            <div className="space-y-1.5 pt-3 border-t border-white/5">
                                <a href="mailto:aprovero@latnovva.com" className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-emerald-400 transition-colors">
                                    <Mail size={13} /> aprovero@latnovva.com
                                </a>
                                <a href="tel:+13465456981" className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-emerald-400 transition-colors">
                                    <Phone size={13} /> +1 346 545 6981
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
