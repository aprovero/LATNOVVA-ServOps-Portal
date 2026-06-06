import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Input } from '../components/ui/input';
export interface EditableNominaRow {
    id: string;
    personnelId: string;
    status: string;
    registroPatronal: string;
    empresa: string;
    altaImss: string;
    fechaIngreso: string;
    nombre: string;
    proyecto: string;
    puesto: string;
    tipoNomina: string;
    totalNominaMensual: string;
    sd: string;
    sdi: string;
    sueldoBrutoImss: string;
    nominaImss: string;
    nominaPpp: string;
    totalNominaSys: string;
    totalNominaProductividad: string;
    salarioTotalQuincenal: string;
    diasTrabajados: string;
    faltas: string;
    incapacidades: string;
    vacaciones: string;
    sueldo: string;
    aguinaldo: string;
    vacacionesPrima: string;
    ingresosVarios: string;
    viaticos: string;
    horasExtrasCarta: string;
    horasExtras: string;
    infonavit: string;
    isrFiscal: string;
    imss: string;
    descuentos: string;
    totalPercepcion: string;
    totalDeduccion: string;
    totalPerceptionsSubtotal: string;
    netoAPagar: string;
}
import { FileSpreadsheet, Download, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Nomina() {
    const { t } = useTranslation();
    const { personnel, timesheets, projects } = useStore();
    
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + 1); // Monday
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + 7); // Sunday
        return d.toISOString().split('T')[0];
    });
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [editableRows, setEditableRows] = useState<EditableNominaRow[]>([]);

    const mxPersonnel = useMemo(() => {
        return personnel.filter(p => p.subsidiary === 'MX' || (p.subsidiaryMetadata && (p.subsidiaryMetadata.curp || p.subsidiaryMetadata.rfc)));
    }, [personnel]);

    const activeProjects = useMemo(() => {
        return projects.filter(p => p.status === 'Active' || p.status === 'In Progress');
    }, [projects]);

    const selectedProjectObj = selectedProject !== 'all' ? projects.find(p => p.id === selectedProject) || null : null;
    const projectName = selectedProjectObj ? (selectedProjectObj.codeName || selectedProjectObj.name) : t('nomina.all_projects');

    const parseMoney = (val: string) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;

    const calculateRowTotals = (row: Partial<EditableNominaRow>): { totalPercepcion: string, totalDeduccion: string, totalPerceptionsSubtotal: string, netoAPagar: string } => {
        const sueldo = parseMoney(row.sueldo || '0');
        const aguinaldo = parseMoney(row.aguinaldo || '0');
        const vacacionesPrima = parseMoney(row.vacacionesPrima || '0');
        const ingresosVarios = parseMoney(row.ingresosVarios || '0');
        const viaticos = parseMoney(row.viaticos || '0');
        const horasExtrasCarta = parseMoney(row.horasExtrasCarta || '0');
        const horasExtras = parseMoney(row.horasExtras || '0');

        const infonavit = parseMoney(row.infonavit || '0');
        const isrFiscal = parseMoney(row.isrFiscal || '0');
        const imss = parseMoney(row.imss || '0');
        const descuentos = parseMoney(row.descuentos || '0');

        // TOTAL PERCEPCIÓN = SUM(SUELDO, AGUINALDO, VACACIONES, HORAS EXTRAS, etc.)
        const totalPercepcion = sueldo + aguinaldo + vacacionesPrima + ingresosVarios + viaticos + horasExtrasCarta + horasExtras;
        // TOTAL DEDUCCIÓN = SUM(INFONAVIT, ISR-FISCAL, IMSS, DESCUENTOS)
        const totalDeduccion = infonavit + isrFiscal + imss + descuentos;
        // TOTAL (Perceptions Subtotal)
        const totalPerceptionsSubtotal = totalPercepcion;
        // NETO A PAGAR = TOTAL PERCEPCIÓN - TOTAL DEDUCCIÓN
        const netoAPagar = totalPercepcion - totalDeduccion;

        return {
            totalPercepcion: `$${totalPercepcion.toFixed(2)}`,
            totalDeduccion: `$${totalDeduccion.toFixed(2)}`,
            totalPerceptionsSubtotal: `$${totalPerceptionsSubtotal.toFixed(2)}`,
            netoAPagar: `$${netoAPagar.toFixed(2)}`
        };
    };

    const generatePayroll = () => {
        const result: EditableNominaRow[] = [];
        
        mxPersonnel.forEach(p => {
            const assignedProj = projects.find(proj => proj.assignedPersonnel?.includes(p.id));
            const rowProjectName = assignedProj ? (assignedProj.codeName || assignedProj.name) : t('nomina.no_project', 'No Project');

            const pTimesheets = timesheets.filter(ts => {
                if (ts.personnelId !== p.id) return false;
                if (ts.date < startDate || ts.date > endDate) return false;
                
                // If it is a Home Office timesheet, or has no projectId, fallback to their assigned project.
                const tsProjectId = ts.projectId || (ts.type === 'Home Office' ? assignedProj?.id : undefined);
                
                if (selectedProject !== 'all' && tsProjectId !== selectedProject) return false;
                return true;
            });

            if (pTimesheets.length === 0) return;

            const totalHours = pTimesheets.reduce((acc, ts) => acc + (ts.hours || 0), 0);
            const uniqueDates = new Set(pTimesheets.map(ts => ts.date));
            const daysWorked = uniqueDates.size;

            const md = p.subsidiaryMetadata || {};

            const nominaPpp = parseFloat(md.nominaPpp || '0');
            const nominaImss = parseFloat(md.nominaImss || '0');
            const totalNominaMensual = nominaPpp + nominaImss;
            const sd = totalNominaMensual / 30;
            const sdi = parseFloat(md.sdi || '0');
            const sueldoBrutoImss = sdi * daysWorked;

            const totalNominaSys = nominaImss + nominaPpp;
            const totalNominaProductividad = parseFloat(md.bonuses || '0');
            const salarioTotalQuincenal = totalNominaSys / 2;

            const sueldo = sd * daysWorked;
            const viaticos = parseFloat(md.viaticosMonthly || '0') / 2; // Assuming bi-weekly split
            const infonavit = parseFloat(md.infonavitAmount || '0') / 2; // Assuming bi-weekly split

            const initialRow: Partial<EditableNominaRow> = {
                id: crypto.randomUUID(),
                personnelId: p.id,
                status: p.status,
                registroPatronal: md.registroPatronal || '',
                empresa: md.company || '',
                altaImss: md.imssDate || '',
                fechaIngreso: md.hireDate || p.dbo || p.onboardingDate || '',
                nombre: p.name,
                proyecto: selectedProject !== 'all' ? projectName : rowProjectName,
                puesto: p.position || '',
                tipoNomina: md.payrollType || '',
                totalNominaMensual: `$${totalNominaMensual.toFixed(2)}`,
                sd: `$${sd.toFixed(2)}`,
                sdi: `$${sdi.toFixed(2)}`,
                sueldoBrutoImss: `$${sueldoBrutoImss.toFixed(2)}`,
                nominaImss: `$${nominaImss.toFixed(2)}`,
                nominaPpp: `$${nominaPpp.toFixed(2)}`,
                totalNominaSys: `$${totalNominaSys.toFixed(2)}`,
                totalNominaProductividad: `$${totalNominaProductividad.toFixed(2)}`,
                salarioTotalQuincenal: `$${salarioTotalQuincenal.toFixed(2)}`,
                diasTrabajados: daysWorked.toString(),
                faltas: '0',
                incapacidades: '0',
                vacaciones: '0',
                sueldo: `$${sueldo.toFixed(2)}`,
                aguinaldo: '$0.00',
                vacacionesPrima: '$0.00',
                ingresosVarios: '$0.00',
                viaticos: `$${viaticos.toFixed(2)}`,
                horasExtrasCarta: '$0.00',
                horasExtras: `$${(totalHours > 48 ? (totalHours - 48) * (p.overtimeRate || (p.regularRate || 0) * 1.5) : 0).toFixed(2)}`,
                infonavit: `$${infonavit.toFixed(2)}`,
                isrFiscal: '$0.00',
                imss: '$0.00',
                descuentos: '$0.00'
            };

            const totals = calculateRowTotals(initialRow);

            result.push({
                ...initialRow,
                ...totals
            } as EditableNominaRow);
        });

        setEditableRows(result);
    };

    const updateRow = (index: number, field: keyof EditableNominaRow, value: string) => {
        const newRows = [...editableRows];
        const updatedRow = { ...newRows[index], [field]: value };
        
        // Auto-recalculate SDI or Sueldo if days worked changes
        if (field === 'diasTrabajados') {
            const days = parseFloat(value) || 0;
            const sdVal = parseMoney(updatedRow.sd);
            const sdiVal = parseMoney(updatedRow.sdi);
            updatedRow.sueldo = `$${(sdVal * days).toFixed(2)}`;
            updatedRow.sueldoBrutoImss = `$${(sdiVal * days).toFixed(2)}`;
        }

        // Recalculate totals
        const totals = calculateRowTotals(updatedRow);
        newRows[index] = { ...updatedRow, ...totals };

        setEditableRows(newRows);
    };

    const totalPercepcionSum = editableRows.reduce((acc, row) => acc + parseMoney(row.totalPercepcion), 0);
    const totalDeduccionSum = editableRows.reduce((acc, row) => acc + parseMoney(row.totalDeduccion), 0);
    const totalNetoSum = editableRows.reduce((acc, row) => acc + parseMoney(row.netoAPagar), 0);

    const exportToExcel = () => {
        if (editableRows.length === 0) return;

        const headers = [
            t('nomina.columns.status'), t('nomina.columns.registro_patronal'), t('nomina.columns.empresa'),
            t('nomina.columns.alta_imss'), t('nomina.columns.hire_date'), t('nomina.columns.name'),
            t('nomina.columns.project'), t('nomina.columns.role'), t('nomina.columns.payroll_type'),
            t('nomina.columns.total_nomina_mensual'), t('nomina.columns.sd'), t('nomina.columns.sdi'),
            t('nomina.columns.sueldo_bruto_imss'), t('nomina.columns.nomina_imss'), t('nomina.columns.nomina_ppp'),
            t('nomina.columns.total_nomina_sys'), t('nomina.columns.total_nomina_productividad'), t('nomina.columns.salario_total_quincenal'),
            t('nomina.columns.days_worked'), t('nomina.columns.faltas'), t('nomina.columns.incapacidades'),
            t('nomina.columns.vacaciones'), t('nomina.columns.sueldo'), t('nomina.columns.aguinaldo'),
            t('nomina.columns.vacaciones_prima'), t('nomina.columns.ingresos_varios'), t('nomina.columns.viaticos'),
            t('nomina.columns.horas_extras'), t('nomina.columns.infonavit'), t('nomina.columns.isr_fiscal'),
            t('nomina.columns.imss'), t('nomina.columns.descuentos'), t('nomina.columns.total_percepcion'),
            t('nomina.columns.total_deduccion'), t('nomina.columns.total_perceptions_subtotal', 'TOTAL (Perceptions Subtotal)'), t('nomina.columns.net_pay')
        ];

        let csvContent = headers.join(',') + '\n';

        editableRows.forEach((row, index) => {
            const clean = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
            
            // Excel row index is 2-based (header is row 1)
            const rIdx = index + 2;

            // Excel Formulas matching the exact column layout:
            // W: SUELDO, X: AGUINALDO, Y: VACACIONES/PRIMA, Z: INGRESOS VARIOS, AA: VIATICOS, AB: HORAS EXTRAS
            const formulaTotalPercepcion = `=SUM(W${rIdx}:AB${rIdx})`;
            // AC: INFONAVIT, AD: ISR-FISCAL, AE: IMSS, AF: DESCUENTOS
            const formulaTotalDeduccion = `=SUM(AC${rIdx}:AF${rIdx})`;
            // AG: TOTAL PERCEPCIÓN
            const formulaTotalSubtotal = `=AG${rIdx}`;
            // AJ: NETO A PAGAR = TOTAL PERCEPCIÓN (AG) - TOTAL DEDUCCIÓN (AH)
            const formulaNetoAPagar = `=AG${rIdx}-AH${rIdx}`;

            const rowData = [
                row.status, row.registroPatronal, row.empresa, row.altaImss, row.fechaIngreso, row.nombre,
                row.proyecto, row.puesto, row.tipoNomina, row.totalNominaMensual, row.sd, row.sdi,
                row.sueldoBrutoImss, row.nominaImss, row.nominaPpp, row.totalNominaSys, row.totalNominaProductividad, row.salarioTotalQuincenal,
                row.diasTrabajados, row.faltas, row.incapacidades, row.vacaciones, row.sueldo, row.aguinaldo,
                row.vacacionesPrima, row.ingresosVarios, row.viaticos, row.horasExtras, row.infonavit, row.isrFiscal,
                row.imss, row.descuentos, formulaTotalPercepcion, formulaTotalDeduccion, formulaTotalSubtotal, formulaNetoAPagar
            ].map(clean);
            
            csvContent += rowData.join(',') + '\n';
        });

        csvContent += '\n';
        csvContent += `"${t('nomina.total_general')}",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,"${totalPercepcionSum.toFixed(2)}","${totalDeduccionSum.toFixed(2)}",,"${totalNetoSum.toFixed(2)}"\n`;

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Nomina_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const CellInput = ({ value, onChange, className = "" }: { value: string, onChange: (v: string) => void, className?: string }) => (
        <input 
            type="text" 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className={`w-full bg-transparent border border-transparent hover:border-gray-300 focus:bg-white focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 rounded-md px-2 py-1 text-xs outline-none transition-all ${className}`}
        />
    );

    return (
        <div className="space-y-6 animate-fade-in w-full max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-accent-greyDark flex items-center gap-3">
                        <div className="p-2.5 bg-brand-teal/10 rounded-xl text-brand-teal">
                            <FileSpreadsheet size={24} />
                        </div>
                        {t('nomina.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('nomina.subtitle')}
                    </p>
                </div>
                
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col gap-1 px-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t('nomina.from')}</label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs border-0 bg-gray-50 rounded-lg w-32" />
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="flex flex-col gap-1 px-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t('nomina.to')}</label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs border-0 bg-gray-50 rounded-lg w-32" />
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="flex flex-col gap-1 px-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t('nomina.project')}</label>
                        <select 
                            value={selectedProject} 
                            onChange={e => setSelectedProject(e.target.value)}
                            className="h-8 text-xs border-0 bg-gray-50 rounded-lg outline-none px-2 w-40 focus:ring-2 focus:ring-brand-teal"
                        >
                            <option value="all">{t('nomina.all_projects')}</option>
                            {activeProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.codeName || p.name}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={generatePayroll}
                        className="ml-2 h-10 px-4 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-md shadow-gray-900/20 hover:bg-gray-800 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={16} />
                        {t('nomina.generate')}
                    </button>

                    <button 
                        onClick={exportToExcel}
                        disabled={editableRows.length === 0}
                        className="h-10 px-4 bg-brand-teal text-white rounded-xl text-sm font-bold shadow-md shadow-brand-teal/20 hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <Download size={16} />
                        Excel (CSV)
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-220px)] relative">
                {editableRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                        <FileSpreadsheet size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">{t('nomina.empty_state')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse min-w-[2000px]">
                            <thead className="bg-[#0f766e] text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{t('nomina.columns.status')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.registro_patronal')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.empresa')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.alta_imss')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.hire_date')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.name')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.project')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.role')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.payroll_type')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.total_nomina_mensual')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.sd')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.sdi')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.sueldo_bruto_imss')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.nomina_imss')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.nomina_ppp')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.total_nomina_sys')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.total_nomina_productividad')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.salario_total_quincenal')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.days_worked')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.faltas')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.incapacidades')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.vacaciones')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">{t('nomina.columns.sueldo')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">{t('nomina.columns.aguinaldo')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">{t('nomina.columns.vacaciones_prima')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">{t('nomina.columns.ingresos_varios')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">{t('nomina.columns.viaticos')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">{t('nomina.columns.horas_extras')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">{t('nomina.columns.infonavit')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">{t('nomina.columns.isr_fiscal')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">{t('nomina.columns.imss')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">{t('nomina.columns.descuentos')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-brand-teal/30">{t('nomina.columns.total_percepcion')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-950/20">{t('nomina.columns.total_deduccion')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-brand-teal/40">{t('nomina.columns.net_pay')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {editableRows.map((row, i) => (
                                    <tr key={row.id} className="hover:bg-teal-50/10 transition-colors focus-within:bg-teal-50/30">
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.status} onChange={(v: string) => updateRow(i, 'status', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.registroPatronal} onChange={(v: string) => updateRow(i, 'registroPatronal', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.empresa} onChange={(v: string) => updateRow(i, 'empresa', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.altaImss} onChange={(v: string) => updateRow(i, 'altaImss', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.fechaIngreso} onChange={(v: string) => updateRow(i, 'fechaIngreso', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.nombre} onChange={(v: string) => updateRow(i, 'nombre', v)} className="font-bold text-accent-greyDark" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.proyecto} onChange={(v: string) => updateRow(i, 'proyecto', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.puesto} onChange={(v: string) => updateRow(i, 'puesto', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.tipoNomina} onChange={(v: string) => updateRow(i, 'tipoNomina', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.totalNominaMensual} onChange={(v: string) => updateRow(i, 'totalNominaMensual', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.sd} onChange={(v: string) => updateRow(i, 'sd', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.sdi} onChange={(v: string) => updateRow(i, 'sdi', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.sueldoBrutoImss} onChange={(v: string) => updateRow(i, 'sueldoBrutoImss', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.nominaImss} onChange={(v: string) => updateRow(i, 'nominaImss', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.nominaPpp} onChange={(v: string) => updateRow(i, 'nominaPpp', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.totalNominaSys} onChange={(v: string) => updateRow(i, 'totalNominaSys', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.totalNominaProductividad} onChange={(v: string) => updateRow(i, 'totalNominaProductividad', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.salarioTotalQuincenal} onChange={(v: string) => updateRow(i, 'salarioTotalQuincenal', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-teal-50/10 w-20">
                                            <CellInput value={row.diasTrabajados} onChange={(v: string) => updateRow(i, 'diasTrabajados', v)} className="text-center font-bold" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 w-20">
                                            <CellInput value={row.faltas} onChange={(v: string) => updateRow(i, 'faltas', v)} className="text-center" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 w-20">
                                            <CellInput value={row.incapacidades} onChange={(v: string) => updateRow(i, 'incapacidades', v)} className="text-center" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 w-20">
                                            <CellInput value={row.vacaciones} onChange={(v: string) => updateRow(i, 'vacaciones', v)} className="text-center" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10">
                                            <CellInput value={row.sueldo} onChange={(v: string) => updateRow(i, 'sueldo', v)} className="font-bold" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10">
                                            <CellInput value={row.aguinaldo} onChange={(v: string) => updateRow(i, 'aguinaldo', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10">
                                            <CellInput value={row.vacacionesPrima} onChange={(v: string) => updateRow(i, 'vacacionesPrima', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10">
                                            <CellInput value={row.ingresosVarios} onChange={(v: string) => updateRow(i, 'ingresosVarios', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10">
                                            <CellInput value={row.viaticos} onChange={(v: string) => updateRow(i, 'viaticos', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10">
                                            <CellInput value={row.horasExtras} onChange={(v: string) => updateRow(i, 'horasExtras', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10">
                                            <CellInput value={row.infonavit} onChange={(v: string) => updateRow(i, 'infonavit', v)} className="text-red-500 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10">
                                            <CellInput value={row.isrFiscal} onChange={(v: string) => updateRow(i, 'isrFiscal', v)} className="text-red-500 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10">
                                            <CellInput value={row.imss} onChange={(v: string) => updateRow(i, 'imss', v)} className="text-red-500 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10">
                                            <CellInput value={row.descuentos} onChange={(v: string) => updateRow(i, 'descuentos', v)} className="text-red-500 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-brand-teal/20 bg-brand-teal/5">
                                            <CellInput value={row.totalPercepcion} onChange={(v: string) => updateRow(i, 'totalPercepcion', v)} className="font-black text-brand-teal text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-red-900/20 bg-red-950/5">
                                            <CellInput value={row.totalDeduccion} onChange={(v: string) => updateRow(i, 'totalDeduccion', v)} className="font-black text-red-700 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-brand-teal/20 bg-brand-teal/10">
                                            <CellInput value={row.netoAPagar} onChange={(v: string) => updateRow(i, 'netoAPagar', v)} className="font-black text-brand-teal text-right" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 sticky bottom-0 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={32} className="px-4 py-3 text-xs font-black text-right text-gray-500">{t('nomina.total_general')}</td>
                                    <td className="px-4 py-3 text-sm font-black text-brand-teal border-l border-gray-200 bg-white text-right">
                                        ${totalPercepcionSum.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-black text-red-700 border-l border-gray-200 bg-white text-right">
                                        ${totalDeduccionSum.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-black text-brand-teal text-right border-l border-gray-200 bg-white shadow-inner">
                                        ${totalNetoSum.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
