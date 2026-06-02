import { Input } from '../ui/input';
import { Personnel } from '../../store/useStore';

interface MexicoHRFormProps {
    data: Partial<Personnel>;
    onChange: (updates: Partial<Personnel>) => void;
}

export function MexicoHRForm({ data, onChange }: MexicoHRFormProps) {
    const md = data.subsidiaryMetadata || {};

    const updateMeta = (field: string, value: any) => {
        onChange({ subsidiaryMetadata: { ...md, [field]: value } });
    };

    const updateTopLevel = (field: keyof Personnel, value: any) => {
        onChange({ [field]: value });
    };

    const nominaPpp = parseFloat(md.nominaPpp || '0');
    const nominaImss = parseFloat(md.nominaImss || '0');
    const totalMonthlyGross = nominaPpp + nominaImss;

    return (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-6 mt-4">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                🇲🇽 Mexico HR Details
            </h3>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">Identification & Demographics</h4>
                <div className="grid grid-cols-2 gap-4">
                    {/* Row 1: CURP | INE */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">CURP</label>
                        <Input value={md.curp || ''} onChange={e => updateMeta('curp', e.target.value.toUpperCase())} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">INE</label>
                        <Input value={md.ine || ''} onChange={e => updateMeta('ine', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    {/* Row 2: RFC | CP (RFC Postal Code from Constancia de Situación Fiscal) */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">RFC</label>
                        <Input value={md.rfc || ''} onChange={e => updateMeta('rfc', e.target.value.toUpperCase())} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">
                            CP <span className="normal-case text-[9px] font-normal text-amber-600/70">(Constancia Fiscal)</span>
                        </label>
                        <Input value={md.rfcPostalCode || ''} onChange={e => updateMeta('rfcPostalCode', e.target.value)} placeholder="Código Postal" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    {/* Row 3: DOB | AGE */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Date of Birth</label>
                        <Input value={md.birthDate || ''} onChange={e => updateMeta('birthDate', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Age</label>
                        <Input type="number" value={md.age || ''} onChange={e => updateMeta('age', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    {/* Row 4: GENDER | MARITAL STATUS */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Gender</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.gender || ''} onChange={e => updateMeta('gender', e.target.value)}>
                            <option value="">Select...</option>
                            <option value="MASCULINO">Male (Masculino)</option>
                            <option value="FEMENINO">Female (Femenino)</option>
                            <option value="OTRO">Other</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Marital Status</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.maritalStatus || ''} onChange={e => updateMeta('maritalStatus', e.target.value)}>
                            <option value="">Select...</option>
                            <option value="SOLTERO(A)">Single</option>
                            <option value="CASADO(A)">Married</option>
                            <option value="DIVORCIADO(A)">Divorced</option>
                            <option value="VIUDO(A)">Widowed</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">Address & Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Full Address</label>
                        <Input value={md.addressFull || md.street || ''} onChange={e => updateMeta('addressFull', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Personal Email</label>
                        <Input type="email" value={data.email || ''} onChange={e => updateTopLevel('email', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1 col-span-2 border-t pt-2 mt-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Emergency Contact Name</label>
                        <Input value={md.emergencyContactName || ''} onChange={e => updateMeta('emergencyContactName', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Emergency Contact Phone</label>
                        <Input value={md.emergencyContactPhone || ''} onChange={e => updateMeta('emergencyContactPhone', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Relationship</label>
                        <Input value={md.emergencyContactRelationship || ''} onChange={e => updateMeta('emergencyContactRelationship', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">Employment Details</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Worker Type</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.workerType || ''} onChange={e => updateMeta('workerType', e.target.value)}>
                            <option value="">Select...</option>
                            <option value="LOCAL">Local</option>
                            <option value="FORANEO">Foreign (Foráneo)</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Site Assigned</label>
                        <Input value={md.siteAssigned || ''} onChange={e => updateMeta('siteAssigned', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Level of Studies</label>
                        <Input value={md.studiesLevel || ''} onChange={e => updateMeta('studiesLevel', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Specialty</label>
                        <Input value={md.specialty || ''} onChange={e => updateMeta('specialty', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Years of Service</label>
                        <Input type="number" step="0.1" value={md.yearsOfService || ''} onChange={e => updateMeta('yearsOfService', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Contract Duration</label>
                        <Input value={md.contractDuration || ''} onChange={e => updateMeta('contractDuration', e.target.value)} placeholder="e.g. 3 Meses / Indeterminado" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Contract Expiry</label>
                        <Input value={md.contractExpiry || ''} onChange={e => updateMeta('contractExpiry', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Probation Expiry</label>
                        <Input value={md.probationExpiry || ''} onChange={e => updateMeta('probationExpiry', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">IMSS Registration Date</label>
                        <Input value={md.imssDate || ''} onChange={e => updateMeta('imssDate', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Date of Hire</label>
                        <Input value={md.hireDate || ''} onChange={e => updateMeta('hireDate', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">Payroll & Financials</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Payroll Type</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.payrollType || ''} onChange={e => updateMeta('payrollType', e.target.value)}>
                            <option value="">Select...</option>
                            <option value="QUINCENAL">Quincenal</option>
                            <option value="SEMANAL">Semanal</option>
                            <option value="MENSUAL">Mensual</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Bank Name</label>
                        <Input value={md.bank || md.bankName || ''} onChange={e => updateMeta('bank', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">CLABE</label>
                        <Input value={md.clabe || ''} onChange={e => updateMeta('clabe', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    
                    {/* Salary Split */}
                    <div className="col-span-2 grid grid-cols-3 gap-2 mt-2 pt-2 border-t">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700/60 uppercase">Nomina PPP</label>
                            <Input type="number" step="0.01" value={md.nominaPpp || ''} onChange={e => updateMeta('nominaPpp', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700/60 uppercase">Nomina IMSS</label>
                            <Input type="number" step="0.01" value={md.nominaImss || ''} onChange={e => updateMeta('nominaImss', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-brand-teal uppercase">Total Monthly Gross</label>
                            <div className="h-9 px-3 bg-amber-100/50 rounded-xl flex items-center text-sm font-bold text-amber-900">
                                ${totalMonthlyGross.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Monthly Viaticos</label>
                        <Input type="number" step="0.01" value={md.viaticosMonthly || ''} onChange={e => updateMeta('viaticosMonthly', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Bonuses</label>
                        <Input type="number" step="0.01" value={md.bonuses || ''} onChange={e => updateMeta('bonuses', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Aguinaldo Days</label>
                        <Input type="number" value={md.aguinaldoDays || ''} onChange={e => updateMeta('aguinaldoDays', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Vacation Days (Total/Rem)</label>
                        <div className="flex gap-2">
                            <Input type="number" placeholder="Total" value={md.vacationDaysTotal || ''} onChange={e => updateMeta('vacationDaysTotal', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                            <Input type="number" placeholder="Rem" value={md.vacationDaysRemaining || ''} onChange={e => updateMeta('vacationDaysRemaining', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                    </div>

                    {/* Infonavit */}
                    <div className="col-span-2 flex flex-col gap-2 mt-2 pt-2 border-t">
                        <label className="flex items-center gap-2 text-sm font-bold text-amber-800/80 cursor-pointer">
                            <input type="checkbox" checked={md.infonavitCredit === 'SI' || !!md.infonavitActive} onChange={e => { updateMeta('infonavitActive', e.target.checked); updateMeta('infonavitCredit', e.target.checked ? 'SI' : 'NO') }} className="w-4 h-4 text-brand-teal rounded" />
                            Infonavit Active
                        </label>
                        {(md.infonavitCredit === 'SI' || md.infonavitActive) && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-amber-700/60 uppercase">Infonavit Amount</label>
                                <Input type="number" step="0.01" value={md.infonavitAmount || ''} onChange={e => updateMeta('infonavitAmount', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Primary Beneficiary (Name & Contact)</label>
                        <Input value={md.primaryBeneficiary || ''} onChange={e => updateMeta('primaryBeneficiary', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">Logistics & Equipment</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Vest Size</label>
                        <Input value={md.vestSize || ''} onChange={e => updateMeta('vestSize', e.target.value)} className="bg-white text-sm text-center uppercase border-amber-200 focus-visible:ring-amber-500" placeholder="M" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Shirt Size</label>
                        <Input value={md.shirtSize || ''} onChange={e => updateMeta('shirtSize', e.target.value)} className="bg-white text-sm text-center uppercase border-amber-200 focus-visible:ring-amber-500" placeholder="L" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">Shoe Size</label>
                        <Input value={md.shoeSize || ''} onChange={e => updateMeta('shoeSize', e.target.value)} className="bg-white text-sm text-center border-amber-200 focus-visible:ring-amber-500" placeholder="28" />
                    </div>
                </div>
            </div>

        </div>
    );
}
