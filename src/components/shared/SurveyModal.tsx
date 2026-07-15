import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star, AlertCircle, CheckCircle2, ThumbsUp, X, MessageSquare, ChevronRight, ChevronLeft, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useStore } from '../../store/useStore';
import { supabaseUntyped } from '../../lib/supabase';

interface SurveyModalProps {
    forceOpen?: boolean;
    onCloseForce?: () => void;
}

type StepType = 'prompt' | 'step1' | 'step2' | 'step3' | 'success';

export default function SurveyModal({ forceOpen = false, onCloseForce }: SurveyModalProps) {
    const { t } = useTranslation();
    const location = useLocation();
    const { userRole, personnel } = useStore();
    
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<StepType>('prompt');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form fields
    const [overallRating, setOverallRating] = useState<number>(0);
    const [easeRating, setEaseRating] = useState<number>(0);
    const [gpsIssue, setGpsIssue] = useState<boolean | null>(null);
    const [gpsComments, setGpsComments] = useState('');
    const [notificationsStatus, setNotificationsStatus] = useState<string>(''); // 'Yes', 'No'
    const [notificationsComments, setNotificationsComments] = useState('');
    const [frictionPoints, setFrictionPoints] = useState('');
    const [featureRequests, setFeatureRequests] = useState('');
    const [generalComments, setGeneralComments] = useState('');

    const [overallHover, setOverallHover] = useState(0);
    const [easeHover, setEaseHover] = useState(0);

    // Determine if modal should open automatically
    useEffect(() => {
        let active = true;
        let timerId: any = null;

        if (forceOpen) {
            setIsOpen(true);
            setStep('step1'); // Go straight to step1 if manually forced
            return;
        }

        const checkCompleted = async () => {
            const surveyStatus = localStorage.getItem('survey_status');
            const sessionDismissed = sessionStorage.getItem('survey_dismissed_session') === 'true';

            // If locally marked as completed/dont_ask, skip database check
            if (surveyStatus === 'completed' || surveyStatus === 'dont_ask') {
                return;
            }

            if (sessionDismissed) {
                return;
            }

            // Check database to see if they've already submitted a response
            try {
                const myPersonId = useStore.getState().resolvePersonnelId();
                const personRecord = personnel.find(p => p.id === myPersonId);
                const userEmail = personRecord?.email || '';

                if (myPersonId || userEmail) {
                    let query = supabaseUntyped.from('user_feedback').select('id');
                    
                    if (myPersonId) {
                        query = query.eq('personnel_id', myPersonId);
                    } else {
                        query = query.eq('user_email', userEmail);
                    }

                    const { data, error } = await query.limit(1);
                    if (active && !error && data && data.length > 0) {
                        localStorage.setItem('survey_status', 'completed');
                        return;
                    }
                }
            } catch (e) {
                console.error('Error checking feedback status from DB:', e);
            }

            if (!active) return;

            // Show on sign-in (if not dismissed in current session) or force-show when entering clock-in
            const isClockInPage = location.pathname === '/clock-in';
            
            if (isClockInPage) {
                setIsOpen(true);
                setStep('prompt');
            } else {
                timerId = setTimeout(() => {
                    setIsOpen(true);
                    setStep('prompt');
                }, 3000);
            }
        };

        checkCompleted();

        return () => {
            active = false;
            if (timerId) clearTimeout(timerId);
        };
    }, [location.pathname, forceOpen, personnel]);

    const handleDismissSession = () => {
        sessionStorage.setItem('survey_dismissed_session', 'true');
        setIsOpen(false);
        if (onCloseForce) onCloseForce();
    };

    const handleDismissPermanently = () => {
        localStorage.setItem('survey_status', 'dont_ask');
        setIsOpen(false);
        if (onCloseForce) onCloseForce();
    };

    const handleNext = () => {
        setError(null);
        if (step === 'step1') {
            if (overallRating === 0 || easeRating === 0) {
                setError(t('survey.error_ratings', 'Please provide ratings for overall experience and ease of use.'));
                return;
            }
            setStep('step2');
        } else if (step === 'step2') {
            setStep('step3');
        }
    };

    const handleBack = () => {
        setError(null);
        if (step === 'step2') setStep('step1');
        else if (step === 'step3') setStep('step2');
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);

        try {
            const myPersonId = useStore.getState().resolvePersonnelId();
            const personRecord = personnel.find(p => p.id === myPersonId);
            const userEmail = personRecord?.email || '';

            const { error: submitError } = await supabaseUntyped
                .from('user_feedback')
                .insert({
                    personnel_id: myPersonId || null,
                    user_email: userEmail || null,
                    user_role: userRole || 'Unknown',
                    overall_rating: overallRating,
                    ease_of_use_rating: easeRating,
                    gps_issue: gpsIssue,
                    gps_comments: gpsIssue === true ? gpsComments : null,
                    notifications_status: notificationsStatus || null,
                    notifications_comments: notificationsStatus === 'No' ? notificationsComments : null,
                    friction_points: frictionPoints || null,
                    feature_requests: featureRequests || null,
                    general_comments: generalComments || null
                });

            if (submitError) throw submitError;

            localStorage.setItem('survey_status', 'completed');
            setStep('success');
        } catch (err: any) {
            console.error('Error submitting feedback:', err);
            setError(err.message || 'Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                handleDismissSession();
            }
        }}>
            <DialogContent className="max-w-xl rounded-3xl border-0 bg-white p-0 shadow-2xl overflow-hidden">
                {/* Header Graphic */}
                <div className="relative bg-gradient-to-r from-teal-500 to-emerald-500 py-6 text-white flex items-center justify-center gap-3">
                    <button 
                        onClick={handleDismissSession}
                        className="absolute right-4 top-4 rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-all outline-none"
                    >
                        <X size={16} />
                    </button>
                    <span className="text-3xl" role="img" aria-label="star">⭐</span>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {step === 'success' ? t('survey.thank_you', 'Thank You!') : t('survey.title', 'Help Us Improve')}
                    </h2>
                </div>

                {/* Wizard Steps Tracker (Shown only during active survey steps) */}
                {step !== 'prompt' && step !== 'success' && (
                    <div className="bg-gray-50/50 border-b border-gray-100 px-6 py-3 flex justify-between items-center text-xs text-gray-400 font-semibold">
                        <span>{t('survey.subtitle', 'LATNOVVA ServiceTool Check-In')}</span>
                        <div className="flex gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step === 'step1' ? 'bg-teal-500 scale-110' : 'bg-gray-200'}`}></span>
                            <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step === 'step2' ? 'bg-teal-500 scale-110' : 'bg-gray-200'}`}></span>
                            <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step === 'step3' ? 'bg-teal-500 scale-110' : 'bg-gray-200'}`}></span>
                        </div>
                    </div>
                )}

                <div className="p-6">
                    {error && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-600 border border-red-100">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Part 0: Prompt Section */}
                    {step === 'prompt' && (
                        <div className="space-y-6 text-center py-4">
                            <div className="mx-auto w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
                                <ClipboardList size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-800">
                                    {t('survey.prompt_title', 'Do you have 2 minutes to complete the survey?')}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                                    {t('survey.prompt_desc', 'Your feedback is highly valuable to improve the application and optimize your daily workflow.')}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 pt-4">
                                <Button 
                                    onClick={() => setStep('step1')} 
                                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-semibold py-6 rounded-xl hover:from-teal-600 hover:to-emerald-600 transition-all shadow-md"
                                >
                                    {t('survey.btn_start', 'Yes, start')}
                                </Button>
                                <div className="flex gap-2 justify-between mt-2">
                                    <button 
                                        onClick={handleDismissPermanently} 
                                        className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors py-2 px-3 hover:bg-red-55 rounded-lg"
                                    >
                                        {t('survey.btn_never', "Don't Remind")}
                                    </button>
                                    <button 
                                        onClick={handleDismissSession} 
                                        className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors py-2 px-3 hover:bg-gray-50 rounded-lg"
                                    >
                                        {t('survey.btn_later', 'Later')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 1: Quick Ratings */}
                    {step === 'step1' && (
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-xs font-extrabold text-teal-600 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                    {t('survey.sec_ratings', 'Part 1: Quick Ratings')}
                                </h3>
                                <p className="text-xs text-gray-400">{t('survey.scale_note', '(Where 5 is best)')}</p>
                            </div>

                            {/* Q1: Overall Experience */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800 block leading-snug">
                                    {t('survey.q_overall', '1. Overall Experience: How would you rate your overall experience?')} <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-1.5 pt-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setOverallRating(star)}
                                            onMouseEnter={() => setOverallHover(star)}
                                            onMouseLeave={() => setOverallHover(0)}
                                            className="p-1 hover:scale-110 transition-transform outline-none"
                                        >
                                            <Star
                                                size={28}
                                                className={`transition-colors duration-200 ${
                                                    star <= (overallHover || overallRating)
                                                        ? 'fill-yellow-400 text-yellow-400'
                                                        : 'text-gray-200'
                                                }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q2: Ease of Use */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800 block leading-snug">
                                    {t('survey.q_ease', '2. Ease of Use: How intuitive is the navigation and menu layout?')} <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-1.5 pt-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setEaseRating(star)}
                                            onMouseEnter={() => setEaseHover(star)}
                                            onMouseLeave={() => setEaseHover(0)}
                                            className="p-1 hover:scale-110 transition-transform outline-none"
                                        >
                                            <Star
                                                size={28}
                                                className={`transition-colors duration-200 ${
                                                    star <= (easeHover || easeRating)
                                                        ? 'fill-yellow-400 text-yellow-400'
                                                        : 'text-gray-200'
                                                }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Footer Buttons Step 1 */}
                            <div className="flex gap-3 justify-end pt-5 border-t border-gray-100 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('prompt')}
                                    className="text-xs font-bold text-gray-500 border-gray-200 rounded-xl px-4 py-4 flex items-center gap-1.5"
                                >
                                    <ChevronLeft size={16} />
                                    <span>{t('common.back', 'Back')}</span>
                                </Button>
                                <Button
                                    onClick={handleNext}
                                    className="bg-brand-teal hover:bg-brand-teal/90 text-white font-bold px-6 py-5 rounded-xl flex items-center justify-center gap-2 shadow-md"
                                >
                                    <span>{t('common.next', 'Next')}</span>
                                    <ChevronRight size={16} />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Actions & Permissions */}
                    {step === 'step2' && (
                        <div className="space-y-6">
                            <h3 className="text-xs font-extrabold text-teal-600 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                {t('survey.sec_permissions', 'Part 2: GPS & Notifications')}
                            </h3>

                            {/* Q3: GPS Issues */}
                            <div className="space-y-2.5">
                                <label className="text-sm font-bold text-gray-800 block leading-snug">
                                    {t('survey.q_gps', '3. GPS Pin/Map: Have you had any issues with the GPS function?')}
                                </label>
                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setGpsIssue(true)}
                                        className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm border transition-all ${
                                            gpsIssue === true
                                                ? 'bg-gray-100 border-gray-400 text-gray-900 shadow-sm font-extrabold'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50/50'
                                        }`}
                                    >
                                        {t('common.yes', 'Yes')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGpsIssue(false)}
                                        className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm border transition-all ${
                                            gpsIssue === false
                                                ? 'bg-gray-100 border-gray-400 text-gray-900 shadow-sm font-extrabold'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50/50'
                                        }`}
                                    >
                                        {t('common.no', 'No')}
                                    </button>
                                </div>
                                {gpsIssue === true && (
                                    <Textarea
                                        placeholder={t('survey.gps_comments_placeholder', 'Describe GPS issues...')}
                                        value={gpsComments}
                                        onChange={(e) => setGpsComments(e.target.value)}
                                        className="mt-2 rounded-xl text-sm border-gray-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
                                        rows={2.5}
                                    />
                                )}
                            </div>

                            {/* Q4: Notifications */}
                            <div className="space-y-2.5">
                                <label className="text-sm font-bold text-gray-800 block leading-snug">
                                    {t('survey.q_notifications', '4. Notifications: Have you successfully received daily start and finish shift notifications on your device?')}
                                </label>
                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setNotificationsStatus('Yes')}
                                        className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm border transition-all ${
                                            notificationsStatus === 'Yes'
                                                ? 'bg-gray-100 border-gray-400 text-gray-900 shadow-sm font-extrabold'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50/50'
                                        }`}
                                    >
                                        {t('common.yes', 'Yes')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNotificationsStatus('No')}
                                        className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm border transition-all ${
                                            notificationsStatus === 'No'
                                                ? 'bg-gray-100 border-gray-400 text-gray-900 shadow-sm font-extrabold'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50/50'
                                        }`}
                                    >
                                        {t('common.no', 'No')}
                                    </button>
                                </div>
                                {notificationsStatus === 'No' && (
                                    <Textarea
                                        placeholder={t('survey.notifications_comments_placeholder', 'Describe notification issues...')}
                                        value={notificationsComments}
                                        onChange={(e) => setNotificationsComments(e.target.value)}
                                        className="mt-2 rounded-xl text-sm border-gray-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
                                        rows={2.5}
                                    />
                                )}
                            </div>

                            {/* Footer Buttons Step 2 */}
                            <div className="flex gap-3 justify-end pt-5 border-t border-gray-100 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={handleBack}
                                    className="text-xs font-bold text-gray-500 border-gray-200 rounded-xl px-4 py-4 flex items-center gap-1.5"
                                >
                                    <ChevronLeft size={16} />
                                    <span>{t('common.back', 'Back')}</span>
                                </Button>
                                <Button
                                    onClick={handleNext}
                                    className="bg-brand-teal hover:bg-brand-teal/90 text-white font-bold px-6 py-5 rounded-xl flex items-center justify-center gap-2 shadow-md"
                                >
                                    <span>{t('common.next', 'Next')}</span>
                                    <ChevronRight size={16} />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Open Feedback */}
                    {step === 'step3' && (
                        <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
                            <h3 className="text-xs font-extrabold text-teal-600 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                {t('survey.sec_feedback', 'Part 3: Open Feedback')}
                            </h3>

                            {/* Q5: Friction Points */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-800 block leading-snug">
                                    {t('survey.q_friction', '5. Friction Points: What is the most frustrating part of using the app today?')}
                                </label>
                                <Textarea
                                    value={frictionPoints}
                                    onChange={(e) => setFrictionPoints(e.target.value)}
                                    className="rounded-xl text-sm border-gray-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
                                    rows={2.5}
                                    placeholder="Share your thoughts..."
                                />
                            </div>

                            {/* Q6: Feature Requests */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-800 block leading-snug">
                                    {t('survey.q_feature', '6. Feature Requests: What is one feature or page you wish the app had to make your workday easier?')}
                                </label>
                                <Textarea
                                    value={featureRequests}
                                    onChange={(e) => setFeatureRequests(e.target.value)}
                                    className="rounded-xl text-sm border-gray-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
                                    rows={2.5}
                                    placeholder="Tell us more..."
                                />
                            </div>

                            {/* Q7: General Comments */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-800 block leading-snug">
                                    {t('survey.q_general', "7. General Comments: Any other suggestions or issues you've encountered?")}
                                </label>
                                <Textarea
                                    value={generalComments}
                                    onChange={(e) => setGeneralComments(e.target.value)}
                                    className="rounded-xl text-sm border-gray-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
                                    rows={2.5}
                                    placeholder="Any other comments or suggestions..."
                                />
                            </div>

                            {/* Footer Buttons Step 3 */}
                            <div className="flex gap-3 justify-end pt-5 border-t border-gray-100 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={handleBack}
                                    disabled={submitting}
                                    className="text-xs font-bold text-gray-500 border-gray-200 rounded-xl px-4 py-4 flex items-center gap-1.5"
                                >
                                    <ChevronLeft size={16} />
                                    <span>{t('common.back', 'Back')}</span>
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-5 rounded-xl flex items-center justify-center gap-2 shadow-md"
                                >
                                    {submitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            {t('common.submitting', 'Submitting...')}
                                        </>
                                    ) : (
                                        <>
                                            <MessageSquare size={16} />
                                            {t('survey.btn_submit', 'Send')}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="space-y-6 text-center py-6">
                            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 animate-bounce">
                                <CheckCircle2 size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-extrabold text-gray-800">
                                    {t('survey.success_title', 'Feedback Received!')}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                                    {t('survey.success_desc', "Thank you for helping us improve. Your feedback has been sent directly to the development team to make your workday run smoother.")}
                                </p>
                            </div>
                            <div className="pt-4 max-w-xs mx-auto">
                                <Button
                                    onClick={() => {
                                        setIsOpen(false);
                                        if (onCloseForce) onCloseForce();
                                    }}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-xl shadow-md flex items-center justify-center gap-2"
                                >
                                    <ThumbsUp size={16} role="img" aria-label="thumbs up" />
                                    {t('common.close', 'Close')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
