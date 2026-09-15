import { useState } from 'react';
import { Input } from '../ui/input';
import { Personnel } from '../../store/useStore';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MexicoHRFormProps {
    data: Partial<Personnel>;
    onChange: (updates: Partial<Personnel>) => void;
    defaultOpen?: boolean;
}

export function MexicoHRForm({ data, onChange, defaultOpen = false }: MexicoHRFormProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const md = data.subsidiaryMetadata || {};

    const updateMeta = (field: string, value: any) => {
        onChange({ subsidiaryMetadata: { ...md, [field]: value } });
    };

    const nominaPpp = parseFloat(md.nominaPpp || '0');
    const nominaImss = parseFloat(md.nominaImss || '0');
    const totalMonthlyGross = nominaPpp + nominaImss;

    // Count filled fields to show badge
    const filledCount = Object.values(md).filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;

    return (
        <div className="bg-amber-50/70 rounded-2xl border border-amber-200/80 overflow-hidden mt-4 shadow-sm transition-all">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex items-center justify-between bg-amber-100/60 hover:bg-amber-100/90 transition-colors text-left"
            >
                <div className="flex items-center gap-2.5">
                    <span className="text-base">🇲🇽</span>
                    <div>
                        <h3 className="text-xs font-bold text-amber-900 uppercase tracking-widest flex items-center gap-2">
                            {t('personnel.mexico_hr.title', 'Detalles de RH México y Centroamérica')}
                        </h3>
                        <p className="text-[10px] text-amber-700/80 font-medium">
                            {filledCount > 0 ? `${filledCount} campos registrados en expediente` : 'Expediente laboral, fiscal y bancario'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 uppercase">
                        {isOpen ? 'Ocultar' : 'Expandir'}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-amber-800" /> : <ChevronDown className="w-4 h-4 text-amber-800" />}
                </div>
            </button>

            {isOpen && (
                <div className="p-4 space-y-6">
                    <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                        <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">{t('personnel.mexico_hr.demographics_title')}</h4>
                <div className="grid grid-cols-2 gap-4">
                    {/* Row 1: CURP | INE */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.curp')}</label>
                        <Input value={md.curp || ''} onChange={e => updateMeta('curp', e.target.value.toUpperCase())} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.ine')}</label>
                        <Input value={md.ine || ''} onChange={e => updateMeta('ine', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    {/* Row 2: RFC | CP (RFC Postal Code from Constancia de Situación Fiscal) */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.rfc', 'RFC / NIT')}</label>
                        <Input value={md.rfc || md.nit || ''} onChange={e => updateMeta('rfc', e.target.value.toUpperCase())} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.nss', 'NSS / No. Afiliación IGSS')}</label>
                        <Input value={md.nss || md.igss || ''} onChange={e => updateMeta('nss', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">
                            {t('personnel.mexico_hr.cp_label')} <span className="normal-case text-[9px] font-normal text-amber-600/70">{t('personnel.mexico_hr.cp_constancia')}</span>
                        </label>
                        <Input value={md.rfcPostalCode || ''} onChange={e => updateMeta('rfcPostalCode', e.target.value)} placeholder={t('personnel.mexico_hr.cp_placeholder')} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.birth_place', 'Lugar de Nacimiento')}</label>
                        <Input value={md.birthPlace || ''} onChange={e => updateMeta('birthPlace', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.nationality', 'Nacionalidad')}</label>
                        <Input value={md.nationality || ''} onChange={e => updateMeta('nationality', e.target.value.toUpperCase())} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.landline', 'Teléfono Fijo')}</label>
                        <Input value={md.landlinePhone || ''} onChange={e => updateMeta('landlinePhone', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.children', 'Hijos')}</label>
                        <Input type="number" value={md.childrenCount ?? ''} onChange={e => updateMeta('childrenCount', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">{t('personnel.mexico_hr.employment_title')}</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.worker_type')}</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.workerType || ''} onChange={e => updateMeta('workerType', e.target.value)}>
                            <option value="">{t('personnel.mexico_hr.select_placeholder')}</option>
                            <option value="LOCAL">{t('personnel.mexico_hr.worker_type_local')}</option>
                            <option value="FORANEO">{t('personnel.mexico_hr.worker_type_foreign')}</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.studies_level')}</label>
                        <Input value={md.studiesLevel || ''} onChange={e => updateMeta('studiesLevel', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.specialty')}</label>
                        <Input value={md.specialty || ''} onChange={e => updateMeta('specialty', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.years_of_service')}</label>
                        <Input type="number" step="0.1" value={md.yearsOfService || ''} onChange={e => updateMeta('yearsOfService', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.contract_duration')}</label>
                        <Input value={md.contractDuration || ''} onChange={e => updateMeta('contractDuration', e.target.value)} placeholder={t('personnel.mexico_hr.contract_duration_placeholder')} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.contract_expiry')}</label>
                        <Input value={md.contractExpiry || ''} onChange={e => updateMeta('contractExpiry', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.probation_expiry')}</label>
                        <Input value={md.probationExpiry || ''} onChange={e => updateMeta('probationExpiry', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.imss_date')}</label>
                        <Input value={md.imssDate || ''} onChange={e => updateMeta('imssDate', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.registro_patronal')}</label>
                        <Input value={md.registroPatronal || ''} onChange={e => updateMeta('registroPatronal', e.target.value)} placeholder={t('personnel.mexico_hr.registro_patronal_placeholder')} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.hire_date')}</label>
                        <Input value={md.hireDate || ''} onChange={e => updateMeta('hireDate', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.site', 'Sitio / Ubicación')}</label>
                        <Input value={md.site || ''} onChange={e => updateMeta('site', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.branch_office', 'Sede')}</label>
                        <Input value={md.branchOffice || ''} onChange={e => updateMeta('branchOffice', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.siroc', 'Registro SIROC')}</label>
                        <Input value={md.siroc || ''} onChange={e => updateMeta('siroc', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">{t('personnel.mexico_hr.payroll_title')}</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.payroll_type')}</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.payrollType || ''} onChange={e => updateMeta('payrollType', e.target.value)}>
                            <option value="">{t('personnel.mexico_hr.select_placeholder')}</option>
                            <option value="QUINCENAL">{t('personnel.mexico_hr.payroll_type_quincenal')}</option>
                            <option value="SEMANAL">{t('personnel.mexico_hr.payroll_type_semanal')}</option>
                            <option value="MENSUAL">{t('personnel.mexico_hr.payroll_type_mensual')}</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.bank_name')}</label>
                        <Input value={md.bank || md.bankName || ''} onChange={e => updateMeta('bank', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.clabe')}</label>
                        <Input value={md.clabe || ''} onChange={e => updateMeta('clabe', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    
                    {/* Salary Split */}
                    <div className="col-span-2 grid grid-cols-4 gap-2 mt-2 pt-2 border-t">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.nomina_ppp')}</label>
                            <Input type="number" step="0.01" value={md.nominaPpp || ''} onChange={e => updateMeta('nominaPpp', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.nomina_imss')}</label>
                            <Input type="number" step="0.01" value={md.nominaImss || ''} onChange={e => updateMeta('nominaImss', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.sdi')}</label>
                            <Input type="number" step="0.01" value={md.sdi || ''} onChange={e => updateMeta('sdi', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-brand-teal uppercase">{t('personnel.mexico_hr.monthly_gross')}</label>
                            <div className="h-9 px-3 bg-amber-100/50 rounded-xl flex items-center text-sm font-bold text-amber-900">
                                ${totalMonthlyGross.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.monthly_viaticos')}</label>
                        <Input type="number" step="0.01" value={md.viaticosMonthly || ''} onChange={e => updateMeta('viaticosMonthly', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.bonuses')}</label>
                        <Input type="number" step="0.01" value={md.bonuses || ''} onChange={e => updateMeta('bonuses', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.aguinaldo_days')}</label>
                        <Input type="number" value={md.aguinaldoDays || ''} onChange={e => updateMeta('aguinaldoDays', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.vacation_days', 'Días Vacaciones (Totales / Disfrutados / Restantes)')}</label>
                        <div className="grid grid-cols-3 gap-2">
                            <Input type="number" placeholder="Totales" value={md.vacationDaysTotal ?? ''} onChange={e => updateMeta('vacationDaysTotal', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" title="Totales" />
                            <Input type="number" placeholder="Gozados" value={md.vacationDaysTaken ?? ''} onChange={e => updateMeta('vacationDaysTaken', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" title="Disfrutados" />
                            <Input type="number" placeholder="Restantes" value={md.vacationDaysRemaining ?? ''} onChange={e => updateMeta('vacationDaysRemaining', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" title="Disponibles" />
                        </div>
                    </div>

                    {/* Infonavit */}
                    <div className="col-span-2 flex flex-col gap-2 mt-2 pt-2 border-t">
                        <label className="flex items-center gap-2 text-sm font-bold text-amber-800/80 cursor-pointer">
                            <input type="checkbox" checked={md.infonavitCredit === 'SI' || !!md.infonavitActive} onChange={e => { updateMeta('infonavitActive', e.target.checked); updateMeta('infonavitCredit', e.target.checked ? 'SI' : 'NO') }} className="w-4 h-4 text-brand-teal rounded" />
                            {t('personnel.mexico_hr.infonavit_active')}
                        </label>
                        {(md.infonavitCredit === 'SI' || md.infonavitActive) && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.infonavit_amount')}</label>
                                <Input type="number" step="0.01" value={md.infonavitAmount || ''} onChange={e => updateMeta('infonavitAmount', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-1 col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.primary_beneficiary', 'Beneficiario Principal')}</label>
                            <Input value={md.primaryBeneficiary || ''} onChange={e => updateMeta('primaryBeneficiary', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.beneficiary_phone', 'Contacto / Tel. Beneficiario')}</label>
                            <Input value={md.beneficiaryPhone || ''} onChange={e => updateMeta('beneficiaryPhone', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">{t('personnel.mexico_hr.logistics_title')}</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.vest_size')}</label>
                        <Input value={md.vestSize || ''} onChange={e => updateMeta('vestSize', e.target.value)} className="bg-white text-sm text-center uppercase border-amber-200 focus-visible:ring-amber-500" placeholder="M" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.shirt_size')}</label>
                        <Input value={md.shirtSize || ''} onChange={e => updateMeta('shirtSize', e.target.value)} className="bg-white text-sm text-center uppercase border-amber-200 focus-visible:ring-amber-500" placeholder="L" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.shoe_size')}</label>
                        <Input value={md.shoeSize || ''} onChange={e => updateMeta('shoeSize', e.target.value)} className="bg-white text-sm text-center border-amber-200 focus-visible:ring-amber-500" placeholder="28" />
                    </div>
                </div>
            </div>

                </div>
            )}
        </div>
    );
}
