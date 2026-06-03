import { Input } from '../ui/input';
import { Personnel } from '../../store/useStore';
import { useTranslation } from 'react-i18next';

interface MexicoHRFormProps {
    data: Partial<Personnel>;
    onChange: (updates: Partial<Personnel>) => void;
}

export function MexicoHRForm({ data, onChange }: MexicoHRFormProps) {
    const { t } = useTranslation();
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
                🇲🇽 {t('personnel.mexico_hr.title')}
            </h3>

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
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.rfc')}</label>
                        <Input value={md.rfc || ''} onChange={e => updateMeta('rfc', e.target.value.toUpperCase())} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">
                            {t('personnel.mexico_hr.cp_label')} <span className="normal-case text-[9px] font-normal text-amber-600/70">{t('personnel.mexico_hr.cp_constancia')}</span>
                        </label>
                        <Input value={md.rfcPostalCode || ''} onChange={e => updateMeta('rfcPostalCode', e.target.value)} placeholder={t('personnel.mexico_hr.cp_placeholder')} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    {/* Row 3: DOB | AGE */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.dob')}</label>
                        <Input value={md.birthDate || ''} onChange={e => updateMeta('birthDate', e.target.value)} placeholder="DD/MM/YYYY" className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.age')}</label>
                        <Input type="number" value={md.age || ''} onChange={e => updateMeta('age', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    {/* Row 4: GENDER | MARITAL STATUS */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.gender')}</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.gender || ''} onChange={e => updateMeta('gender', e.target.value)}>
                            <option value="">{t('personnel.mexico_hr.select_placeholder')}</option>
                            <option value="MASCULINO">{t('personnel.mexico_hr.gender_male')}</option>
                            <option value="FEMENINO">{t('personnel.mexico_hr.gender_female')}</option>
                            <option value="OTRO">{t('personnel.mexico_hr.gender_other')}</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.marital_status')}</label>
                        <select className="w-full bg-white border border-amber-200 rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={md.maritalStatus || ''} onChange={e => updateMeta('maritalStatus', e.target.value)}>
                            <option value="">{t('personnel.mexico_hr.select_placeholder')}</option>
                            <option value="SOLTERO(A)">{t('personnel.profile.marital_status_soltero', 'Single')}</option>
                            <option value="CASADO(A)">{t('personnel.profile.marital_status_casado', 'Married')}</option>
                            <option value="DIVORCIADO(A)">{t('personnel.profile.marital_status_divorciado', 'Divorced')}</option>
                            <option value="VIUDO(A)">{t('personnel.profile.marital_status_viudo', 'Widowed')}</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 bg-white/60 rounded-2xl border border-amber-200/60">
                <h4 className="text-xs font-bold text-amber-800/80 uppercase tracking-widest">{t('personnel.mexico_hr.address_title')}</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.full_address')}</label>
                        <Input value={md.addressFull || md.street || ''} onChange={e => updateMeta('addressFull', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.personal_email')}</label>
                        <Input type="email" value={data.email || ''} onChange={e => updateTopLevel('email', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1 col-span-2 border-t pt-2 mt-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.emergency_contact_name')}</label>
                        <Input value={md.emergencyContactName || ''} onChange={e => updateMeta('emergencyContactName', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.emergency_contact_phone')}</label>
                        <Input value={md.emergencyContactPhone || ''} onChange={e => updateMeta('emergencyContactPhone', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.relationship')}</label>
                        <Input value={md.emergencyContactRelationship || ''} onChange={e => updateMeta('emergencyContactRelationship', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
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
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.site_assigned')}</label>
                        <Input value={md.siteAssigned || ''} onChange={e => updateMeta('siteAssigned', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
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
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.vacation_days')}</label>
                        <div className="flex gap-2">
                            <Input type="number" placeholder={t('personnel.mexico_hr.vacation_total_placeholder')} value={md.vacationDaysTotal || ''} onChange={e => updateMeta('vacationDaysTotal', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
                            <Input type="number" placeholder={t('personnel.mexico_hr.vacation_rem_placeholder')} value={md.vacationDaysRemaining || ''} onChange={e => updateMeta('vacationDaysRemaining', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
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
                    
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.mexico_hr.primary_beneficiary')}</label>
                        <Input value={md.primaryBeneficiary || ''} onChange={e => updateMeta('primaryBeneficiary', e.target.value)} className="bg-white text-sm border-amber-200 focus-visible:ring-amber-500" />
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
    );
}
