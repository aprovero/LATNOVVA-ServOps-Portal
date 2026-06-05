import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, TimesheetEntry } from '../../store/useStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { calculateWorkedHours } from '../../utils/attendanceCalculations';

interface ManualCorrectionPanelProps {
    employeeId: string;
    date: string;
    existingTimesheet?: TimesheetEntry;
    onClose: () => void;
}

export default function ManualCorrectionPanel({ employeeId, date, existingTimesheet, onClose }: ManualCorrectionPanelProps) {
    const { t } = useTranslation();
    const { addTimesheet, updateTimesheet, getCurrentUserName } = useStore();

    const [timeIn, setTimeIn] = useState(existingTimesheet?.timeIn || '');
    const [lunchStart, setLunchStart] = useState(existingTimesheet?.lunchStart || '');
    const [lunchEnd, setLunchEnd] = useState(existingTimesheet?.lunchEnd || '');
    const [timeOut, setTimeOut] = useState(existingTimesheet?.timeOut || '');
    const [notes, setNotes] = useState(existingTimesheet?.notes || '');
    const [correctionReason, setCorrectionReason] = useState('');

    const handleSave = () => {
        if (!correctionReason.trim()) {
            alert(t('attendance.correction.reason_required', 'Debe ingresar un motivo para la corrección manual.'));
            return;
        }

        // Calculate hours
        let hours = 0;
        if (timeIn && timeOut) {
            const calc = calculateWorkedHours(timeIn, lunchStart || undefined, lunchEnd || undefined, timeOut);
            if (!calc.error) {
                hours = calc.totalWorkedMinutes / 60;
            }
        }

        const username = getCurrentUserName() || 'HR User';
        const timestamp = new Date().toISOString();

        const payload: Partial<TimesheetEntry> = {
            timeIn: timeIn || undefined,
            lunchStart: lunchStart || undefined,
            lunchEnd: lunchEnd || undefined,
            timeOut: timeOut || undefined,
            hours: Number(hours.toFixed(2)),
            notes: notes || undefined,
            correctedBy: username,
            correctedAt: timestamp,
            correctionReason: correctionReason,
            source: 'manual',
            status: 'Approved' // HR corrections are auto-approved
        };

        if (existingTimesheet) {
            updateTimesheet(existingTimesheet.id, payload);
        } else {
            const newEntry: TimesheetEntry = {
                id: `TS-CORR-${Date.now()}`,
                personnelId: employeeId,
                date,
                hours: Number(hours.toFixed(2)),
                type: 'On Site',
                status: 'Approved',
                timeIn: timeIn || undefined,
                lunchStart: lunchStart || undefined,
                lunchEnd: lunchEnd || undefined,
                timeOut: timeOut || undefined,
                notes: notes || undefined,
                correctedBy: username,
                correctedAt: timestamp,
                correctionReason: correctionReason,
                source: 'manual'
            };
            addTimesheet(newEntry);
        }

        alert(t('attendance.correction.success_alert', 'Registro corregido exitosamente.'));
        onClose();
    };

    return (
        <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-4 animate-in slide-in-from-right-4 duration-200">
            <h4 className="text-sm font-bold text-accent-greyDark flex items-center gap-2">
                ✏️ {t('attendance.correction.panel_title', 'Corrección Manual del Día')}
            </h4>
            <p className="text-xs text-gray-500">
                {t('attendance.correction.audit_help', 'Toda corrección manual guarda un registro de auditoría con la persona, fecha y motivo.')}
            </p>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                        {t('timesheets.modals.time_in', 'Entrada')}
                    </label>
                    <Input
                        type="time"
                        value={timeIn}
                        onChange={e => setTimeIn(e.target.value)}
                        className="bg-white rounded-xl"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                        {t('timesheets.modals.time_out', 'Salida')}
                    </label>
                    <Input
                        type="time"
                        value={timeOut}
                        onChange={e => setTimeOut(e.target.value)}
                        className="bg-white rounded-xl"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                        {t('attendance.correction.lunch_start', 'Inicio Almuerzo')}
                    </label>
                    <Input
                        type="time"
                        value={lunchStart}
                        onChange={e => setLunchStart(e.target.value)}
                        className="bg-white rounded-xl"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                        {t('attendance.correction.lunch_end', 'Fin Almuerzo')}
                    </label>
                    <Input
                        type="time"
                        value={lunchEnd}
                        onChange={e => setLunchEnd(e.target.value)}
                        className="bg-white rounded-xl"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                    {t('attendance.override.notes', 'Notas')}
                </label>
                <Input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Olvidó marcar entrada"
                    className="bg-white rounded-xl"
                />
            </div>

            <div className="space-y-1 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
                    {t('attendance.correction.reason', 'Motivo de Corrección')} <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={correctionReason}
                    onChange={e => setCorrectionReason(e.target.value)}
                    placeholder="Motivo obligatorio..."
                    rows={2}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none mt-1"
                />
            </div>

            <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl flex-1 font-bold text-xs h-9 bg-white" onClick={onClose}>
                    {t('common.cancel', 'Cancelar')}
                </Button>
                <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl flex-1 font-bold text-xs h-9" onClick={handleSave}>
                    {t('common.save', 'Guardar')}
                </Button>
            </div>
        </div>
    );
}
