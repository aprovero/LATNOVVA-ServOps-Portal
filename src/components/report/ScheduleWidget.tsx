import { Clock } from 'lucide-react';

export interface ScheduleData {
    arrival: string;
    departure: string;
    shift: 'Morning' | 'Afternoon' | 'Evening' | 'All Day';
}

interface ScheduleWidgetProps {
    schedule: ScheduleData;
    onChange: (schedule: ScheduleData) => void;
    readOnly: boolean;
}

export default function ScheduleWidget({ schedule, onChange, readOnly }: ScheduleWidgetProps) {
    return (
        <div className="card-container border-l-4 border-l-blue-400">
            <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2 mb-6">
                <Clock className="text-blue-500" size={20} /> Shift Schedule
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Shift Type</label>
                    <select
                        value={schedule.shift}
                        onChange={(e) => onChange({ ...schedule, shift: e.target.value as any })}
                        disabled={readOnly}
                        className="w-full bg-surface-alt border border-gray-200 focus:border-blue-500 outline-none rounded-xl py-2 px-3 text-accent-greyDark font-semibold disabled:opacity-70 disabled:bg-gray-50"
                    >
                        <option value="Morning">Morning</option>
                        <option value="Afternoon">Afternoon</option>
                        <option value="Evening">Evening</option>
                        <option value="All Day">All Day</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Arrival Time</label>
                    <input
                        type="time"
                        value={schedule.arrival}
                        onChange={(e) => onChange({ ...schedule, arrival: e.target.value })}
                        disabled={readOnly}
                        className="w-full bg-surface-alt border border-gray-200 focus:border-blue-500 outline-none rounded-xl py-2 px-3 text-accent-greyDark font-mono disabled:opacity-70 disabled:bg-gray-50"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Departure Time</label>
                    <input
                        type="time"
                        value={schedule.departure}
                        onChange={(e) => onChange({ ...schedule, departure: e.target.value })}
                        disabled={readOnly}
                        className="w-full bg-surface-alt border border-gray-200 focus:border-blue-500 outline-none rounded-xl py-2 px-3 text-accent-greyDark font-mono disabled:opacity-70 disabled:bg-gray-50"
                    />
                </div>
            </div>
        </div>
    );
}
