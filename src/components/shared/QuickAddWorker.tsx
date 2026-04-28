import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertTriangle, UserPlus } from 'lucide-react';

interface QuickAddWorkerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (personId: string, name: string, role: string) => void;
}

export default function QuickAddWorker({ open, onOpenChange, onSuccess }: QuickAddWorkerProps) {
    const { t } = useTranslation();
    const { addPersonnel } = useStore();
    const [name, setName] = useState('');
    const [role, setRole] = useState('');

    const handleAdd = () => {
        if (!name.trim()) return;
        
        // Enforce TEMP- prefix for IDs and Employee Numbers (M-02)
        const newId = `TEMP-${crypto.randomUUID()}`;
        const employeeNumber = `TEMP-${Math.floor(Math.random() * 9000) + 1000}`;
        
        addPersonnel({
            id: newId,
            name: name.trim(),
            position: role.trim() || 'Technician',
            employeeNumber,
            status: 'Active',
            appRole: 'Tech',
            certifications: [],
        });

        onSuccess(newId, name.trim(), role.trim() || 'Technician');
        onOpenChange(false);
        setName('');
        setRole('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] rounded-3xl p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-accent-greyDark">
                        <UserPlus className="text-brand-teal" size={24} />
                        {t('reports.labor_section.quick_add_title', 'Quick-Add Team Member')}
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-5">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">{t('reports.labor_section.full_name_label', 'Full Name')}</Label>
                        <Input 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g. Michael Scott"
                            className="h-11 rounded-xl border-gray-200 focus:ring-brand-teal"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">{t('reports.labor_section.position_label', 'Position')}</Label>
                        <Input 
                            value={role} 
                            onChange={e => setRole(e.target.value)} 
                            placeholder="e.g. Electrician"
                            className="h-11 rounded-xl border-gray-200 focus:ring-brand-teal"
                        />
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed font-medium">
                             {t('reports.labor_section.quick_add_help', 'Newly added personnel will be flagged as "TEMP". Full profile details and certifications should be updated later in the Personnel menu.')}
                        </p>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold">
                        {t('common.cancel')}
                    </Button>
                    <Button 
                        onClick={handleAdd} 
                        className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 px-6 font-bold shadow-soft transition-all active:scale-95" 
                        disabled={!name.trim()}
                    >
                        {t('reports.labor_section.add_select_btn', 'Add & Select')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
