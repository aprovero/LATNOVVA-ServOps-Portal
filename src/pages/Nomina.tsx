import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Input } from '../components/ui/input';
export interface EditableNominaRow {
    id: string; personnelId: string; name: string; status: string;
    nss: string; curp: string; rfc: string; hireDate: string;
    project: string; role: string; payrollType: string;
    dailyRate: string; monthlyRate: string; daysWorked: string;
    normalHours: string; overtimeHours: string; grossPay: string;
    isr: string; imss: string; infonavit: string;
    aguinaldo: string; sueldoNeto: string;
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

    const generatePayroll = () => {
        const result: EditableNominaRow[] = [];
        
        mxPersonnel.forEach(p => {
            const pTimesheets = timesheets.filter(ts => {
                if (ts.personnelId !== p.id) return false;
                if (ts.date < startDate || ts.date > endDate) return false;
                if (selectedProject !== 'all' && ts.projectId !== selectedProject) return false;
                return true;
            });

            if (pTimesheets.length === 0) return;

            const totalHours = pTimesheets.reduce((acc, ts) => acc + (ts.hours || 0), 0);
            const uniqueDates = new Set(pTimesheets.map(ts => ts.date));
            const daysWorked = uniqueDates.size;

            const normalHours = Math.min(totalHours, 48);
            const overtimeHours = Math.max(totalHours - 48, 0);

            // Format to 1 decimal place max (drops trailing zeros)
            const fmtHours = (h: number) => Number(h.toFixed(1)).toString();

            const regRate = p.regularRate || 0;
            const otRate = p.overtimeRate || (regRate * 1.5);

            const grossPay = (normalHours * regRate) + (overtimeHours * otRate);

            const md = p.subsidiaryMetadata || {};
            const dailyRate = p.regularRate ? (p.regularRate * 8).toFixed(2) : '0.00';
            const monthlyRate = p.regularRate ? (p.regularRate * 8 * 30).toFixed(2) : '0.00';

            result.push({
                id: crypto.randomUUID(),
                personnelId: p.id,
                name: p.name,
                status: p.status,
                nss: p.employeeNumber || 'NA',
                curp: md.curp || '',
                rfc: md.rfc || '',
                hireDate: md.hireDate || p.dbo || '',
                project: projectName,
                role: p.position || '',
                payrollType: md.payrollType || '',
                dailyRate: `$${dailyRate}`,
                monthlyRate: `$${monthlyRate}`,
                daysWorked: daysWorked.toString(),
                normalHours: fmtHours(normalHours),
                overtimeHours: fmtHours(overtimeHours),
                grossPay: `$${grossPay.toFixed(2)}`,
                isr: '$0.00',
                imss: '$0.00',
                infonavit: '$0.00',
                aguinaldo: '$0.00',
                sueldoNeto: `$${grossPay.toFixed(2)}`
            });
        });

        setEditableRows(result);
    };

    const updateRow = (index: number, field: keyof EditableNominaRow, value: string) => {
        const newRows = [...editableRows];
        newRows[index] = { ...newRows[index], [field]: value };
        
        // Auto-recalculate Net Pay if related fields are modified
        if (['grossPay', 'isr', 'imss', 'infonavit', 'aguinaldo'].includes(field)) {
            const parseMoney = (val: string) => parseFloat(val.replace(/[^0-9.-]+/g, "")) || 0;
            const gross = parseMoney(newRows[index].grossPay);
            const isr = parseMoney(newRows[index].isr);
            const imss = parseMoney(newRows[index].imss);
            const info = parseMoney(newRows[index].infonavit);
            const agui = parseMoney(newRows[index].aguinaldo);
            
            const net = gross - isr - imss - info + agui;
            newRows[index].sueldoNeto = `$${net.toFixed(2)}`;
        }

        setEditableRows(newRows);
    };

    const totalGross = editableRows.reduce((acc, row) => acc + (parseFloat(row.grossPay.replace(/[^0-9.-]+/g, "")) || 0), 0);
    const totalNet = editableRows.reduce((acc, row) => acc + (parseFloat(row.sueldoNeto.replace(/[^0-9.-]+/g, "")) || 0), 0);

    const exportToExcel = () => {
        if (editableRows.length === 0) return;

        const headers = [
            t('nomina.columns.status'), t('nomina.columns.nss'), t('nomina.columns.hire_date'),
            t('nomina.columns.name'), t('nomina.columns.project'), t('nomina.columns.role'),
            t('nomina.columns.payroll_type'), t('nomina.columns.days_worked'), t('nomina.columns.normal_hours'),
            t('nomina.columns.overtime_hours'), t('nomina.columns.gross_pay'), t('nomina.columns.isr'),
            t('nomina.columns.imss'), t('nomina.columns.infonavit'), t('nomina.columns.aguinaldo'),
            t('nomina.columns.net_pay')
        ];

        let csvContent = headers.join(',') + '\n';

        editableRows.forEach(row => {
            const clean = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
            const rowData = [
                row.status, row.nss, row.hireDate, row.name, row.project, row.role,
                row.payrollType, row.daysWorked, row.normalHours, row.overtimeHours,
                row.grossPay, row.isr, row.imss, row.infonavit, row.aguinaldo, row.sueldoNeto
            ].map(clean);
            
            csvContent += rowData.join(',') + '\n';
        });

        csvContent += '\n';
        csvContent += `"${t('nomina.total_general')}",,,,,,,,,,,"${t('nomina.bruto')} $${totalGross.toFixed(2)}","${t('nomina.neto')} $${totalNet.toFixed(2)}"\n`;

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
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.nss')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.hire_date')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.name')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.project')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.role')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.payroll_type')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.days_worked')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.normal_hours')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">{t('nomina.columns.overtime_hours')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-[#005c56]">{t('nomina.columns.gross_pay')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-900/40">{t('nomina.columns.isr')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-900/40">{t('nomina.columns.imss')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-900/40">{t('nomina.columns.infonavit')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-900/40">{t('nomina.columns.aguinaldo')}</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-[#0f766e]">{t('nomina.columns.net_pay')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {editableRows.map((row, i) => (
                                    <tr key={row.id} className="hover:bg-teal-50/10 transition-colors focus-within:bg-teal-50/30">
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.status} onChange={(v: string) => updateRow(i, 'status', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.nss} onChange={(v: string) => updateRow(i, 'nss', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.hireDate} onChange={(v: string) => updateRow(i, 'hireDate', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.name} onChange={(v: string) => updateRow(i, 'name', v)} className="font-bold text-accent-greyDark" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.project} onChange={(v: string) => updateRow(i, 'project', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.role} onChange={(v: string) => updateRow(i, 'role', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100">
                                            <CellInput value={row.payrollType} onChange={(v: string) => updateRow(i, 'payrollType', v)} />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-teal-50/10 w-20">
                                            <CellInput value={row.daysWorked} onChange={(v: string) => updateRow(i, 'daysWorked', v)} className="text-center font-bold" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-teal-50/10 w-20">
                                            <CellInput value={row.normalHours} onChange={(v: string) => updateRow(i, 'normalHours', v)} className="text-center font-bold" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-teal-50/10 w-20">
                                            <CellInput value={row.overtimeHours} onChange={(v: string) => updateRow(i, 'overtimeHours', v)} className="text-center font-bold text-orange-600" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-teal-50/30">
                                            <CellInput value={row.grossPay} onChange={(v: string) => updateRow(i, 'grossPay', v)} className="font-black text-brand-teal" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/20">
                                            <CellInput value={row.isr} onChange={(v: string) => updateRow(i, 'isr', v)} className="text-red-500 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/20">
                                            <CellInput value={row.imss} onChange={(v: string) => updateRow(i, 'imss', v)} className="text-red-500 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/20">
                                            <CellInput value={row.infonavit} onChange={(v: string) => updateRow(i, 'infonavit', v)} className="text-red-500 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/20">
                                            <CellInput value={row.aguinaldo} onChange={(v: string) => updateRow(i, 'aguinaldo', v)} className="text-green-600 text-right" />
                                        </td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-teal-50/40">
                                            <CellInput value={row.sueldoNeto} onChange={(v: string) => updateRow(i, 'sueldoNeto', v)} className="font-black text-brand-teal text-right" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 sticky bottom-0 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={10} className="px-4 py-3 text-xs font-black text-right text-gray-500">{t('nomina.total_general')}</td>
                                    <td className="px-4 py-3 text-sm font-black text-brand-teal border-l border-gray-200 bg-white">
                                        ${totalGross.toFixed(2)}
                                    </td>
                                    <td colSpan={4} className="border-l border-gray-200 bg-white"></td>
                                    <td className="px-4 py-3 text-sm font-black text-brand-teal text-right border-l border-gray-200 bg-white shadow-inner">
                                        ${totalNet.toFixed(2)}
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
