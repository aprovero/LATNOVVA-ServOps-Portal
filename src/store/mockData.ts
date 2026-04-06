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
    { id: 'CUST_AES', name: 'AES', logo: 'https://ui-avatars.com/api/?name=AES&background=1E3A8A&color=fff' },
];

export const mockProjects: Project[] = [
    // CEN Solutions
    { id: 'PROJ-CEN-1', clientId: 'CUST_CEN', name: 'Bellefield II Solar', codeName: 'BFLD-II-001', type: 'Complete', status: 'Active', projectSize: '200MW', systemType: 'Solar', progress: 45, location: '35.0117,-118.0638', assignedPersonnel: ['PERS-10073', 'PERS-10076', 'PERS-10093', 'PERS-10042', 'PERS-10022', 'PERS-10102', 'PERS-10064', 'PERS-10118', 'PERS-10089', 'PERS-10117', 'PERS-10016', 'PERS-10129', 'PERS-10108'], scopes: [{ id: 's1-scp1', name: 'Civil Works', activities: [{ id: 's1-a1', title: 'Trenching', status: 'Completed', progress: 100, steps: [{ name: 'Marking', completed: true }, { name: 'Digging', completed: true }], startDate: '2026-03-01', expectedDays: 5 }, { id: 's1-a2', title: 'Mounting', status: 'In Progress', progress: 50, steps: [{ name: 'Brackets', completed: true }, { name: 'Panels', completed: false }], startDate: '2026-03-06', expectedDays: 10 }] }] },
    { id: 'PROJ-CEN-2', clientId: 'CUST_CEN', name: 'Alamito Solar', codeName: 'ALMT-001', type: 'Simple', status: 'Active', projectSize: '150MW', systemType: 'Solar', progress: 20, location: '32.09,-96.38', assignedPersonnel: ['PERS-10055', 'PERS-10004'], scopes: [] },
    { id: 'PROJ-CEN-3', clientId: 'CUST_CEN', name: 'North Fork Mesa Solar Center', codeName: 'NFMS-330', type: 'Complete', status: 'Completed', projectSize: '330MW', systemType: 'Solar', progress: 100, location: '30.2672,-97.7431', scopes: [] },
    
    // Power Electronics
    { id: 'PROJ-PE-1', clientId: 'CUST_POWER_ELEC', name: 'Thundervolt Solar', type: 'Complete', status: 'Active', systemType: 'Solar', progress: 85, location: '33.4354,-112.3406', assignedPersonnel: ['PERS-10081', 'PERS-10066'], scopes: [] },
    { id: 'PROJ-PE-2', clientId: 'CUST_POWER_ELEC', name: 'Sun Valley Solar', type: 'Complete', status: 'Active', systemType: 'Solar', progress: 15, location: '31.8675,-97.074', assignedPersonnel: ['PERS-10023', 'PERS-10056', 'PERS-10039', 'PERS-10083'], scopes: [] },
    { id: 'PROJ-PE-3', clientId: 'CUST_POWER_ELEC', name: 'PE Coromuel', type: 'Simple', status: 'Completed', systemType: 'Other', progress: 100, location: '23.6345,-102.5528', scopes: [] },

    // Grupo Cobra
    { id: 'PROJ-COBRA-1', clientId: 'CUST_COBRA', name: 'Byrum Solar', type: 'Complete', status: 'Active', systemType: 'Solar', progress: 60, location: '31.39,-97.55', assignedPersonnel: ['PERS-10059', 'PERS-10111', 'PERS-10103'], scopes: [] },
    
    // SUNGROW (SUNDROW in image)
    { id: 'PROJ-SUN-1', clientId: 'CUST_SUNGROW', name: 'PPA Sierra Gorda', type: 'Complete', status: 'Completed', systemType: 'Solar', progress: 100, location: '-25.0721,-69.2145', scopes: [] },
    { id: 'PROJ-SUN-2', clientId: 'CUST_SUNGROW', name: 'PFV Guajapo', type: 'Simple', status: 'Completed', systemType: 'Solar', progress: 100, location: '4.5709,-74.2973', scopes: [] },

    // CFE
    { id: 'PROJ-CFE-1', clientId: 'CUST_CFE', name: 'PFV Andaluz II', type: 'Simple', status: 'Completed', systemType: 'Solar', progress: 100, location: '23.6345,-102.5528', scopes: [] },
    { id: 'PROJ-CFE-2', clientId: 'CUST_CFE', name: 'PFV Panuco Fase II', type: 'Complete', status: 'Completed', projectSize: '440MW', systemType: 'Solar', progress: 100, location: '22.0526,-98.0526', scopes: [] },

    // SAFT
    { id: 'PROJ-SAFT-1', clientId: 'CUST_SAFT', name: 'Crimson Energy Storage', type: 'Complete', status: 'Completed', projectSize: '350MW', systemType: 'BESS', progress: 100, location: '33.7233,-114.6548', scopes: [] },
    
    // NextEra
    { id: 'PROJ-NEXT-1', clientId: 'CUST_NEXTERA', name: 'NextEra Country Solar Plant', type: 'Simple', status: 'Completed', projectSize: '200MW', systemType: 'Solar', progress: 100, location: '38.7681,-86.3533', scopes: [] },

    // Terni-Energia
    { id: 'PROJ-TERNI-1', clientId: 'CUST_TERNI', name: 'Terra Gen Solar Plant', type: 'Complete', status: 'Completed', projectSize: '200MW', systemType: 'Solar', progress: 100, location: '34.6551,-117.7499', scopes: [] },

    // NovaSource
    { id: 'PROJ-NOVA-1', clientId: 'CUST_NOVASOURCE', name: 'Novasource Solar Plant', type: 'Complete', status: 'Completed', projectSize: '150MW', systemType: 'Solar', progress: 100, location: '33.2076,-92.6565', scopes: [] },

    // Unknown / Ferrovial (mapping some from Ferrovial to image projects to keep client)
    { id: 'PROJ-F1', clientId: 'CUST_FERROVIAL', name: 'Electric Charging Station (4 MW)', type: 'Simple', status: 'Completed', systemType: 'PV Charging', progress: 100, location: '20.9674,-89.5936', scopes: [] },
    { id: 'PROJ-F2', clientId: 'CUST_FERROVIAL', name: 'West Wing Interconnection Project', type: 'Simple', status: 'Completed', systemType: 'Interconnection', progress: 100, location: '33.6499,-112.3406', scopes: [] },
    { id: 'PROJ-AES-1', clientId: 'CUST_AES', name: 'AES Solar Storage', type: 'Complete', status: 'Active', systemType: 'Hybrid', progress: 10, location: '34.0522,-118.2437', assignedPersonnel: ['PERS-10130'], scopes: [] },
];

export const mockPersonnel: Personnel[] = [
    { id: 'PERS-10023', name: 'RICARDO OLIVA', position: 'TEAM LEADER', employeeNumber: '10023', phoneNumber: '9562808290', appRole: 'Supervisor', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10056', name: 'PEDRO LUIS RAMIREZ MORENO', position: 'TECHNICIAN', employeeNumber: '10056', phoneNumber: '3462429260', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10039', name: 'JUAN ALBERTO GARCIA SARIOL', position: 'TECHNICIAN', employeeNumber: '10039', phoneNumber: '7864005350', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10083', name: 'Miguel Sanchez', position: 'TECHNICIAN', employeeNumber: '10083', phoneNumber: '7869212568', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10081', name: 'MAYLENE TORRES MALDONADO', position: 'TEAM LEADER', employeeNumber: '10081', phoneNumber: '3463493593', appRole: 'Supervisor', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10066', name: 'Jesus Sanchez', position: 'ASSEMBLER', employeeNumber: '10066', phoneNumber: '8325040949', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10073', name: 'SEBASTIAN YANCA', position: 'TEAM LEADER', employeeNumber: '10073', phoneNumber: '3467927900', appRole: 'Supervisor', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10076', name: 'JOHN ANTHONY AGUILAR JR', position: 'TECHNICIAN', employeeNumber: '10076', phoneNumber: '7606045834', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10093', name: 'JUAN GONZALEZ', position: 'TECHNICIAN', employeeNumber: '10093', phoneNumber: '7606750622', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10042', name: 'EDIAGNEL RIVERA', position: 'TECHNICIAN', employeeNumber: '10042', phoneNumber: '3465464725', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10022', name: 'BRAINE GAMBOA', position: 'TECHNICIAN', employeeNumber: '10022', phoneNumber: '3463552374', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10102', name: 'RICHARD RADAMES NUNES ROMERO', position: 'ASSEMBLER', employeeNumber: '10102', phoneNumber: '8323741605', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10064', name: 'Andres Garcia', position: 'TECHNICIAN', employeeNumber: '10064', phoneNumber: '95637424332', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10118', name: 'VINCENT TORRES MALDONADO', position: 'ASSEMBLER', employeeNumber: '10118', phoneNumber: '3213019932', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10089', name: 'ARIEL CABALLERO', position: 'ASSEMBLER', employeeNumber: '10089', phoneNumber: '3468044615', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10117', name: 'FRANCISCO MARTINEZ MARRERO', position: 'ASSEMBLER', employeeNumber: '10117', phoneNumber: '8587896764', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10016', name: 'JOSE LOPEZ', position: 'TECHNICIAN', employeeNumber: '10016', phoneNumber: '7609257506', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10129', name: 'Cesar Hernandez', position: 'ASSEMBLER', employeeNumber: '10129', phoneNumber: '7275575458', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10108', name: 'Jose Moreno', position: 'ASSEMBLER', employeeNumber: '10108', phoneNumber: '5178027869', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10103', name: 'Ricardo Hernandez', position: 'ASSEMBLER', employeeNumber: '10103', phoneNumber: '5177752101', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10055', name: 'Ivan Sanchez', position: 'TECHNICIAN', employeeNumber: '10055', phoneNumber: '7602223941', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10004', name: 'Luis Sanchez', position: 'TECHNICIAN', employeeNumber: '10004', phoneNumber: '7605508543', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10130', name: 'JAIME VAZQUEZ', position: 'SUPERVISOR', employeeNumber: '10130', phoneNumber: '-', appRole: 'Supervisor', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10111', name: 'Rafael Garcia', position: 'ASSEMBLER', employeeNumber: '10111', phoneNumber: '8325440690', appRole: 'Tech', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
    { id: 'PERS-10059', name: 'Juan Hernandez', position: 'OPERATION LEADER', employeeNumber: '10059', phoneNumber: '7604858780', appRole: 'Manager', status: 'Active', certifications: [{ name: 'OSHA 30', expirationDate: '2028-12-31' }] },
];

const toolTypes = ['Thermal Camera', 'Multimeter', 'Torque Wrench', 'Megger Insulation Tester', 'Power Quality Analyzer', 'Clamp Meter', 'Crimping Tool'];
const models = ['Fluke Ti401', 'Fluke 87V', 'Milwaukee 2456-20', 'Fluke 1587 FC', 'Fluke 435 Series II', 'Klein Tools CL390', 'Greenlee EK1240C'];

export const mockTools: Tool[] = Array.from({ length: 25 }).map((_, i) => {
    const toolIndex = i % toolTypes.length;
    return {
        id: `TOOL-${i + 1}`,
        name: toolTypes[toolIndex],
        model: models[toolIndex],
        serialNumber: `SN-${10000 + (i * 7)}`,
        certificationExpiry: i % 8 === 0 ? '2023-05-15' : '2027-10-20',
        assignedProjectId: i % 3 === 0 ? mockProjects[i % mockProjects.length].id : (i % 5 === 0 ? 'PROJ-CEN-1' : undefined),
        history: [
            { date: '2024-01-10', description: 'Calibrated and ready.' }
        ]
    };
});

// Shift times: all personnel on the same project get identical shift times
// timeIn between 08:00–09:00, timeOut between 16:00–20:00
const projectShifts: Record<string, { timeIn: string; timeOut: string }> = {
    'PROJ-CEN-1':  { timeIn: '08:00', timeOut: '17:30' },
    'PROJ-CEN-2':  { timeIn: '08:30', timeOut: '18:00' },
    'PROJ-PE-1':   { timeIn: '08:15', timeOut: '17:00' },
    'PROJ-PE-2':   { timeIn: '09:00', timeOut: '16:00' },
    'PROJ-COBRA-1': { timeIn: '08:00', timeOut: '19:00' },
    'PROJ-F1':      { timeIn: '08:45', timeOut: '18:30' },
    'PROJ-F2':      { timeIn: '08:00', timeOut: '17:00' },
};

function calcHours(timeIn: string, timeOut: string): number {
    const [inH, inM] = timeIn.split(':').map(Number);
    const [outH, outM] = timeOut.split(':').map(Number);
    return parseFloat(((outH * 60 + outM - inH * 60 - inM) / 60).toFixed(1));
}

export const mockReports: Report[] = mockProjects.flatMap((p) => {
    const shift = projectShifts[p.id];
    const assignedIds = p.assignedPersonnel || [];

    return Array.from({ length: 3 }).map((_, j) => ({
        id: `REP-${p.id}-${j}`,
        projectId: p.id,
        projectName: p.name,
        clientId: p.clientId,
        date: new Date(Date.now() - (j * 86400000)).toISOString().split('T')[0],
        state: j === 0 ? 'Draft' : j === 1 ? 'Pending Manager Review' : 'Approved',
        weather: { temp: 25 + j, condition: 'Clear', practicable: true, rainfallMm: 0 },
        equipment: [{ serialNumber: 'SN-999', scanned: true, type: 'Inverter' }],
        customSections: [],
        comments: j > 0 ? [{ id: `CMT-${j}`, userId: 'Manager-1', role: 'Manager', timestamp: new Date().toISOString(), text: 'Looks good.' }] : [],
        notes: `Test field report ${j + 1} for project ${p.name}. Completed site inspection and safety protocols.`,
        health: 80 + (j * 5),
        labor: shift && assignedIds.length > 0
            ? assignedIds.map((persId, idx) => ({
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
            : [
                { id: `lab-${j}-1`, role: 'Foreman', qty: 1, hours: 8 },
                { id: `lab-${j}-2`, role: 'Electrician', qty: 2, hours: 8 }
            ]
    }));
});

export const mockTimesheets: TimesheetEntry[] = Array.from({ length: 30 }).map((_, i) => {
    const pId = mockProjects[i % mockProjects.length].id;
    const type = i % 4 === 0 ? 'Overtime' : i % 5 === 0 ? 'Travel' : 'Regular';
    const hours = type === 'Overtime' ? 4 : type === 'Travel' ? 2 : 8;
    return {
        id: `TS-${i + 1}`,
        personnelId: `PERS-${(i % 40) + 1}`,
        date: new Date(Date.now() - ((i % 5) * 86400000)).toISOString().split('T')[0],
        hours,
        type: type as any,
        projectId: pId,
        status: i % 3 === 0 ? 'Approved' : 'Pending',
        notes: type === 'Overtime' ? 'Late shift to finish commissioning' : type === 'Travel' ? 'Travel to site' : 'Standard hours'
    };
});
