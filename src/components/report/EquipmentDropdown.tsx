import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';

interface EquipmentDropdownProps {
    onAdd: (equipmentType: string, serial: string) => void;
    readOnly: boolean;
}

const FLEET_INVENTORY = [
    { type: 'Excavator CAT 320', prefix: 'EXC-' },
    { type: 'Bulldozer D6', prefix: 'BDZ-' },
    { type: 'Crane 50T', prefix: 'CRN-' },
    { type: 'Generator 500kVA', prefix: 'GEN-' },
    { type: 'Solar Panel Array Tooling', prefix: 'SPA-' }
];

export default function EquipmentDropdown({ onAdd, readOnly }: EquipmentDropdownProps) {
    const [selectedType, setSelectedType] = useState<string>('');

    const handleAdd = () => {
        if (!selectedType) return;
        const inv = FLEET_INVENTORY.find(i => i.type === selectedType);
        if (inv) {
            const mockSerial = `${inv.prefix}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
            onAdd(inv.type, mockSerial);
            setSelectedType(''); // Reset
        }
    };

    if (readOnly) return null;

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1">
                <Select value={selectedType} onValueChange={setSelectedType} disabled={readOnly}>
                    <SelectTrigger className="bg-white border-gray-200 focus:ring-brand-teal h-10 w-full rounded-xl">
                        <SelectValue placeholder="Select fleet inventory to add manually..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                        {FLEET_INVENTORY.map((item) => (
                            <SelectItem key={item.type} value={item.type}>
                                {item.type}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button
                onClick={handleAdd}
                disabled={!selectedType || readOnly}
                className="bg-gray-100 hover:bg-gray-200 text-accent-greyDark shadow-none border border-gray-200 h-10 px-4 rounded-xl flex items-center gap-2 font-semibold"
            >
                <Plus size={16} /> Add
            </Button>
        </div>
    );
}
