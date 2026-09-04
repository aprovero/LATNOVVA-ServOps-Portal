import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Input } from '../components/ui/input';
import { calculateDailyAttendance } from '../utils/attendanceCalculations';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Download, RefreshCw, ChevronDown, Users, Search, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    diasLabNomina: string;
    faltas: string;
    incapacidades: string;
    vacaciones: string;
    sueldo: string;
    aguinaldo: string;
    vacacionesPrima: string;
    bonoPuntualidad: string;
    bonoAsistencia: string;
    retroactivo: string;
    incapacidadPagadaEmpresa: string;
    ingresosVarios: string;
    viaticos: string;
    horasExtrasCarta: string;
    horasExtras: string;
    totalIngresosExtras: string;
    infonavit: string;
    isrFiscal: string;
    imss: string;
    descuentos: string;
    totalPercepcion: string;
    totalDeduccion: string;
    totalPerceptionsSubtotal: string;
    netoAPagar: string;
}

export default function Nomina() {
    const { t } = useTranslation();
    const { personnel, timesheets, projects, attendanceOverrides, workSchedules, fetchTimesheetsForRange } = useStore();
    
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

    // Filtering modes: 'projects' or 'manual' (Sin Proyecto / Selección Manual)
    const [filterMode, setFilterMode] = useState<'projects' | 'manual'>('projects');
    const [selectedProjects, setSelectedProjects] = useState<string[]>(['all']);
    const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
    const [editableRows, setEditableRows] = useState<EditableNominaRow[]>([]);

    // Dropdown open states
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [isPersonnelDropdownOpen, setIsPersonnelDropdownOpen] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const [personnelSearch, setPersonnelSearch] = useState('');

    const projectDropdownRef = useRef<HTMLDivElement>(null);
    const personnelDropdownRef = useRef<HTMLDivElement>(null);

    // Close popovers on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
                setIsProjectDropdownOpen(false);
            }
            if (personnelDropdownRef.current && !personnelDropdownRef.current.contains(e.target as Node)) {
                setIsPersonnelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (startDate || endDate) {
            fetchTimesheetsForRange(startDate, endDate).catch(e => console.error('[Nomina] Range fetch failed:', e));
        }
    }, [startDate, endDate, fetchTimesheetsForRange]);

    const mxPersonnel = useMemo(() => {
        return personnel.filter(p => p.subsidiary === 'MX' || (p.subsidiaryMetadata && (p.subsidiaryMetadata.curp || p.subsidiaryMetadata.rfc)));
    }, [personnel]);

    // Initialize selected personnel with all active MX personnel by default
    useEffect(() => {
        if (selectedPersonnelIds.length === 0 && mxPersonnel.length > 0) {
            setSelectedPersonnelIds(mxPersonnel.map(p => p.id));
        }
    }, [mxPersonnel, selectedPersonnelIds.length]);

    const activeProjects = useMemo(() => {
        return projects.filter(p => {
            const isMx = p.subsidiary === 'MX';
            const isActive = p.status === 'Active' || p.status === 'In Progress' || (p.status as string) === 'En proceso';
            return isMx && isActive;
        });
    }, [projects]);

    const parseMoney = (val: string | number) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;

    const calculateRowTotals = (row: Partial<EditableNominaRow>) => {
        const sueldo = parseMoney(row.sueldo || '0');
        const aguinaldo = parseMoney(row.aguinaldo || '0');
        const vacacionesPrima = parseMoney(row.vacacionesPrima || '0');
        const bonoPuntualidad = parseMoney(row.bonoPuntualidad || '0');
        const bonoAsistencia = parseMoney(row.bonoAsistencia || '0');
        const retroactivo = parseMoney(row.retroactivo || '0');
        const incapacidadPagadaEmpresa = parseMoney(row.incapacidadPagadaEmpresa || '0');

        const ingresosVarios = parseMoney(row.ingresosVarios || '0');
        const viaticos = parseMoney(row.viaticos || '0');
        const horasExtrasCarta = parseMoney(row.horasExtrasCarta || '0');
        const horasExtras = parseMoney(row.horasExtras || '0');
        const totalIngresosExtras = ingresosVarios + viaticos + horasExtrasCarta + horasExtras;

        const infonavit = parseMoney(row.infonavit || '0');
        const isrFiscal = parseMoney(row.isrFiscal || '0');
        const imss = parseMoney(row.imss || '0');
        const descuentos = parseMoney(row.descuentos || '0');

        // TOTAL PERCEPCIÓN
        const totalPercepcion = sueldo + aguinaldo + vacacionesPrima + bonoPuntualidad + bonoAsistencia + retroactivo + incapacidadPagadaEmpresa;
        // TOTAL DEDUCCIÓN
        const totalDeduccion = infonavit + isrFiscal + imss + descuentos;
        // NETO A PAGAR
        const netoAPagar = totalPercepcion - totalDeduccion;
        // TOTAL NOMINA SYS
        const totalNominaSys = netoAPagar;
        // SALARIO TOTAL QUINCENAL
        const totalNominaMensual = parseMoney(row.totalNominaMensual || '0');
        const salarioTotalQuincenal = parseMoney(row.salarioTotalQuincenal || `${(totalNominaMensual / 2).toFixed(2)}`);
        // TOTAL NOMINA PRODUCTIVIDAD
        const totalNominaProductividad = Math.max(0, salarioTotalQuincenal - totalNominaSys);

        return {
            totalIngresosExtras: totalIngresosExtras > 0 ? `$${totalIngresosExtras.toFixed(2)}` : '$0.00',
            totalPercepcion: `$${totalPercepcion.toFixed(2)}`,
            totalDeduccion: `$${totalDeduccion.toFixed(2)}`,
            totalPerceptionsSubtotal: `$${totalPercepcion.toFixed(2)}`,
            netoAPagar: `$${netoAPagar.toFixed(2)}`,
            totalNominaSys: `$${totalNominaSys.toFixed(2)}`,
            totalNominaProductividad: `$${totalNominaProductividad.toFixed(2)}`,
            salarioTotalQuincenal: `$${salarioTotalQuincenal.toFixed(2)}`
        };
    };

    const toggleProject = (projectId: string) => {
        if (projectId === 'all') {
            if (selectedProjects.includes('all')) {
                setSelectedProjects([]);
            } else {
                setSelectedProjects(['all']);
            }
            return;
        }

        let next = selectedProjects.filter(id => id !== 'all');
        if (next.includes(projectId)) {
            next = next.filter(id => id !== projectId);
        } else {
            next.push(projectId);
        }

        if (next.length === activeProjects.length || next.length === 0) {
            setSelectedProjects(['all']);
        } else {
            setSelectedProjects(next);
        }
    };

    const togglePersonnel = (pId: string) => {
        if (pId === 'all') {
            if (selectedPersonnelIds.length === mxPersonnel.length) {
                setSelectedPersonnelIds([]);
            } else {
                setSelectedPersonnelIds(mxPersonnel.map(p => p.id));
            }
            return;
        }

        if (selectedPersonnelIds.includes(pId)) {
            setSelectedPersonnelIds(selectedPersonnelIds.filter(id => id !== pId));
        } else {
            setSelectedPersonnelIds([...selectedPersonnelIds, pId]);
        }
    };

    const generatePayroll = () => {
        const result: EditableNominaRow[] = [];
        
        mxPersonnel.forEach(p => {
            // If in manual mode, skip anyone not checked
            if (filterMode === 'manual' && !selectedPersonnelIds.includes(p.id)) {
                return;
            }

            const assignedProj = projects.find(proj => proj.assignedPersonnel?.includes(p.id));
            const rowProjectName = assignedProj ? (assignedProj.codeName || assignedProj.name) : t('nomina.no_project', 'Sin Proyecto');

            const pTimesheets = timesheets.filter(ts => {
                if (ts.personnelId !== p.id) return false;
                if (ts.date < startDate || ts.date > endDate) return false;
                
                if (filterMode === 'projects') {
                    const isAll = selectedProjects.includes('all') || selectedProjects.length === 0;
                    if (isAll) return true;
                    const tsProjectId = ts.projectId || (ts.type === 'Home Office' ? assignedProj?.id : undefined);
                    return tsProjectId && selectedProjects.includes(tsProjectId);
                }
                
                return true;
            });

            // In project mode, if they had no timesheets in the selected projects/dates, skip
            if (filterMode === 'projects' && pTimesheets.length === 0) {
                return;
            }

            const uniqueDates = new Set(pTimesheets.map(ts => ts.date));
            const daysWorked = uniqueDates.size > 0 ? uniqueDates.size : (filterMode === 'manual' ? 15 : 0);

            let totalOvertimeHours = 0;
            pTimesheets.forEach(ts => {
                const dv = calculateDailyAttendance(p, ts.date, timesheets, attendanceOverrides, workSchedules);
                totalOvertimeHours += dv.overtimeHours || 0;
            });

            const md = p.subsidiaryMetadata || {};

            const nominaPpp = parseFloat(md.nominaPpp || '0');
            const nominaImss = parseFloat(md.nominaImss || '0');
            const totalNominaMensual = nominaPpp + nominaImss;
            const sd = totalNominaMensual > 0 ? (totalNominaMensual / 30) : 0;
            const sdi = parseFloat(md.sdi || '0');
            const sueldoBrutoImss = sdi * daysWorked;

            const sueldo = sd * daysWorked;
            const viaticos = parseFloat(md.viaticosMonthly || '0') / 2;
            const infonavit = parseFloat(md.infonavitAmount || '0') / 2;

            const initialRow: Partial<EditableNominaRow> = {
                id: crypto.randomUUID(),
                personnelId: p.id,
                status: p.status || 'ACTIVO',
                registroPatronal: md.registroPatronal || '',
                empresa: md.company || 'SYS',
                altaImss: md.imssDate || '',
                fechaIngreso: md.hireDate || p.dbo || p.onboardingDate || '',
                nombre: p.name,
                proyecto: rowProjectName,
                puesto: p.position || '',
                tipoNomina: md.payrollType || 'QUINCENAL',
                totalNominaMensual: `$${totalNominaMensual.toFixed(2)}`,
                sd: `$${sd.toFixed(2)}`,
                sdi: `$${sdi.toFixed(2)}`,
                sueldoBrutoImss: `$${sueldoBrutoImss.toFixed(2)}`,
                nominaImss: `$${nominaImss.toFixed(2)}`,
                nominaPpp: `$${nominaPpp.toFixed(2)}`,
                diasTrabajados: daysWorked.toString(),
                diasLabNomina: daysWorked.toString(),
                faltas: '0',
                incapacidades: '0',
                vacaciones: '0',
                sueldo: `$${sueldo.toFixed(2)}`,
                aguinaldo: '$0.00',
                vacacionesPrima: '$0.00',
                bonoPuntualidad: '$0.00',
                bonoAsistencia: '$0.00',
                retroactivo: '$0.00',
                incapacidadPagadaEmpresa: '$0.00',
                ingresosVarios: '$0.00',
                viaticos: `$${viaticos.toFixed(2)}`,
                horasExtrasCarta: '$0.00',
                horasExtras: `$${(totalOvertimeHours * (p.overtimeRate || (p.regularRate || 0) * 1.5)).toFixed(2)}`,
                infonavit: `$${infonavit.toFixed(2)}`,
                isrFiscal: '$0.00',
                imss: '$0.00',
                descuentos: '$0.00',
                salarioTotalQuincenal: `$${(totalNominaMensual / 2).toFixed(2)}`
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
        if (field === 'diasTrabajados' || field === 'diasLabNomina') {
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

    const exportToExcel = async () => {
        if (editableRows.length === 0) return;

        const CURRENCY_FMT = '_-"$"* #,##0.00_-;\\-"$"* #,##0.00_-;_-"$"* "-"??_-;_-@_-';

        const toExcelDate = (val: string | number) => {
            if (!val) return '';
            if (typeof val === 'number') return val;
            if (/^\d{4}-\d{2}-\d{2}/.test(String(val))) {
                const d = new Date(String(val) + 'T00:00:00');
                const excelEpoch = new Date(1899, 11, 30).getTime();
                const diffDays = Math.round((d.getTime() - excelEpoch) / 86400000);
                return diffDays > 0 ? diffDays : val;
            }
            const num = Number(val);
            if (!isNaN(num) && num > 30000 && num < 60000) return num;
            return val;
        };

        const populateSheetRows = (ws: any) => {
            editableRows.forEach((row, i) => {
                const r = 5 + i;
                ws['B' + r] = { t: 's', v: row.status || 'ACTIVO' };
                ws['C' + r] = { t: 's', v: row.registroPatronal || '' };
                ws['D' + r] = { t: 's', v: row.empresa || 'SYS' };

                const altaVal = toExcelDate(row.altaImss);
                ws['E' + r] = typeof altaVal === 'number' ? { t: 'n', v: altaVal } : { t: 's', v: String(altaVal || '') };
                const ingresoVal = toExcelDate(row.fechaIngreso);
                ws['F' + r] = typeof ingresoVal === 'number' ? { t: 'n', v: ingresoVal } : { t: 's', v: String(ingresoVal || '') };

                ws['G' + r] = { t: 's', v: row.nombre || '' };
                ws['H' + r] = { t: 's', v: row.proyecto || '' };
                ws['I' + r] = { t: 's', v: row.puesto || '' };
                ws['J' + r] = { t: 's', v: row.tipoNomina || 'QUINCENAL' };

                ws['K' + r] = { t: 'n', v: parseMoney(row.nominaImss), z: CURRENCY_FMT };
                ws['L' + r] = { t: 'n', v: parseMoney(row.nominaPpp), z: CURRENCY_FMT };
                ws['M' + r] = { t: 'n', v: parseMoney(row.totalNominaMensual), z: CURRENCY_FMT };

                if (row.vacaciones && parseMoney(row.vacaciones) > 0) ws['N' + r] = { t: 'n', v: parseMoney(row.vacaciones), z: CURRENCY_FMT };
                ws['O' + r] = { t: 'n', v: parseFloat(row.faltas) || 0 };
                if (row.incapacidades && parseMoney(row.incapacidades) > 0) ws['P' + r] = { t: 'n', v: parseMoney(row.incapacidades), z: CURRENCY_FMT };
                ws['Q' + r] = { t: 'n', v: parseFloat(row.diasTrabajados) || 0 };

                if (row.ingresosVarios && parseMoney(row.ingresosVarios) > 0) ws['R' + r] = { t: 'n', v: parseMoney(row.ingresosVarios), z: CURRENCY_FMT };
                if (row.viaticos && parseMoney(row.viaticos) > 0) ws['S' + r] = { t: 'n', v: parseMoney(row.viaticos), z: CURRENCY_FMT };
                if (row.horasExtrasCarta && parseMoney(row.horasExtrasCarta) > 0) ws['T' + r] = { t: 'n', v: parseMoney(row.horasExtrasCarta), z: CURRENCY_FMT };
                if (row.horasExtras && parseMoney(row.horasExtras) > 0) ws['U' + r] = { t: 'n', v: parseMoney(row.horasExtras), z: CURRENCY_FMT };
                if (row.totalIngresosExtras && parseMoney(row.totalIngresosExtras) > 0) ws['V' + r] = { t: 'n', v: parseMoney(row.totalIngresosExtras), z: CURRENCY_FMT };

                ws['W' + r] = { t: 'n', v: parseMoney(row.sueldoBrutoImss), z: CURRENCY_FMT };
                ws['X' + r] = { t: 'n', v: parseMoney(row.sd), z: CURRENCY_FMT };
                ws['Y' + r] = { t: 'n', v: parseMoney(row.sdi), z: CURRENCY_FMT };
                ws['Z' + r] = { t: 'n', v: parseFloat(row.diasTrabajados) || 0 };
                ws['AA' + r] = { t: 'n', v: parseFloat(row.diasLabNomina || row.diasTrabajados) || 0 };
                ws['AB' + r] = { t: 'n', v: parseMoney(row.sueldo), z: CURRENCY_FMT };
                ws['AC' + r] = { t: 'n', v: parseMoney(row.aguinaldo), z: CURRENCY_FMT };

                if (row.vacacionesPrima && parseMoney(row.vacacionesPrima) > 0) ws['AD' + r] = { t: 'n', v: parseMoney(row.vacacionesPrima), z: CURRENCY_FMT };
                if (row.bonoPuntualidad && parseMoney(row.bonoPuntualidad) > 0) ws['AE' + r] = { t: 'n', v: parseMoney(row.bonoPuntualidad), z: CURRENCY_FMT };
                if (row.bonoAsistencia && parseMoney(row.bonoAsistencia) > 0) ws['AF' + r] = { t: 'n', v: parseMoney(row.bonoAsistencia), z: CURRENCY_FMT };
                if (row.retroactivo && parseMoney(row.retroactivo) > 0) ws['AG' + r] = { t: 'n', v: parseMoney(row.retroactivo), z: CURRENCY_FMT };
                if (row.incapacidadPagadaEmpresa && parseMoney(row.incapacidadPagadaEmpresa) > 0) ws['AH' + r] = { t: 'n', v: parseMoney(row.incapacidadPagadaEmpresa), z: CURRENCY_FMT };

                ws['AI' + r] = { t: 'n', v: parseMoney(row.totalPercepcion), z: CURRENCY_FMT };

                if (row.infonavit && parseMoney(row.infonavit) > 0) ws['AJ' + r] = { t: 'n', v: parseMoney(row.infonavit), z: CURRENCY_FMT };
                if (row.isrFiscal && parseMoney(row.isrFiscal) > 0) ws['AK' + r] = { t: 'n', v: parseMoney(row.isrFiscal), z: CURRENCY_FMT };
                if (row.imss && parseMoney(row.imss) > 0) ws['AL' + r] = { t: 'n', v: parseMoney(row.imss), z: CURRENCY_FMT };

                ws['AM' + r] = { t: 'n', v: parseMoney(row.totalDeduccion), z: CURRENCY_FMT };
                ws['AN' + r] = { t: 'n', v: parseMoney(row.netoAPagar), z: CURRENCY_FMT };
                if (row.descuentos && parseMoney(row.descuentos) > 0) ws['AO' + r] = { t: 'n', v: parseMoney(row.descuentos), z: CURRENCY_FMT };

                // Exact formulas from EST-LNV-000 CDMX 2Q Marzo 2026.xlsx
                ws['AP' + r] = { t: 'n', v: parseMoney(row.totalNominaSys), f: 'AN' + r, z: CURRENCY_FMT };

                const pppVal = (parseMoney(row.nominaPpp) / 30) * (parseFloat(row.diasTrabajados) || 0)
                    + parseMoney(row.ingresosVarios) + parseMoney(row.viaticos) + parseMoney(row.totalIngresosExtras)
                    - parseMoney(row.descuentos) - parseMoney(row.infonavit);
                ws['AQ' + r] = {
                    t: 'n',
                    v: pppVal,
                    f: '(L' + r + '/30)*Q' + r + '+R' + r + '+S' + r + '+V' + r + '-AO' + r + '-AJ' + r,
                    z: CURRENCY_FMT
                };

                ws['AR' + r] = {
                    t: 'n',
                    v: parseMoney(row.totalNominaProductividad),
                    f: '(K' + r + '/30)*Q' + r + '-AP' + r + '+AQ' + r,
                    z: CURRENCY_FMT
                };

                ws['AS' + r] = {
                    t: 'n',
                    v: parseMoney(row.salarioTotalQuincenal),
                    f: 'AP' + r + '+AR' + r,
                    z: CURRENCY_FMT
                };
            });

            const lastDataRow = 4 + editableRows.length;
            const totalRowIdx = lastDataRow + 1;
            ws['AR' + totalRowIdx] = { t: 's', v: 'TOTAL' };
            ws['AS' + totalRowIdx] = {
                t: 'n',
                v: editableRows.reduce((acc, row) => acc + parseMoney(row.salarioTotalQuincenal), 0),
                f: 'SUM(AS5:AS' + lastDataRow + ')',
                z: CURRENCY_FMT
            };

            ws['!ref'] = 'B1:AT' + totalRowIdx;
        };

        try {
            // Intentar cargar la plantilla oficial exacta con sus colores corporativos, estilos y encabezados
            const resp = await fetch('/templates/nomina_template.xlsx');
            if (!resp.ok) throw new Error(`Template status: ${resp.status}`);
            const buf = await resp.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
            const ws = wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];

            // Limpiar filas de datos anteriores
            const oldRef = XLSX.utils.decode_range(ws['!ref'] || 'B1:AT16');
            for (let R = 4; R <= oldRef.e.r; ++R) {
                for (let C = oldRef.s.c; C <= oldRef.e.c; ++C) {
                    delete ws[XLSX.utils.encode_cell({ c: C, r: R })];
                }
            }

            populateSheetRows(ws);
            XLSX.writeFile(wb, `Nomina_${startDate}_${endDate}.xlsx`);
        } catch (err) {
            console.warn('[Nomina] Template fetch fallback, generating directly:', err);

            // Generador de respaldo exacto (mismas columnas B a AS, mismas fórmulas, anchos y fusiones)
            const wb = XLSX.utils.book_new();
            const ws: any = {};

            const COL_HEADERS: Record<string, string> = {
                B: 'ESTATUS', C: 'REGISTRO PATRONAL', D: 'EMPRESA', E: 'ALTA IMSS ', F: 'FECHA INGRESO',
                G: 'NOMBRE', H: 'PROYECTO', I: 'PUESTO', J: 'TIPO DE NOMINA', K: 'NOMINA IMSS',
                L: 'NOMINA PPP', M: 'TOTAL NÓMINA MENSUAL ', N: 'VACACIONES', O: 'FALTAS', P: 'INCAPACIDADES',
                Q: 'DIAS TRABAJADOS', R: 'INGRESOS VARIOS', S: 'VIATICOS', T: 'HORAS EXTRAS CARTA',
                U: 'HORAS EXTRAS', V: 'TOTAL', W: 'SUELDO BRUTO IMSS', X: 'SD', Y: 'SDI',
                Z: 'DIAS TRABAJADOS', AA: 'DIAS LAB nomina', AB: 'SUELDO', AC: 'AGUINALDO', AD: 'VACACIONES',
                AE: 'BONO PUNTUALIDAD', AF: 'BONO ASISTENCIA', AG: 'RETROACTIVO',
                AH: 'INCAPACIDAD PAGADA POR LA EMPRESA', AI: 'TOTAL PERCEPCIÓN', AJ: 'INFONAVIT',
                AK: 'ISR-FISCAL', AL: 'IMSS', AM: 'TOTAL DEDUCCIÓN', AN: 'NETO A PAGAR', AO: 'DESCUENTOS',
                AP: 'TOTAL NOMINA SYS', AQ: '', AR: 'TOTAL NOMINA PRODUCTIVIDAD', AS: 'SALARIO TOTAL QUINCENAL'
            };

            const merges: any[] = [{ s: { c: 1, r: 0 }, e: { c: 44, r: 0 } }];
            Object.keys(COL_HEADERS).forEach(colLetter => {
                const colIdx = XLSX.utils.decode_col(colLetter);
                const title = COL_HEADERS[colLetter];
                if (title) {
                    ws[colLetter + '2'] = {
                        t: 's',
                        v: title,
                        s: {
                            patternType: 'solid',
                            fgColor: { rgb: '0792A1' },
                            font: { color: { rgb: 'FFFFFF' }, bold: true }
                        }
                    };
                }
                merges.push({ s: { c: colIdx, r: 1 }, e: { c: colIdx, r: 3 } });
            });

            ws['!merges'] = merges;
            ws['!cols'] = [
                { wch: 4 }, { wch: 11 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
                { wch: 32 }, { wch: 18 }, { wch: 26 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
                { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
                { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 10 },
                { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
                { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 12 },
                { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
                { wch: 14 }, { wch: 24 }, { wch: 24 }
            ];

            populateSheetRows(ws);
            XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
            XLSX.writeFile(wb, `Nomina_${startDate}_${endDate}.xlsx`);
        }
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
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-accent-greyDark flex items-center gap-3">
                        <div className="p-2.5 bg-brand-teal/10 rounded-xl text-brand-teal">
                            <FileSpreadsheet size={24} />
                        </div>
                        {t('nomina.title', 'Nómina Quincenal')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('nomina.subtitle', 'Cálculo, desglose y exportación de nómina según asistencia y parámetros fiscales')}
                    </p>
                </div>

                {/* Filter and Mode Bar */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setFilterMode('projects')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                filterMode === 'projects' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <Filter size={13} /> Por Proyectos
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('manual')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                filterMode === 'manual' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <Users size={13} /> Selección Manual / Sin Proyecto
                        </button>
                    </div>

                    <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>

                    {/* Date Pickers */}
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">{t('nomina.from', 'Desde')}</label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs border-0 bg-gray-50 rounded-lg w-32" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">{t('nomina.to', 'Hasta')}</label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs border-0 bg-gray-50 rounded-lg w-32" />
                        </div>
                    </div>

                    <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>

                    {/* Multi-select Projects Dropdown */}
                    {filterMode === 'projects' && (
                        <div className="relative" ref={projectDropdownRef}>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('nomina.project', 'Proyectos')}</label>
                            <button
                                type="button"
                                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                                className="h-8 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg px-3 flex items-center justify-between gap-2 min-w-[180px] font-medium text-gray-700 border border-gray-200"
                            >
                                <span className="truncate max-w-[160px]">
                                    {selectedProjects.includes('all') || selectedProjects.length === 0
                                        ? 'Todos los proyectos'
                                        : `${selectedProjects.length} proyecto(s) seleccionado(s)`}
                                </span>
                                <ChevronDown size={14} className="text-gray-400 shrink-0" />
                            </button>

                            {isProjectDropdownOpen && (
                                <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                                    <div className="relative mb-2">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar proyecto..."
                                            value={projectSearch}
                                            onChange={e => setProjectSearch(e.target.value)}
                                            className="w-full pl-8 pr-2 py-1 text-xs bg-gray-50 rounded-lg border border-gray-200 outline-none focus:ring-1 focus:ring-brand-teal"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        <label className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-xs font-bold text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={selectedProjects.includes('all')}
                                                onChange={() => toggleProject('all')}
                                                className="rounded text-brand-teal focus:ring-0"
                                            />
                                            <span>Todos los proyectos</span>
                                        </label>
                                        {activeProjects
                                            .filter(p => !projectSearch || (p.name + (p.codeName || '')).toLowerCase().includes(projectSearch.toLowerCase()))
                                            .map(p => {
                                                const isChecked = selectedProjects.includes('all') || selectedProjects.includes(p.id);
                                                return (
                                                    <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-xs text-gray-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleProject(p.id)}
                                                            className="rounded text-brand-teal focus:ring-0"
                                                        />
                                                        <span className="truncate">{p.codeName ? `${p.codeName} - ` : ''}{p.name}</span>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual Personnel Selector Dropdown */}
                    {filterMode === 'manual' && (
                        <div className="relative" ref={personnelDropdownRef}>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Personal ({selectedPersonnelIds.length}/{mxPersonnel.length})</label>
                            <button
                                type="button"
                                onClick={() => setIsPersonnelDropdownOpen(!isPersonnelDropdownOpen)}
                                className="h-8 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg px-3 flex items-center justify-between gap-2 min-w-[200px] font-medium text-gray-700 border border-gray-200"
                            >
                                <span className="truncate max-w-[170px]">
                                    {selectedPersonnelIds.length === mxPersonnel.length
                                        ? `Todos seleccionados (${mxPersonnel.length})`
                                        : `${selectedPersonnelIds.length} colaborador(es)`}
                                </span>
                                <ChevronDown size={14} className="text-gray-400 shrink-0" />
                            </button>

                            {isPersonnelDropdownOpen && (
                                <div className="absolute left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                                    <div className="relative mb-2">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar colaborador..."
                                            value={personnelSearch}
                                            onChange={e => setPersonnelSearch(e.target.value)}
                                            className="w-full pl-8 pr-2 py-1 text-xs bg-gray-50 rounded-lg border border-gray-200 outline-none focus:ring-1 focus:ring-brand-teal"
                                        />
                                    </div>
                                    <div className="max-h-52 overflow-y-auto space-y-1">
                                        <label className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-xs font-bold text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={selectedPersonnelIds.length === mxPersonnel.length}
                                                onChange={() => togglePersonnel('all')}
                                                className="rounded text-brand-teal focus:ring-0"
                                            />
                                            <span>Seleccionar Todos ({mxPersonnel.length})</span>
                                        </label>
                                        {mxPersonnel
                                            .filter(p => !personnelSearch || p.name.toLowerCase().includes(personnelSearch.toLowerCase()) || (p.position || '').toLowerCase().includes(personnelSearch.toLowerCase()))
                                            .map(p => {
                                                const isChecked = selectedPersonnelIds.includes(p.id);
                                                return (
                                                    <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-xs text-gray-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => togglePersonnel(p.id)}
                                                            className="rounded text-brand-teal focus:ring-0"
                                                        />
                                                        <div className="truncate">
                                                            <span className="font-semibold">{p.name}</span>
                                                            {p.position && <span className="text-[10px] text-gray-400 block">{p.position}</span>}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 ml-auto">
                        <button 
                            onClick={generatePayroll}
                            className="h-9 px-4 bg-gray-900 text-white rounded-xl text-xs font-bold shadow-md shadow-gray-900/20 hover:bg-gray-800 transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={14} />
                            {t('nomina.generate', 'Generar Nómina')}
                        </button>

                        <button 
                            onClick={exportToExcel}
                            disabled={editableRows.length === 0}
                            className="h-9 px-4 bg-brand-teal text-white rounded-xl text-xs font-bold shadow-md shadow-brand-teal/20 hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <Download size={14} />
                            Excel (.xlsx)
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-220px)] relative">
                {editableRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                        <FileSpreadsheet size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">{t('nomina.empty_state', 'No hay datos generados. Configura los filtros y haz clic en "Generar Nómina".')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse min-w-[2400px]">
                            <thead className="bg-[#0f766e] text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">ESTATUS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">REGISTRO PATRONAL</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">EMPRESA</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">ALTA IMSS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">FECHA INGRESO</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">NOMBRE</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">PROYECTO</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">PUESTO</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">TIPO DE NOMINA</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">NOMINA IMSS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">NOMINA PPP</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">TOTAL NÓMINA MENSUAL</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">VACACIONES</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">FALTAS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">INCAPACIDADES</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">DIAS TRABAJADOS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">INGRESOS VARIOS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">VIATICOS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">HORAS EXTRAS CARTA</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">HORAS EXTRAS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/30">TOTAL (EXTRAS)</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">SUELDO BRUTO IMSS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">SD</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">SDI</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">DIAS TRAB (IMSS)</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">DIAS LAB NOMINA</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">SUELDO</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">AGUINALDO</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">VACACIONES PRIMA</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">BONO PUNTUALIDAD</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">BONO ASISTENCIA</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">RETROACTIVO</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-green-800/20">INCAP PAG EMPRESA</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-brand-teal/30">TOTAL PERCEPCIÓN</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">INFONAVIT</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">ISR-FISCAL</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">IMSS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-950/20">TOTAL DEDUCCIÓN</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-brand-teal/40">NETO A PAGAR</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20 bg-red-800/20">DESCUENTOS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">TOTAL NOMINA SYS</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">TOTAL PRODUCTIVIDAD</th>
                                    <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-l border-white/20">SALARIO TOTAL QUINCENAL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {editableRows.map((row, i) => (
                                    <tr key={row.id} className="hover:bg-teal-50/10 transition-colors focus-within:bg-teal-50/30">
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.status} onChange={v => updateRow(i, 'status', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.registroPatronal} onChange={v => updateRow(i, 'registroPatronal', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.empresa} onChange={v => updateRow(i, 'empresa', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.altaImss} onChange={v => updateRow(i, 'altaImss', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.fechaIngreso} onChange={v => updateRow(i, 'fechaIngreso', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.nombre} onChange={v => updateRow(i, 'nombre', v)} className="font-bold text-accent-greyDark" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.proyecto} onChange={v => updateRow(i, 'proyecto', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.puesto} onChange={v => updateRow(i, 'puesto', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.tipoNomina} onChange={v => updateRow(i, 'tipoNomina', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.nominaImss} onChange={v => updateRow(i, 'nominaImss', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.nominaPpp} onChange={v => updateRow(i, 'nominaPpp', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.totalNominaMensual} onChange={v => updateRow(i, 'totalNominaMensual', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.vacaciones} onChange={v => updateRow(i, 'vacaciones', v)} className="text-center" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.faltas} onChange={v => updateRow(i, 'faltas', v)} className="text-center" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.incapacidades} onChange={v => updateRow(i, 'incapacidades', v)} className="text-center" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-teal-50/10 w-16"><CellInput value={row.diasTrabajados} onChange={v => updateRow(i, 'diasTrabajados', v)} className="text-center font-bold" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.ingresosVarios} onChange={v => updateRow(i, 'ingresosVarios', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.viaticos} onChange={v => updateRow(i, 'viaticos', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.horasExtrasCarta} onChange={v => updateRow(i, 'horasExtrasCarta', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.horasExtras} onChange={v => updateRow(i, 'horasExtras', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/20"><CellInput value={row.totalIngresosExtras} onChange={v => updateRow(i, 'totalIngresosExtras', v)} className="font-bold text-green-700" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.sueldoBrutoImss} onChange={v => updateRow(i, 'sueldoBrutoImss', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.sd} onChange={v => updateRow(i, 'sd', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.sdi} onChange={v => updateRow(i, 'sdi', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 w-16"><CellInput value={row.diasTrabajados} onChange={v => updateRow(i, 'diasTrabajados', v)} className="text-center" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 w-16"><CellInput value={row.diasLabNomina} onChange={v => updateRow(i, 'diasLabNomina', v)} className="text-center" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.sueldo} onChange={v => updateRow(i, 'sueldo', v)} className="font-bold" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.aguinaldo} onChange={v => updateRow(i, 'aguinaldo', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.vacacionesPrima} onChange={v => updateRow(i, 'vacacionesPrima', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.bonoPuntualidad} onChange={v => updateRow(i, 'bonoPuntualidad', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.bonoAsistencia} onChange={v => updateRow(i, 'bonoAsistencia', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.retroactivo} onChange={v => updateRow(i, 'retroactivo', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-green-50/10"><CellInput value={row.incapacidadPagadaEmpresa} onChange={v => updateRow(i, 'incapacidadPagadaEmpresa', v)} /></td>
                                        <td className="px-1 py-1 border-l border-brand-teal/20 bg-brand-teal/5"><CellInput value={row.totalPercepcion} onChange={v => updateRow(i, 'totalPercepcion', v)} className="font-black text-brand-teal text-right" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10"><CellInput value={row.infonavit} onChange={v => updateRow(i, 'infonavit', v)} className="text-red-500 text-right" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10"><CellInput value={row.isrFiscal} onChange={v => updateRow(i, 'isrFiscal', v)} className="text-red-500 text-right" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10"><CellInput value={row.imss} onChange={v => updateRow(i, 'imss', v)} className="text-red-500 text-right" /></td>
                                        <td className="px-1 py-1 border-l border-red-900/20 bg-red-950/5"><CellInput value={row.totalDeduccion} onChange={v => updateRow(i, 'totalDeduccion', v)} className="font-black text-red-700 text-right" /></td>
                                        <td className="px-1 py-1 border-l border-brand-teal/20 bg-brand-teal/10"><CellInput value={row.netoAPagar} onChange={v => updateRow(i, 'netoAPagar', v)} className="font-black text-brand-teal text-right" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100 bg-red-50/10"><CellInput value={row.descuentos} onChange={v => updateRow(i, 'descuentos', v)} className="text-red-500 text-right" /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.totalNominaSys} onChange={v => updateRow(i, 'totalNominaSys', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.totalNominaProductividad} onChange={v => updateRow(i, 'totalNominaProductividad', v)} /></td>
                                        <td className="px-1 py-1 border-l border-gray-100"><CellInput value={row.salarioTotalQuincenal} onChange={v => updateRow(i, 'salarioTotalQuincenal', v)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 sticky bottom-0 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={33} className="px-4 py-3 text-xs font-black text-right text-gray-500">{t('nomina.total_general', 'TOTAL GENERAL')}</td>
                                    <td className="px-4 py-3 text-sm font-black text-brand-teal border-l border-gray-200 bg-white text-right">
                                        ${totalPercepcionSum.toFixed(2)}
                                    </td>
                                    <td colSpan={3} className="border-l border-gray-200 bg-white"></td>
                                    <td className="px-4 py-3 text-sm font-black text-red-700 border-l border-gray-200 bg-white text-right">
                                        ${totalDeduccionSum.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-black text-brand-teal text-right border-l border-gray-200 bg-white shadow-inner">
                                        ${totalNetoSum.toFixed(2)}
                                    </td>
                                    <td colSpan={4} className="border-l border-gray-200 bg-white"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
