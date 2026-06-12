import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, Personnel, Project } from '../../store/useStore';
import { calculateDailyAttendance, getStatusLabel, formatDisplayDate } from '../../utils/attendanceCalculations';
import { X, AlertTriangle, AlertOctagon, Edit3 } from 'lucide-react';
import ManualCorrectionPanel from './ManualCorrectionPanel';
import { getDistanceMeters, parseCoordinates } from '../../utils/datetime.utils';
import { useAuthStore } from '../../lib/authStore';

interface DayDetailPanelProps {
    employee: Personnel;
    date: string;
    project?: Project;
    onClose: () => void;
}

export default function DayDetailPanel({ employee, date, project, onClose }: DayDetailPanelProps) {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'en' ? 'en' : 'es';
    const { timesheets, attendanceOverrides, workSchedules, projects, userRole, platformSettings, updateTimesheet } = useStore();
    const [isEditing, setIsEditing] = useState(false);

    // Compute details for this date
    const dayView = calculateDailyAttendance(employee, date, timesheets, attendanceOverrides, workSchedules, lang);
    const timesheetEntry = timesheets.find(t => t.personnelId === employee.id && t.date === date);
    const dayOverride = attendanceOverrides.find(o => 
        o.employeeId === employee.id && 
        new Date(date + 'T00:00:00') >= new Date(o.startDate + 'T00:00:00') && 
        new Date(date + 'T00:00:00') <= new Date(o.endDate + 'T00:00:00')
    );

    // Fetch schedule
    const scheduleId = employee.defaultScheduleId || 'SCH-STD-MX';
    const schedule = workSchedules.find(s => s.id === scheduleId) || {
        name: 'Horario Estándar México',
        startTime: '08:00',
        lunchStart: '13:00',
        lunchEnd: '14:00',
        endTime: '17:30',
        standardDailyHours: 8.5
    };

    // Color mapper for statuses
    const statusColor: Record<string, string> = {
        'Present': 'bg-teal-50 text-teal-700 border-teal-200',
        'Vacation': 'bg-indigo-50 text-indigo-700 border-indigo-200',
        'Sick Leave': 'bg-red-50 text-red-700 border-red-200',
        'Home Office': 'bg-purple-50 text-purple-700 border-purple-200',
        'Personal Leave': 'bg-pink-50 text-pink-700 border-pink-200',
        'Unpaid Leave': 'bg-gray-100 text-gray-700 border-gray-200',
        'Training': 'bg-blue-50 text-blue-700 border-blue-200',
        'Holiday': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        'Rest Day': 'bg-slate-50 text-slate-700 border-slate-200',
        'Suspension': 'bg-orange-50 text-orange-700 border-orange-200',
        'Absent': 'bg-rose-50 text-rose-700 border-rose-200',
        'Missing Punch': 'bg-amber-50 text-amber-700 border-amber-200',
        'Conflict': 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
    };

    return (
        <>
            {/* Backdrop overlay */}
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-xs z-40 animate-in fade-in duration-200" 
                onClick={onClose}
            />
            <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 border-l border-gray-100 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                    <h3 className="text-lg font-bold text-accent-greyDark">{t('attendance.detail.title', 'Detalle de Jornada')}</h3>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-0.5">{formatDisplayDate(date, lang)}</p>
                </div>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Employee Card */}
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center text-white text-lg font-bold">
                        {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-accent-greyDark truncate">{employee.name}</h4>
                        <p className="text-xs text-gray-500">{employee.position} · {project?.codeName || project?.name || t('attendance.unassigned', 'Sin Proyecto')}</p>
                    </div>
                </div>

                {/* Final Status Indicator */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('attendance.detail.calculated_status', 'Estado Calculado')}</label>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusColor[dayView.displayStatus] || 'bg-gray-50'}`}>
                            {dayView.displayStatus === 'Conflict' && '⚠️ '}
                            {t(`attendance.status.${dayView.displayStatus.toLowerCase().replace(' ', '_')}`, dayView.displayStatus)}
                        </span>
                        {timesheetEntry && timesheetEntry.punches && timesheetEntry.punches.length > 0 && (() => {
                            const gpsThreshold = platformSettings.gpsAccuracyThreshold ?? 100;
                            const radius = platformSettings.geofenceRadius ?? 250;
                            const targetProjId = timesheetEntry.projectId;
                            const targetProject = targetProjId ? projects.find((p: any) => p.id === targetProjId) : null;
                            const geofenceRequired = targetProject?.locationValidated ?? false;
                            const projCoords = targetProject ? parseCoordinates(targetProject.location) : null;

                            const computedGpsVerified = !timesheetEntry.punches || timesheetEntry.punches.every((p: any) => {
                                if (p.accuracy > gpsThreshold) return false;
                                if (geofenceRequired && projCoords && p.workMode !== 'Home Office') {
                                    const dist = projCoords && p.lat !== 0 ? getDistanceMeters(p.lat, p.lng, projCoords.lat, projCoords.lng) : 0;
                                    if (dist > radius) return false;
                                }
                                return true;
                            });

                            const resolvedGpsVerified = timesheetEntry.gpsVerified || computedGpsVerified;

                            return (
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 ${
                                            resolvedGpsVerified 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                        }`}>
                                            {resolvedGpsVerified ? '📍 GPS Verificado' : '⚠️ Alerta de Ubicación / Precisión'}
                                        </span>
                                        {(!resolvedGpsVerified && ['Manager', 'HR', 'Supervisor'].includes(userRole)) && (
                                            <button 
                                                onClick={async () => {
                                                    const adminName = useAuthStore.getState().identity?.name || 'Administración';
                                                    await updateTimesheet(timesheetEntry.id, { 
                                                        gpsVerified: true,
                                                        notes: timesheetEntry.notes 
                                                            ? `${timesheetEntry.notes} | Ubicación aprobada por ${adminName}` 
                                                            : `Ubicación aprobada por ${adminName}`
                                                    });
                                                }}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
                                            >
                                                {t('attendance.actions.approve_gps', 'Aprobar Ubicación')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Conflict / Warning banners */}
                {dayView.conflict && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-orange-800 text-xs flex gap-3 items-start">
                        <AlertOctagon size={16} className="text-orange-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-bold">{t('attendance.alerts.conflict_found', 'Conflicto de Registros Detectado')}</p>
                            <p className="text-orange-700/80 mt-1">
                                {t('attendance.alerts.conflict_desc', 'El colaborador tiene marcajes de asistencia o correcciones manuales en un día registrado con una ausencia autorizada (como vacaciones o incapacidad).')}
                            </p>
                        </div>
                    </div>
                )}

                {dayView.missingPunch && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex gap-3 items-start">
                        <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-bold">{t('attendance.alerts.missing_punch_found', 'Marcaje Faltante')}</p>
                            <p className="text-amber-700/80 mt-1">
                                {t('attendance.alerts.missing_punch_desc', 'El colaborador tiene un marcaje de Entrada o Salida registrado, pero falta la contraparte.')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Grid Calculations Details */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('attendance.detail.regular_hours', 'Horas Regulares')}</span>
                        <p className="text-2xl font-extrabold text-accent-greyDark">{dayView.regularHours} hrs</p>
                    </div>
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('attendance.detail.overtime_hours', 'Horas Extras')}</span>
                        <p className="text-2xl font-extrabold text-brand-teal">{dayView.overtimeHours} hrs</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('attendance.detail.schedule_expect', 'Expectativa de Horario')}</h4>
                        <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-3.5 space-y-2 text-xs text-gray-600">
                            <div className="flex justify-between"><span className="font-semibold">{t('attendance.detail.schedule_name', 'Horario Asignado')}</span><span>{schedule.name}</span></div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('attendance.detail.raw_logs', 'Registros Registrados')}</h4>
                        <div className="space-y-3">
                            {dayView.shifts && dayView.shifts.length > 0 ? (
                                dayView.shifts.map((shift, sIdx) => {
                                    const proj = projects.find(p => p.id === shift.projectId);
                                    const projName = proj ? (proj.codeName || proj.name) : t('attendance.unassigned', 'Sin Proyecto');
                                    return (
                                        <div key={sIdx} className="bg-gray-50/50 border border-gray-100 rounded-xl p-3.5 space-y-2 text-xs text-gray-600 relative overflow-hidden">
                                            <div className="border-b border-gray-200/50 pb-1.5 font-bold text-brand-teal flex justify-between items-center">
                                                <span>{dayView.shifts!.length > 1 ? `${t('attendance.shift', 'Turno')} ${sIdx + 1}` : t('attendance.shift_detail', 'Detalle de Turno')}</span>
                                                <span className="text-gray-400 font-medium text-[10px] truncate max-w-[200px]">{projName}</span>
                                            </div>
                                            <div className="flex justify-between mt-1.5"><span>{t('timesheets.modals.time_in', 'Entrada')}</span><span className="font-bold">{shift.timeIn || '—'}</span></div>
                                            {shift.lunchStart && <div className="flex justify-between"><span>{t('attendance.correction.lunch_start', 'Inicio Almuerzo')}</span><span>{shift.lunchStart || '—'}</span></div>}
                                            {shift.lunchEnd && <div className="flex justify-between"><span>{t('attendance.correction.lunch_end', 'Fin Almuerzo')}</span><span>{shift.lunchEnd || '—'}</span></div>}
                                            <div className="flex justify-between"><span>{t('timesheets.modals.time_out', 'Salida')}</span><span className="font-bold">{shift.timeOut || '—'}</span></div>
                                            <div className="flex justify-between border-t border-gray-100 pt-1 text-[11px]"><span className="text-gray-400">{t('attendance.shift_hours', 'Horas Turno')}</span><span className="font-semibold text-accent-greyDark">{shift.hours} hrs</span></div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-3.5 space-y-2 text-xs text-gray-600">
                                    <div className="flex justify-between"><span>{t('timesheets.modals.time_in', 'Entrada')}</span><span className="font-bold">{dayView.clockIn || '—'}</span></div>
                                    <div className="flex justify-between"><span>{t('attendance.correction.lunch_start', 'Inicio Almuerzo')}</span><span>{dayView.lunchStart || '—'}</span></div>
                                    <div className="flex justify-between"><span>{t('attendance.correction.lunch_end', 'Fin Almuerzo')}</span><span>{dayView.lunchEnd || '—'}</span></div>
                                    <div className="flex justify-between"><span>{t('timesheets.modals.time_out', 'Salida')}</span><span className="font-bold">{dayView.clockOut || '—'}</span></div>
                                </div>
                            )}
                        </div>
                    </div>
 
                    {/* GPS Punch Detail Trail */}
                    {timesheetEntry?.punches && timesheetEntry.punches.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                📍 {t('attendance.detail.gps_punches', 'Detalle de Marcajes GPS')}
                            </h4>
                            <div className="space-y-2">
                                {timesheetEntry.punches.map((punch: any, pIdx: number) => {
                                    const gpsThreshold = platformSettings.gpsAccuracyThreshold ?? 100;
                                    const isPoorGps = punch.accuracy > gpsThreshold;
                                    const targetProjId = timesheetEntry.projectId;
                                    const targetProject = targetProjId ? projects.find((p: any) => p.id === targetProjId) : null;
                                    const geofenceRequired = targetProject?.locationValidated ?? false;
                                    const projCoords = targetProject ? parseCoordinates(targetProject.location) : null;
                                    const radius = platformSettings.geofenceRadius ?? 250;
                                    const dist = projCoords && punch.lat !== 0 ? getDistanceMeters(punch.lat, punch.lng, projCoords.lat, projCoords.lng) : 0;
                                    const isOutside = geofenceRequired && projCoords && punch.workMode !== 'Home Office' && dist > radius;

                                    const formattedDist = dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`;
                                    const formattedRadius = radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`;

                                    return (
                                        <div key={pIdx} className="bg-gray-50/60 border border-gray-100 rounded-xl p-3 text-xs space-y-1 relative">
                                            <div className="flex justify-between font-bold text-gray-600">
                                                <span>
                                                    {punch.type === 'clockIn' ? t('timesheets.modals.time_in', 'Entrada') : 
                                                     punch.type === 'clockOut' ? t('timesheets.modals.time_out', 'Salida') : punch.type}
                                                </span>
                                                <span className="font-mono text-gray-500">
                                                    {new Date(punch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            
                                            {punch.lat !== 0 ? (
                                                <div className="space-y-1">
                                                    <a href={`https://maps.google.com/?q=${punch.lat},${punch.lng}`} target="_blank" rel="noreferrer"
                                                        className="text-teal-600 hover:underline flex items-center gap-1 font-semibold mt-0.5">
                                                        {punch.lat.toFixed(5)}, {punch.lng.toFixed(5)} · ±{Math.round(punch.accuracy)}m
                                                    </a>
                                                    
                                                    {isPoorGps && (
                                                         <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                                                             ⚠️ GPS con baja precisión ({Math.round(punch.accuracy)}m &gt; {gpsThreshold}m)
                                                         </p>
                                                    )}
                                                    
                                                    {isOutside && (
                                                         <p className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                                                             🚨 Fuera de geocerca ({formattedDist} de distancia, límite: {formattedRadius})
                                                         </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 text-[10px] italic">{t('timesheets.table.no_gps', 'Sin coordenadas GPS')}</p>
                                            )}

                                            {punch.adjustmentNote && (
                                                <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2 mt-1">
                                                    <p className="text-[10px] text-amber-800 font-bold">💬 Justificación / Motivo:</p>
                                                    <p className="text-[10px] text-amber-900 italic mt-0.5">"{punch.adjustmentNote}"</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {dayOverride && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('attendance.detail.hr_override', 'Ausencia / Estatus Autorizado (HR)')}</h4>
                            <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-3.5 space-y-2 text-xs text-indigo-900">
                                <div className="flex justify-between"><span>{t('attendance.override.type', 'Tipo')}</span><span className="font-bold">{getStatusLabel(dayOverride.type, lang)}</span></div>
                                <div className="flex justify-between"><span>{t('attendance.override.duration', 'Duración')}</span><span>{dayOverride.duration === 'full_day' ? 'Día Completo' : dayOverride.duration === 'half_day' ? 'Medio Día' : `${dayOverride.customHours} hrs`}</span></div>
                                <div className="flex justify-between"><span>{t('attendance.detail.approved_by', 'Aprobado Por')}</span><span>{dayOverride.approvedBy}</span></div>
                            </div>
                        </div>
                    )}

                    {timesheetEntry?.correctedBy && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">📜 {t('attendance.detail.audit_history', 'Registro de Auditoría')}</h4>
                            <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-3.5 space-y-2 text-xs text-amber-900">
                                <div className="flex justify-between"><span>{t('attendance.detail.corrected_by', 'Corregido Por')}</span><span className="font-bold">{timesheetEntry.correctedBy}</span></div>
                                <div className="flex justify-between"><span>{t('attendance.detail.corrected_at', 'Fecha Corrección')}</span><span>{timesheetEntry.correctedAt ? new Date(timesheetEntry.correctedAt).toLocaleDateString() : ''}</span></div>
                                <div className="flex flex-col gap-1 mt-1 border-t border-amber-100/50 pt-1.5"><span className="font-semibold">{t('attendance.correction.reason', 'Motivo')}</span><p className="italic text-amber-800">{timesheetEntry.correctionReason}</p></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Notes log */}
                {dayView.notes && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('attendance.override.notes', 'Notas')}</label>
                        <p className="text-sm bg-gray-50 border p-3 rounded-xl italic text-gray-600">{dayView.notes}</p>
                    </div>
                )}

                {/* Edit Correction Section */}
                {['Manager', 'HR', 'Supervisor'].includes(userRole) && (
                    !isEditing ? (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold flex items-center justify-center gap-2 mt-4"
                        >
                            <Edit3 size={16} /> {t('attendance.detail.correct_btn', 'Corregir Marcaje Manual')}
                        </button>
                    ) : (
                        <ManualCorrectionPanel
                            employeeId={employee.id}
                            date={date}
                            existingTimesheet={timesheetEntry}
                            onClose={() => {
                                setIsEditing(false);
                            }}
                        />
                    )
                )}
            </div>
        </div>
        </>
    );
}
