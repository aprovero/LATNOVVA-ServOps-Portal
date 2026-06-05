import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, AttendanceOverride } from '../../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface AddOverrideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AddOverrideModal({ isOpen, onClose }: AddOverrideModalProps) {
    const { t } = useTranslation();
    const { personnel, addAttendanceOverride, getCurrentUserName } = useStore();

    const [employeeId, setEmployeeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState<AttendanceOverride['type']>('vacation');
    const [duration, setDuration] = useState<AttendanceOverride['duration']>('full_day');
    const [customHours, setCustomHours] = useState('');
    const [notes, setNotes] = useState('');

    const handleSave = () => {
        if (!employeeId || !startDate || !endDate) {
            alert(t('attendance.override.validation_alert', 'Por favor complete todos los campos obligatorios.'));
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert(t('attendance.override.date_alert', 'La fecha de inicio no puede ser posterior a la fecha de fin.'));
            return;
        }

        const newOverride: AttendanceOverride = {
            id: `OVR-${Date.now()}`,
            employeeId,
            startDate,
            endDate,
            type,
            duration,
            customHours: duration === 'custom_hours' ? Number(customHours) : undefined,
            notes,
            approvedBy: getCurrentUserName(),
            createdBy: getCurrentUserName(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        addAttendanceOverride(newOverride);
        onClose();
        resetForm();
    };

    const resetForm = () => {
        setEmployeeId('');
        setStartDate('');
        setEndDate('');
        setType('vacation');
        setDuration('full_day');
        setCustomHours('');
        setNotes('');
    };

    const activePersonnel = personnel.filter(p => p.status === 'Active');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px] rounded-2xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-accent-greyDark">
                        {t('attendance.override.add_title', 'Agregar Asistencia / Ausencia')}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                            {t('attendance.override.employee', 'Colaborador')} <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={employeeId}
                            onChange={e => setEmployeeId(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                        >
                            <option value="">{t('attendance.override.select_employee', 'Seleccionar Colaborador')}...</option>
                            {activePersonnel.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                                {t('attendance.override.start_date', 'Fecha Inicio')} <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                                {t('attendance.override.end_date', 'Fecha Fin')} <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                                {t('attendance.override.type', 'Tipo de Registro')}
                            </label>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value as AttendanceOverride['type'])}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                            >
                                <option value="vacation">{t('attendance.status.vacation', 'Vacaciones')}</option>
                                <option value="sick_leave">{t('attendance.status.sick_leave', 'Incapacidad')}</option>
                                <option value="home_office">{t('attendance.status.home_office', 'Home Office')}</option>
                                <option value="personal_leave">{t('attendance.status.personal_leave', 'Permiso')}</option>
                                <option value="unpaid_leave">{t('attendance.status.unpaid_leave', 'Permiso sin goce')}</option>
                                <option value="training">{t('attendance.status.training', 'Capacitación')}</option>
                                <option value="holiday">{t('attendance.status.holiday', 'Feriado')}</option>
                                <option value="rest_day">{t('attendance.status.rest_day', 'Descanso')}</option>
                                <option value="suspension">{t('attendance.status.suspension', 'Suspensión')}</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                                {t('attendance.override.duration', 'Duración')}
                            </label>
                            <select
                                value={duration}
                                onChange={e => setDuration(e.target.value as AttendanceOverride['duration'])}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                            >
                                <option value="full_day">{t('attendance.duration.full', 'Día Completo')}</option>
                                <option value="half_day">{t('attendance.duration.half', 'Medio Día')}</option>
                                <option value="custom_hours">{t('attendance.duration.hours', 'Horas Personalizadas')}</option>
                            </select>
                        </div>
                    </div>

                    {duration === 'custom_hours' && (
                        <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                                {t('attendance.override.custom_hours', 'Horas específicas')} <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="number"
                                min="0.5"
                                max="24"
                                step="0.5"
                                value={customHours}
                                onChange={e => setCustomHours(e.target.value)}
                                placeholder="e.g. 4"
                                className="rounded-xl"
                            />
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                            {t('attendance.override.notes', 'Notas / Comentarios')}
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder={t('attendance.override.notes_placeholder', 'Escriba un motivo...')}
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-brand-teal outline-none"
                        />
                    </div>
                </div>
                <DialogFooter className="flex gap-2">
                    <Button variant="outline" className="rounded-xl flex-1 font-bold h-11" onClick={onClose}>
                        {t('common.cancel', 'Cancelar')}
                    </Button>
                    <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl flex-1 font-bold h-11" onClick={handleSave}>
                        {t('common.save', 'Guardar')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
