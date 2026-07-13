import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, MessageSquare, AlertCircle, RefreshCw, Filter, User, HelpCircle, LayoutGrid, MapPin, Bell } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useStore } from '../store/useStore';
import { supabaseUntyped } from '../lib/supabase';

interface SurveyResponse {
    id: string;
    personnel_id: string | null;
    user_email: string | null;
    user_role: string;
    overall_rating: number;
    ease_of_use_rating: number;
    gps_issue: boolean | null;
    gps_comments: string | null;
    notifications_status: string | null;
    notifications_comments: string | null;
    friction_points: string | null;
    feature_requests: string | null;
    general_comments: string | null;
    created_at: string;
}

export default function SurveyResults() {
    const { t } = useTranslation();
    const { personnel } = useStore();
    
    const [responses, setResponses] = useState<SurveyResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters state
    const [selectedRole, setSelectedRole] = useState<string>('all');
    const [onlyWithComments, setOnlyWithComments] = useState<boolean>(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchErr } = await supabaseUntyped
                .from('user_feedback')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchErr) throw fetchErr;
            setResponses(data || []);
        } catch (err: any) {
            console.error('Error fetching survey results:', err);
            setError(err.message || 'Failed to load survey data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter responses
    const filteredResponses = responses.filter(r => {
        if (selectedRole !== 'all' && r.user_role.toLowerCase() !== selectedRole.toLowerCase()) {
            return false;
        }
        if (onlyWithComments) {
            const hasText = !!(
                r.gps_comments?.trim() ||
                r.notifications_comments?.trim() ||
                r.friction_points?.trim() ||
                r.feature_requests?.trim() ||
                r.general_comments?.trim()
            );
            const hasIssues = r.gps_issue === true || r.notifications_status === 'No';
            if (!hasText && !hasIssues) return false;
        }
        return true;
    });

    // Helper: Map personnel_id to name
    const getPersonnelName = (id: string | null, email: string | null) => {
        if (!id) return email || 'Anonymous';
        const person = personnel.find(p => p.id === id);
        return person ? person.name : email || 'Anonymous';
    };

    // Calculate metrics
    const totalCount = responses.length;
    const avgOverall = totalCount > 0 
        ? (responses.reduce((sum, r) => sum + r.overall_rating, 0) / totalCount).toFixed(1)
        : '0.0';
    const avgEase = totalCount > 0 
        ? (responses.reduce((sum, r) => sum + r.ease_of_use_rating, 0) / totalCount).toFixed(1)
        : '0.0';

    const gpsIssuesCount = responses.filter(r => r.gps_issue === true).length;
    const gpsIssuesRate = totalCount > 0 
        ? ((gpsIssuesCount / totalCount) * 100).toFixed(0)
        : '0';

    const notifsSuccessCount = responses.filter(r => r.notifications_status === 'Yes').length;
    const notifsSuccessRate = totalCount > 0 
        ? ((notifsSuccessCount / totalCount) * 100).toFixed(0)
        : '0';

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                        <LayoutGrid className="text-teal-600" size={32} />
                        {t('survey.dashboard_title', 'Resultados de la Encuesta de Usuario')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Encuesta de Experiencia de Usuario — LATNOVVA ServiceTool (Evaluación de 1 Mes)
                    </p>
                </div>
                <Button 
                    onClick={fetchData} 
                    disabled={loading}
                    variant="outline"
                    className="flex items-center gap-2 rounded-xl text-xs font-bold border-gray-200"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    {t('common.refresh', 'Actualizar')}
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <span className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></span>
                    <p className="text-sm text-gray-400 font-medium">{t('common.loading', 'Loading...')}</p>
                </div>
            ) : error ? (
                <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 p-6 text-red-700">
                    <AlertCircle size={24} />
                    <div>
                        <h4 className="font-bold">{t('common.error', 'Error')}</h4>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* KPI Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* Total Responses */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('survey.total_responses', 'Total Responses')}</span>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-3xl font-extrabold text-gray-800">{totalCount}</span>
                            </div>
                        </div>

                        {/* Avg Overall Experience */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('survey.avg_overall', 'Avg Experience')}</span>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-3xl font-extrabold text-gray-800">{avgOverall}</span>
                                <span className="text-xs text-gray-400 font-bold">/5</span>
                                <Star size={16} className="fill-yellow-400 text-yellow-400 ml-1 inline self-center" />
                            </div>
                        </div>

                        {/* Avg Ease of Use */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('survey.avg_ease', 'Avg Ease of Use')}</span>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-3xl font-extrabold text-gray-800">{avgEase}</span>
                                <span className="text-xs text-gray-400 font-bold">/5</span>
                                <Star size={16} className="fill-yellow-400 text-yellow-400 ml-1 inline self-center" />
                            </div>
                        </div>

                        {/* GPS Issues Rate */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('survey.gps_issues_rate', 'GPS Issues')}</span>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-3xl font-extrabold text-red-500">{gpsIssuesRate}%</span>
                                <span className="text-xs text-gray-400 font-semibold">({gpsIssuesCount} {gpsIssuesCount === 1 ? 'user' : 'users'})</span>
                            </div>
                        </div>

                        {/* Notification Success Rate */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('survey.notif_success_rate', 'Notifs Received')}</span>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-3xl font-extrabold text-emerald-500">{notifsSuccessRate}%</span>
                                <span className="text-xs text-gray-400 font-semibold">({notifsSuccessCount} {notifsSuccessCount === 1 ? 'user' : 'users'})</span>
                            </div>
                        </div>
                    </div>

                    {/* Filters bar */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2 self-start md:self-auto">
                            <Filter size={16} className="text-teal-600" />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t('common.filters', 'Filters')}</span>
                        </div>

                        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 items-stretch sm:items-center">
                            {/* Role filter */}
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-teal-400 transition-colors"
                            >
                                <option value="all">{t('survey.filter_all_roles', 'All Roles')}</option>
                                <option value="tech">Tech</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="manager">Manager</option>
                                <option value="hr">HR</option>
                            </select>

                            {/* Only with comments toggle */}
                            <button
                                onClick={() => setOnlyWithComments(!onlyWithComments)}
                                className={`text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 justify-center ${
                                    onlyWithComments
                                        ? 'bg-teal-50 border-teal-200 text-teal-700'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <MessageSquare size={16} />
                                {t('survey.filter_text_only', 'Only with text comments')}
                            </button>
                        </div>
                    </div>

                    {/* Responses List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                                {t('survey.responses_list', 'Survey Responses')} ({filteredResponses.length})
                            </h3>
                        </div>

                        {filteredResponses.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm max-w-md mx-auto">
                                <HelpCircle size={48} className="text-gray-300 mx-auto mb-3" />
                                <h4 className="text-base font-bold text-gray-800">{t('survey.no_results', 'No responses found')}</h4>
                                <p className="text-xs text-gray-400 mt-1">Try relaxing your filters or check back later.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {filteredResponses.map((res) => {
                                    const hasWrittenFeedback = !!(
                                        res.friction_points?.trim() ||
                                        res.feature_requests?.trim() ||
                                        res.general_comments?.trim()
                                    );

                                    return (
                                        <div key={res.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow">
                                            {/* Left sidebar - submitter detail */}
                                            <div className="p-6 bg-gray-50/50 md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-100 space-y-4 flex flex-col justify-between">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                                                            <User size={16} />
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <h4 className="text-sm font-bold text-gray-800 truncate" title={getPersonnelName(res.personnel_id, res.user_email)}>
                                                                {getPersonnelName(res.personnel_id, res.user_email)}
                                                            </h4>
                                                            <span className="text-[10px] font-extrabold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-wider mt-0.5 inline-block">
                                                                {res.user_role}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-gray-400 space-y-1">
                                                        <p className="font-semibold">{t('survey.submitted_by', 'Submitted')}:</p>
                                                        <p>{new Date(res.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                {/* Star stats */}
                                                <div className="space-y-2.5 pt-4 border-t border-gray-100/80">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-gray-400 font-semibold">Overall:</span>
                                                        <div className="flex items-center gap-1 font-bold text-gray-700">
                                                            <span>{res.overall_rating}</span>
                                                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-gray-400 font-semibold">Ease of Use:</span>
                                                        <div className="flex items-center gap-1 font-bold text-gray-700">
                                                            <span>{res.ease_of_use_rating}</span>
                                                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right side - detailed feedback answers */}
                                            <div className="p-6 flex-1 space-y-6">
                                                {/* Issues section */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {/* GPS Issue */}
                                                    <div className={`p-4 rounded-2xl border transition-all ${
                                                        res.gps_issue === true
                                                            ? 'bg-red-50/50 border-red-100 text-red-950'
                                                            : 'bg-gray-50/20 border-gray-100 text-gray-700'
                                                    }`}>
                                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                                                            <MapPin size={12} />
                                                            {t('survey.gps_issue_label', 'GPS Problem')}
                                                        </h5>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                                                                res.gps_issue === true
                                                                    ? 'bg-red-200 text-red-800'
                                                                    : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {res.gps_issue === true ? t('common.yes', 'Yes') : t('common.no', 'No')}
                                                            </span>
                                                            {res.gps_comments && (
                                                                <p className="text-xs font-semibold italic text-red-700 truncate max-w-[200px]" title={res.gps_comments}>
                                                                    — "{res.gps_comments}"
                                                                </p>
                                                            )}
                                                        </div>
                                                        {res.gps_comments && (
                                                            <p className="text-xs mt-2 font-medium bg-white/60 p-2 rounded-lg border border-red-100/50 text-red-800">
                                                                {res.gps_comments}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Notification Issue */}
                                                    <div className={`p-4 rounded-2xl border transition-all ${
                                                        res.notifications_status === 'No'
                                                            ? 'bg-red-50/50 border-red-100 text-red-950'
                                                            : 'bg-gray-50/20 border-gray-100 text-gray-700'
                                                    }`}>
                                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                                                            <Bell size={12} />
                                                            {t('survey.notif_issue_label', 'Notification Problem')}
                                                        </h5>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                                                                res.notifications_status === 'No'
                                                                    ? 'bg-red-200 text-red-800'
                                                                    : 'bg-emerald-100 text-emerald-800'
                                                            }`}>
                                                                {res.notifications_status === 'No' ? t('common.no', 'No') : t('common.yes', 'Yes')}
                                                            </span>
                                                            {res.notifications_comments && (
                                                                <p className="text-xs font-semibold italic text-red-700 truncate max-w-[200px]" title={res.notifications_comments}>
                                                                    — "{res.notifications_comments}"
                                                                </p>
                                                            )}
                                                        </div>
                                                        {res.notifications_comments && (
                                                            <p className="text-xs mt-2 font-medium bg-white/60 p-2 rounded-lg border border-red-100/50 text-red-800">
                                                                {res.notifications_comments}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Text feedback answers */}
                                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                                    {!hasWrittenFeedback ? (
                                                        <p className="text-xs font-medium text-gray-400 italic">
                                                            {t('survey.no_comments', 'No comments submitted')}
                                                        </p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            {/* Friction points */}
                                                            {res.friction_points?.trim() && (
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                                                                        {t('survey.friction_badge', 'Fricción')}
                                                                    </span>
                                                                    <p className="text-xs font-medium text-gray-700 leading-relaxed bg-gray-50/30 p-2.5 rounded-xl border border-gray-100/50 mt-1">
                                                                        {res.friction_points}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Feature requests */}
                                                            {res.feature_requests?.trim() && (
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">
                                                                        {t('survey.feature_badge', 'Propuesta')}
                                                                    </span>
                                                                    <p className="text-xs font-medium text-gray-700 leading-relaxed bg-gray-50/30 p-2.5 rounded-xl border border-gray-100/50 mt-1">
                                                                        {res.feature_requests}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* General comments */}
                                                            {res.general_comments?.trim() && (
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                                                        {t('survey.general_badge', 'General')}
                                                                    </span>
                                                                    <p className="text-xs font-medium text-gray-700 leading-relaxed bg-gray-50/30 p-2.5 rounded-xl border border-gray-100/50 mt-1">
                                                                        {res.general_comments}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
