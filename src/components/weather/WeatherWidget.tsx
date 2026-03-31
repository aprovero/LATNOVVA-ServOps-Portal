import { useEffect, useState } from 'react';
import { ThermometerSun, MapPin, CloudRain, Edit2, Cpu } from 'lucide-react';
import gsap from 'gsap';

export default function WeatherWidget({ weather, reportDate, projectLocation, onChange, readOnly }: {
    weather: any;
    reportDate?: string;
    projectLocation?: string;
    onChange: (weather: any) => void;
    readOnly?: boolean;
}) {
    // If weather data is already present and temp is not 0, we don't need to load.
    const isNew = !weather || weather.temp === 0 || weather.temp === undefined;
    const [loading, setLoading] = useState(isNew && !readOnly);
    const [isManual, setIsManual] = useState(false);

    useEffect(() => {
        if (!isNew || readOnly) {
            setLoading(false);
            gsap.fromTo(
                '.weather-element',
                { y: 15, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'power2.out' }
            );
            return;
        }

        // Simulate real API fetch or GPS geolocation based on reportDate
        setTimeout(() => {
            const fetchedData = {
                temp: 34,
                condition: 'Clear / Sunny',
                humidity: '45%',
                wind: '12 km/h',
                locationName: projectLocation || 'Unknown Coordinates',
            };

            // Save to parent so it's persisted in the report and doesn't load again
            onChange({ ...weather, ...fetchedData });
            setLoading(false);

            gsap.fromTo(
                '.weather-element',
                { y: 15, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'power2.out' }
            );
        }, 1500);
    }, [isNew, readOnly, weather, onChange]);

    const handleFieldChange = (field: string, value: any) => {
        if (readOnly) return;
        onChange({ ...weather, [field]: value });
    };

    return (
        <div className="card-container bg-gradient-to-br from-brand-teal/5 to-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 text-brand-teal/5">
                <ThermometerSun size={120} />
            </div>

            <div className="flex items-center justify-between mb-3 relative z-10">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CloudRain className="text-brand-teal" /> Site Intelligence
                    </h2>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin size={14} /> {loading ? 'Acquiring GPS...' : weather?.locationName || 'Unknown Location'}
                        {reportDate && (
                            <span className="ml-2 pl-2 border-l border-gray-300 flex items-center gap-2">
                                {reportDate}
                                {reportDate !== new Date().toISOString().split('T')[0] && (
                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase">Historical Data</span>
                                )}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {!readOnly && !loading && (
                        <button
                            onClick={() => setIsManual(!isManual)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isManual ? 'bg-brand-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {isManual ? <Edit2 size={14} /> : <Cpu size={14} />}
                            {isManual ? 'Manual Mode' : 'Auto Mode'}
                        </button>
                    )}
                    {loading && <div className="w-6 h-6 border-2 border-brand-teal border-t-transparent rounded-full animate-spin"></div>}
                </div>
            </div>

            {!loading && (
                <div className="weather-element space-y-3 relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-brand-teal/10">
                            <p className="text-[10px] text-gray-500 font-semibold mb-1 uppercase tracking-wider">Temp (°C)</p>
                            {isManual ? (
                                <input
                                    type="number"
                                    className="w-full text-lg font-bold text-accent-greyDark bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-teal"
                                    value={weather?.temp || ''}
                                    onChange={e => handleFieldChange('temp', Number(e.target.value))}
                                />
                            ) : (
                                <p className="text-lg font-bold text-accent-greyDark">{weather?.temp || 0}°C</p>
                            )}
                        </div>
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-brand-teal/10">
                            <p className="text-[10px] text-gray-500 font-semibold mb-1 uppercase tracking-wider">Condition</p>
                            {isManual ? (
                                <input
                                    type="text"
                                    className="w-full text-base font-bold text-accent-greyDark bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-teal"
                                    value={weather?.condition || ''}
                                    onChange={e => handleFieldChange('condition', e.target.value)}
                                />
                            ) : (
                                <p className="text-base font-bold text-accent-greyDark">{weather?.condition || 'Unknown'}</p>
                            )}
                        </div>
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                            <p className="text-[10px] text-gray-500 font-semibold mb-1 uppercase tracking-wider">Humidity</p>
                            {isManual ? (
                                <input
                                    type="text"
                                    className="w-full text-base font-bold text-accent-greyDark bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-teal"
                                    value={weather?.humidity || ''}
                                    onChange={e => handleFieldChange('humidity', e.target.value)}
                                />
                            ) : (
                                <p className="text-base font-bold text-accent-greyDark">{weather?.humidity || 'N/A'}</p>
                            )}
                        </div>
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                            <p className="text-[10px] text-gray-500 font-semibold mb-1 uppercase tracking-wider">Wind</p>
                            {isManual ? (
                                <input
                                    type="text"
                                    className="w-full text-base font-bold text-accent-greyDark bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand-teal"
                                    value={weather?.wind || ''}
                                    onChange={e => handleFieldChange('wind', e.target.value)}
                                />
                            ) : (
                                <p className="text-base font-bold text-accent-greyDark">{weather?.wind || 'N/A'}</p>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
