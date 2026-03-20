import { Clock } from 'lucide-react';

interface WorkScheduleProps {
    schedule: { arrival: string; departure: string; shift: 'Morning' | 'Afternoon' | 'Evening' | 'All Day' };
    onChange: (schedule: { arrival: string; departure: string; shift: 'Morning' | 'Afternoon' | 'Evening' | 'All Day' }) => void;
    readOnly: boolean;
}

export default function WorkSchedule({ schedule, onChange, readOnly }: WorkScheduleProps) {
    const shifts = ['Morning', 'Afternoon', 'Evening', 'All Day'] as const;

    return (
        <div className="card-container">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
                    <Clock className="text-brand-teal" size={20} /> Work Schedule
                </h2>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Shift</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {shifts.map(s => (
                            <button
                                key={s}
                                disabled={readOnly}
                                onClick={() => onChange({ ...schedule, shift: s })}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors
                                ${schedule.shift === s
                                        ? 'bg-brand-teal text-white shadow-soft'
                                        : 'bg-surface-alt text-gray-500 hover:bg-gray-100 border border-gray-100'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Arrival</label>
                        <input
                            type="time"
                            value={schedule.arrival}
                            onChange={e => onChange({ ...schedule, arrival: e.target.value })}
                            disabled={readOnly}
                            className="w-full bg-surface-alt border border-gray-200 focus:border-brand-teal outline-none py-2 px-3 rounded-xl mt-2 disabled:opacity-70 font-mono text-accent-greyDark"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Departure</label>
                        <input
                            type="time"
                            value={schedule.departure}
                            onChange={e => onChange({ ...schedule, departure: e.target.value })}
                            disabled={readOnly}
                            className="w-full bg-surface-alt border border-gray-200 focus:border-brand-teal outline-none py-2 px-3 rounded-xl mt-2 disabled:opacity-70 font-mono text-accent-greyDark"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
