import { Client, Project, Personnel, Tool, TimesheetEntry, Report } from './useStore';

export const mockClients: Client[] = [
    { id: 'CUST_SUNGROW', name: 'SUNGROW', logo: 'https://ui-avatars.com/api/?name=SUNGROW&background=F59E0B&color=fff' },
    { id: 'CUST_SAFT', name: 'SAFT', logo: 'https://ui-avatars.com/api/?name=SAFT&background=10B981&color=fff' },
    { id: 'CUST_POWER_ELEC', name: 'Power Electronics', logo: 'https://ui-avatars.com/api/?name=Power+Electronics&background=3B82F6&color=fff' },
    { id: 'CUST_FERROVIAL', name: 'Ferrovial', logo: 'https://ui-avatars.com/api/?name=Ferrovial&background=EF4444&color=fff' },
    { id: 'CUST_CEN', name: 'CEN Solutions', logo: 'https://ui-avatars.com/api/?name=CEN+Solutions&background=8B5CF6&color=fff' },
    { id: 'CUST_COBRA', name: 'Grupo Cobra', logo: 'https://ui-avatars.com/api/?name=Grupo+Cobra&background=059669&color=fff' },
    { id: 'CUST_CFE', name: 'CFE', logo: 'https://ui-avatars.com/api/?name=CFE&background=065F46&color=fff' },
    { id: 'CUST_NEXTERA', name: 'NextEra', logo: 'https://ui-avatars.com/api/?name=NextEra&background=1E3A8A&color=fff' },
    { id: 'CUST_TERNI', name: 'Terni-Energia', logo: 'https://ui-avatars.com/api/?name=Terni-Energia&background=7C2D12&color=fff' },
    { id: 'CUST_NOVASOURCE', name: 'NovaSource', logo: 'https://ui-avatars.com/api/?name=NovaSource&background=4C1D95&color=fff' },
    { id: 'CUST_GREENSOL', name: 'Greensol', logo: 'https://ui-avatars.com/api/?name=Greensol&background=10B981&color=fff' },
    { id: 'CUST_AES', name: 'AES', logo: 'https://ui-avatars.com/api/?name=AES&background=2563EB&color=fff' },
    { id: 'CUST_EURUS', name: 'EURUS ENERGY', logo: 'https://ui-avatars.com/api/?name=EURUS+ENERGY&background=D97706&color=fff' },
    { id: 'CUST_TESLA', name: 'Tesla', logo: 'https://ui-avatars.com/api/?name=Tesla&background=DC2626&color=fff' },
    { id: 'CUST_ORTIZ', name: 'Grupo Ortiz', logo: 'https://ui-avatars.com/api/?name=Grupo+Ortiz&background=4B5563&color=fff' },
    { id: 'CUST_TSK', name: 'TSK', logo: 'https://ui-avatars.com/api/?name=TSK&background=7C3AED&color=fff' },
];

export const mockPersonnel: Personnel[] = [
    { id: 'PERS-SV1', name: 'RICARDO OLIVA', position: 'TEAM LEADER', employeeNumber: 'EMP-SV01', appRole: 'Supervisor', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-SV2', name: 'PEDRO LUIS RAMIREZ MORENO', position: 'TECHNICIAN', employeeNumber: 'EMP-SV02', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-SV3', name: 'JUAN ALBERTO GARCIA SARIOL', position: 'TECHNICIAN', employeeNumber: 'EMP-SV03', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-SV4', name: 'JORGE LUIS CALDERON PEREZ', position: 'TECHNICIAN', employeeNumber: 'EMP-SV04', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-TW1', name: 'MAYLENE TORRES MALDONADO', position: 'TEAM LEADER', employeeNumber: 'EMP-TW01', appRole: 'Supervisor', status: 'Active', certifications: [] },
    { id: 'PERS-TW2', name: 'LAZARO RODRIGUEZ MARTINEZ', position: 'ASSEMBLER', employeeNumber: 'EMP-TW02', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF1', name: 'SEBASTIAN YANCA', position: 'TEAM LEADER', employeeNumber: 'EMP-BF01', appRole: 'Supervisor', status: 'Active', certifications: [] },
    { id: 'PERS-BF2', name: 'JOHN ANTHONY AGUILAR JR', position: 'TECHNICIAN', employeeNumber: 'EMP-BF02', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF3', name: 'JUAN GONZALEZ', position: 'TECHNICIAN', employeeNumber: 'EMP-BF03', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF4', name: 'EDIAGNEL RIVERA', position: 'TECHNICIAN', employeeNumber: 'EMP-BF04', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF5', name: 'BRAINE GAMBOA', position: 'TECHNICIAN', employeeNumber: 'EMP-BF05', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF6', name: 'RICHARD RADAMES NUNES ROMERO', position: 'ASSEMBLER', employeeNumber: 'EMP-BF06', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF7', name: 'JOSHUA SANCHEZ', position: 'TECHNICIAN', employeeNumber: 'EMP-BF07', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF8', name: 'VINCENT TORRES MALDONADO', position: 'ASSEMBLER', employeeNumber: 'EMP-BF08', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF9', name: 'ARIEL CABALLERO', position: 'ASSEMBLER', employeeNumber: 'EMP-BF09', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF10', name: 'FRANCISCO MARTINEZ MARRERO', position: 'ASSEMBLER', employeeNumber: 'EMP-BF10', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF11', name: 'JOSE LOPEZ', position: 'TECHNICIAN', employeeNumber: 'EMP-BF11', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF12', name: 'GEORDANIS RODRIGUEZ', position: 'ASSEMBLER', employeeNumber: 'EMP-BF12', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF13', name: 'LUIS ANGEL GONZALEZ ROMERO', position: 'ASSEMBLER', employeeNumber: 'EMP-BF13', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BF14', name: 'CRISTIAN FURE HERNANDEZ', position: 'ASSEMBLER', employeeNumber: 'EMP-BF14', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-AL1', name: 'JESUS ORTEGA', position: 'TECHNICIAN', employeeNumber: 'EMP-AL01', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-AL2', name: 'ADRIAN RASCON', position: 'TECHNICIAN', employeeNumber: 'EMP-AL02', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-PR1', name: 'JAIME VAZQUEZ', position: 'SUPERVISOR', employeeNumber: 'EMP-PR01', appRole: 'Supervisor', status: 'Active', certifications: [] },
    { id: 'PERS-BY1', name: 'MILDRED BAYARD BOLANOS', position: 'ASSEMBLER', employeeNumber: 'EMP-BY01', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-BY2', name: 'MARIN LEDEZMA SALAYA', position: 'OPERATION LEADER', employeeNumber: 'EMP-BY02', appRole: 'Supervisor', status: 'Active', certifications: [] },
    { id: 'PERS-DOE', name: 'JOHN DOE', position: 'FIELD SUPPORT', employeeNumber: 'EMP-999', appRole: 'Tech', status: 'Active', certifications: [] },
];

export const mockProjects: Project[] = [
    { id: 'P0001', clientId: 'CUST_CEN', name: 'Bellefield II Solar', type: 'Complete', status: 'Active', projectSize: '200MW', systemType: 'Solar', progress: 45, location: '35.0117,-118.0638', assignedPersonnel: ['PERS-BF1', 'PERS-BF2', 'PERS-BF3', 'PERS-BF4', 'PERS-BF5', 'PERS-BF6', 'PERS-BF7', 'PERS-BF8', 'PERS-BF9', 'PERS-BF10', 'PERS-BF11', 'PERS-BF12', 'PERS-BF13', 'PERS-BF14'], scopes: [] },
    { id: 'P0002', clientId: 'CUST_POWER_ELEC', name: 'Thundervolt Solar', type: 'Complete', status: 'Active', projectSize: '300MW', systemType: 'Solar', progress: 45, location: '33.4354,-112.3406', assignedPersonnel: ['PERS-TW1', 'PERS-TW2'], scopes: [] },
    { id: 'P0003', clientId: 'CUST_CEN', name: 'Alamito Solar', type: 'Complete', status: 'Active', projectSize: '150MW', systemType: 'Solar', progress: 45, location: '32.09,-96.38', assignedPersonnel: ['PERS-AL1', 'PERS-AL2'], scopes: [] },
    { id: 'P0004', clientId: 'CUST_COBRA', name: 'Byrum Solar', type: 'Complete', status: 'Active', projectSize: '100MW', systemType: 'Solar', progress: 45, location: '31.39,-97.55', assignedPersonnel: ['PERS-BY1', 'PERS-BY2'], scopes: [] },
    { id: 'P0005', clientId: 'CUST_POWER_ELEC', name: 'Sun Valley Solar', type: 'Complete', status: 'Active', projectSize: '200MW', systemType: 'Solar', progress: 45, location: '31.8675,-97.0740', assignedPersonnel: ['PERS-SV1', 'PERS-SV2', 'PERS-SV3', 'PERS-SV4'], scopes: [] },
    { id: 'P0006', clientId: 'CUST_SUNGROW', name: 'PPA Sierra Gorda', type: 'Simple', status: 'Completed', projectSize: '440MW', systemType: 'Solar', progress: 100, location: '-22.8986,-68.32', assignedPersonnel: [], scopes: [] },
    { id: 'P0007', clientId: 'CUST_SUNGROW', name: 'PFV Guajapo', type: 'Simple', status: 'Completed', projectSize: '330MW', systemType: 'Solar', progress: 100, location: '10.3948,-74.9385', assignedPersonnel: [], scopes: [] },
    { id: 'P0008', clientId: 'CUST_SUNGROW', name: 'PFV La Union', type: 'Simple', status: 'Completed', projectSize: '80MW', systemType: 'Solar', progress: 100, location: '10.9,-74.3', assignedPersonnel: [], scopes: [] },
    { id: 'P0132', clientId: 'CUST_SAFT', name: 'AES Guayama Power Complex', type: 'Complete', status: 'Active', projectSize: '100MW', systemType: 'Other', progress: 45, location: '17.9632,-66.1110', assignedPersonnel: ['PERS-PR1'], scopes: [] },
    { id: 'P0133', clientId: 'CUST_GREENSOL', name: 'Murch Solar PV', type: 'Complete', status: 'Active', projectSize: '100MW', systemType: 'Construction', progress: 45, location: '42.1880,-86.0300', assignedPersonnel: [], scopes: [] },
    // Simplified bulk projects to reach high count
    ...Array.from({ length: 123 }).map((_, i) => ({
        id: `P${(i + 9).toString().padStart(4, '0')}`,
        clientId: 'Unknown' as string,
        name: `Asset ${i + 9}`,
        type: 'Simple' as const,
        status: 'Completed' as const,
        projectSize: '100MW',
        systemType: 'Solar',
        progress: 100,
        location: `${30 + (i * 0.1)},${-100 + (i * 0.1)}`,
        assignedPersonnel: [],
        scopes: []
    }))
];

function calcHours(timeIn: string, timeOut: string): number {
    const [inH, inM] = timeIn.split(':').map(Number);
    const [outH, outM] = timeOut.split(':').map(Number);
    return parseFloat(((outH * 60 + outM - inH * 60 - inM) / 60).toFixed(1));
}

const projectShifts: Record<string, { timeIn: string; timeOut: string }> = {
    'P0001': { timeIn: '08:00', timeOut: '17:30' },
    'P0002': { timeIn: '08:15', timeOut: '17:00' },
    'P0005': { timeIn: '08:00', timeOut: '18:00' },
};

export const mockReports: Report[] = mockProjects.flatMap((p) => {
    const isKnown = p.clientId !== 'Unknown';
    const isActive = p.status === 'Active';
    const count = isKnown ? (isActive ? 30 : 2) : 1;
    const shift = projectShifts[p.id] || { timeIn: '08:00', timeOut: '17:00' };
    const assignedIds = p.assignedPersonnel || [];

    return Array.from({ length: count }).map((_, j) => ({
        id: `REP-${p.id}-${j}`,
        projectId: p.id,
        projectName: p.name,
        clientId: p.clientId,
        date: new Date(Date.now() - (j * 86400000)).toISOString().split('T')[0],
        state: isActive ? (j < 5 ? 'Draft' : j < 15 ? 'Pending Manager Review' : 'Approved') : 'Approved',
        weather: { temp: 25 + (j % 5), condition: 'Clear', practicable: true, rainfallMm: 0 },
        equipment: [],
        customSections: [],
        comments: [],
        notes: `Inspected ${p.name} - Unit ${j + 1}. No issues found.`,
        health: 90,
        labor: assignedIds.map((persId, idx) => ({
            id: `lab-${p.id}-${j}-${idx}`,
            personnelId: persId,
            role: mockPersonnel.find(m => m.id === persId)?.position || 'Technician',
            qty: 1,
            timeIn: shift.timeIn,
            timeOut: shift.timeOut,
            hours: calcHours(shift.timeIn, shift.timeOut),
            type: 'On Site' as const,
            isOutsourced: false,
        }))
    }));
});

export const mockTimesheets: TimesheetEntry[] = mockProjects.flatMap((p) => {
    const isKnown = p.clientId !== 'Unknown';
    const isActive = p.status === 'Active';
    const assignedIds = (p.assignedPersonnel && p.assignedPersonnel.length > 0) ? p.assignedPersonnel : ['PERS-DOE'];
    
    // Active spans 3 weeks (approx 21 days), Completed 2 days, Unknown 1 day
    const days = isKnown ? (isActive ? 21 : 2) : 1;

    return assignedIds.flatMap(persId => {
        return Array.from({ length: days }).map((_, i) => {
            const date = new Date(Date.now() - (i * 86400000)).toISOString().split('T')[0];
            return {
                id: `TS-${p.id}-${persId}-${i}`,
                personnelId: persId,
                date,
                hours: 8,
                type: 'On Site' as const,
                projectId: p.id,
                status: 'Approved' as const,
                notes: `Daily work on ${p.name}`
            };
        });
    });
});

export const mockTools: Tool[] = [
    {
        id: 'TOOL-1',
        name: 'Thermal Camera',
        model: 'Fluke Ti401',
        serialNumber: 'SN-12345',
        certificationExpiry: '2027-10-20',
        assignedProjectId: 'P0001',
        history: [{ date: '2024-01-10', description: 'Calibrated.' }]
    }
];
