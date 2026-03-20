import { useState } from 'react';
import { Plus, Search, CheckSquare, Trash2, ListChecks } from 'lucide-react';
import { useStore, ChecklistTemplate } from '../store/useStore';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';

export default function Templates() {
    const { templates, addTemplate, deleteTemplate } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [newTemplate, setNewTemplate] = useState<{ name: string; items: string[] }>({
        name: '',
        items: [''],
    });

    const handleAddTemplate = () => {
        if (!newTemplate.name.trim() || newTemplate.items.every(i => !i.trim())) return;

        const template: ChecklistTemplate = {
            id: `TPL-${Date.now()}`,
            name: newTemplate.name,
            items: newTemplate.items.filter(i => i.trim() !== ''),
        };
        addTemplate(template);
        setNewTemplate({ name: '', items: [''] });
        setIsAddModalOpen(false);
    };

    const handleItemChange = (index: number, value: string) => {
        const newItems = [...newTemplate.items];
        newItems[index] = value;
        setNewTemplate({ ...newTemplate, items: newItems });
    };

    const handleAddItemField = () => {
        setNewTemplate({ ...newTemplate, items: [...newTemplate.items, ''] });
    };

    const handleRemoveItemField = (index: number) => {
        const newItems = newTemplate.items.filter((_, i) => i !== index);
        setNewTemplate({ ...newTemplate, items: newItems.length ? newItems : [''] });
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <CheckSquare className="text-brand-teal" size={32} />
                        Checklist Templates
                    </h1>
                    <p className="text-accent-grey mt-1">Manage reusable checklist templates for reports.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Find a template..."
                            className="pl-10 w-full md:w-80 bg-white border-gray-200 focus-visible:ring-brand-teal h-11 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-semibold shadow-soft h-11 px-6">
                                <Plus size={18} /> Add Template
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] rounded-2xl p-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-accent-greyDark">Create Template</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark text-left block">Template Name</label>
                                    <Input
                                        placeholder="e.g. Substation Commissioning"
                                        value={newTemplate.name}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                        className="rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-accent-greyDark text-left block flex justify-between items-center">
                                        Checklist Items
                                        <Button variant="outline" size="sm" onClick={handleAddItemField} className="h-7 text-xs px-2">
                                            <Plus size={14} className="mr-1" /> Add Item
                                        </Button>
                                    </label>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                        {newTemplate.items.map((item, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        placeholder={`Item ${index + 1}`}
                                                        value={item}
                                                        onChange={(e) => handleItemChange(index, e.target.value)}
                                                        className="rounded-xl border-gray-200"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveItemField(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button className="w-full mt-4 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAddTemplate}>
                                    Save Template
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map(template => (
                    <div key={template.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft flex flex-col hover:border-brand-teal/30 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-brand-teal/10 text-brand-teal rounded-xl">
                                    <ListChecks size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-accent-greyDark text-lg">{template.name}</h3>
                                    <p className="text-sm text-gray-400">{template.items.length} items</p>
                                </div>
                            </div>
                            <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" onClick={() => deleteTemplate(template.id)}>
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 flex-1 mt-2">
                            {template.items.slice(0, 4).map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <div className="mt-0.5 w-3 h-3 border border-gray-300 rounded flex-shrink-0 bg-white"></div>
                                    <span className="leading-tight">{item}</span>
                                </div>
                            ))}
                            {template.items.length > 4 && (
                                <p className="text-xs text-brand-teal font-medium mt-2 pl-1">
                                    + {template.items.length - 4} more items...
                                </p>
                            )}
                        </div>
                    </div>
                ))}
                {filteredTemplates.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                        <CheckSquare size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-500">No templates found</h3>
                        <p className="text-gray-400">Try adjusting your search or create a new template.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
