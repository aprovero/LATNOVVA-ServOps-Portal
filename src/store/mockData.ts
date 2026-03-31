import { Client, Project, Personnel, Tool, TimesheetEntry, Report } from './useStore';

export const mockClients: Client[] = [
    { id: 'CUST_SUNGROW', name: 'SUNGROW', logo: 'https://ui-avatars.com/api/?name=SUNGROW&background=F59E0B&color=fff' },
    { id: 'CUST_SAFT', name: 'SAFT', logo: 'https://ui-avatars.com/api/?name=SAFT&background=10B981&color=fff' },
    { id: 'CUST_POWER_ELEC', name: 'Power Electronics', logo: 'https://ui-avatars.com/api/?name=Power+Electronics&background=3B82F6&color=fff' },
    { id: 'CUST_FERROVIAL', name: 'Ferrovial', logo: 'https://ui-avatars.com/api/?name=Ferrovial&background=EF4444&color=fff' },
    { id: 'CUST_CEN', name: 'CEN Solutions', logo: 'https://ui-avatars.com/api/?name=CEN+Solutions&background=8B5CF6&color=fff' },
];

export const mockProjects: Project[] = [
    // SUNGROW
    { id: 'PROJ-S1', clientId: 'CUST_SUNGROW', name: 'Sungrow Outback Array', codeName: 'EST-LNV-000 CDMX', type: 'Complete', status: 'Active', progress: 45, scopes: [{ id: 's1-scp1', name: 'Civil Works', activities: [{ id: 's1-a1', title: 'Trenching', status: 'Completed', progress: 100 }, { id: 's1-a2', title: 'Mounting', status: 'In Progress', progress: 50 }] }], location: '40.6892,-74.0445', assignedPersonnel: ['PERS-1', 'PERS-2', 'PERS-3'] },
    { id: 'PROJ-S2', clientId: 'CUST_SUNGROW', name: 'Texas Desert Inverter Install', codeName: 'EST-LNV-000 MID', type: 'Simple', status: 'Completed', progress: 100, scopes: [], location: '31.9230,-104.8858' },
    { id: 'PROJ-S3', clientId: 'CUST_SUNGROW', name: 'Sungrow Coastal BESS', codeName: 'VM-LNV-098', type: 'Complete', status: 'Active', progress: 15, scopes: [], location: '40.7484,-73.9857', assignedPersonnel: ['PERS-4', 'PERS-5'] },
    
    // SAFT
    { id: 'PROJ-SF1', clientId: 'CUST_SAFT', name: 'SAFT Battery Hub Alpha', codeName: 'CH-LNVEM-090', type: 'Complete', status: 'Active', progress: 80, scopes: [], location: '38.8977,-77.0365', assignedPersonnel: ['PERS-6', 'PERS-7', 'PERS-8'] },
    { id: 'PROJ-SF2', clientId: 'CUST_SAFT', name: 'SAFT Urban Microgrid', codeName: 'OPDE-LNV-085', type: 'Complete', status: 'Completed', progress: 100, scopes: [], location: '38.6247,-90.1848' },
    { id: 'PROJ-SF3', clientId: 'CUST_SAFT', name: 'New York Storage Ext.', codeName: 'NK-LNV-089', type: 'Simple', status: 'On Hold', progress: 20, scopes: [], location: '51.4968,-116.1773', assignedPersonnel: ['PERS-9', 'PERS-10'] },
    { id: 'PROJ-SF4', clientId: 'CUST_SAFT', name: 'Grid Support Station', type: 'Complete', status: 'Active', progress: 5, scopes: [], location: '43.8791,-103.4591', assignedPersonnel: ['PERS-11', 'PERS-12'] },
    
    // Power Electronics
    { id: 'PROJ-PE1', clientId: 'CUST_POWER_ELEC', name: 'PE Inverter Array Beta', type: 'Complete', status: 'Active', progress: 95, scopes: [], location: '44.4605,-110.8281', assignedPersonnel: ['PERS-13', 'PERS-14', 'PERS-15'] },
    { id: 'PROJ-PE2', clientId: 'CUST_POWER_ELEC', name: 'PE Grid Tie Expansion', type: 'Simple', status: 'Completed', progress: 100, scopes: [], location: '28.4187,-81.5812' },
    { id: 'PROJ-PE3', clientId: 'CUST_POWER_ELEC', name: 'PE Rural Farm Install', type: 'Complete', status: 'Active', progress: 60, scopes: [], location: '36.1069,-112.1129', assignedPersonnel: ['PERS-16', 'PERS-17'] },

    // Ferrovial
    { id: 'PROJ-F1', clientId: 'CUST_FERROVIAL', name: 'Ferrovial Highway Solar', type: 'Complete', status: 'Active', progress: 30, scopes: [], location: '36.0156,-114.7378', assignedPersonnel: ['PERS-18', 'PERS-19', 'PERS-20'] },
    { id: 'PROJ-F2', clientId: 'CUST_FERROVIAL', name: 'Interstate Charging Hub', type: 'Simple', status: 'Active', progress: 10, scopes: [], location: '47.6205,-122.3493', assignedPersonnel: ['PERS-21', 'PERS-22'] },
    { id: 'PROJ-F3', clientId: 'CUST_FERROVIAL', name: 'Border Station Microgrid', type: 'Complete', status: 'On Hold', progress: 0, scopes: [], location: '46.8139,-71.2080', assignedPersonnel: ['PERS-23', 'PERS-24'] },
    { id: 'PROJ-F4', clientId: 'CUST_FERROVIAL', name: 'Ferrovial Valley Wind', type: 'Complete', status: 'Completed', progress: 100, scopes: [], location: '46.8523,-121.7603' },

    // CEN Solutions
    { id: 'PROJ-C1', clientId: 'CUST_CEN', name: 'CEN Smart Control Room', type: 'Complete', status: 'Completed', progress: 100, scopes: [], location: '18.4670,-66.1239' },
    { id: 'PROJ-C2', clientId: 'CUST_CEN', name: 'CEN Substation Upgrade', type: 'Simple', status: 'Active', progress: 75, scopes: [], location: '37.8199,-122.4783', assignedPersonnel: ['PERS-25', 'PERS-26'] },
    { id: 'PROJ-C3', clientId: 'CUST_CEN', name: 'Transmission Automation', type: 'Complete', status: 'Active', progress: 50, scopes: [], location: '37.8267,-122.4230', assignedPersonnel: ['PERS-27', 'PERS-28'] },
    { id: 'PROJ-C4', clientId: 'CUST_CEN', name: 'SCADA Implementation', type: 'Complete', status: 'Active', progress: 25, scopes: [], location: '19.4270,-99.1677', assignedPersonnel: ['PERS-29', 'PERS-30'] },
];

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Kevin', 'Helen', 'George', 'Donna', 'Edward', 'Carol', 'Brian', 'Ruth', 'Ronald', 'Sharon'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];

export const mockPersonnel: Personnel[] = Array.from({ length: 40 }).map((_, i) => {
    const isExpired = i < 5;
    const expDate = isExpired ? '2023-01-01' : '2028-12-31';
    
    let position = 'Technician';
    if (i % 5 === 0) position = 'Supervisor';
    if (i % 10 === 0) position = 'Manager';
    if (i === 29) position = 'Customer Representative';

    return {
        id: `PERS-${i + 1}`,
        name: `${firstNames[i]} ${lastNames[i]}`,
        position,
        employeeNumber: `EMP-${1000 + i}`,
        appRole: position === 'Manager' ? 'Manager' : position === 'Supervisor' ? 'Supervisor' : position === 'Customer Representative' ? 'Customer' : 'Tech',
        certifications: [
            { name: 'OSHA 30', expirationDate: expDate },
            { name: 'Electrical Safety (LOTO)', expirationDate: '2029-01-01' },
            { name: 'Solar Installation Certified', expirationDate: '2027-05-15' }
        ]
    };
});

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
        assignedProjectId: i % 3 === 0 ? mockProjects[i % mockProjects.length].id : undefined,
        history: [
            { date: '2024-01-10', description: 'Calibrated and ready.' }
        ]
    };
});

// Shift times: all personnel on the same project get identical shift times
// timeIn between 08:00–09:00, timeOut between 16:00–20:00
const projectShifts: Record<string, { timeIn: string; timeOut: string }> = {
    'PROJ-S1':  { timeIn: '08:00', timeOut: '17:30' },
    'PROJ-S3':  { timeIn: '08:30', timeOut: '18:00' },
    'PROJ-SF1': { timeIn: '08:15', timeOut: '17:00' },
    'PROJ-SF3': { timeIn: '09:00', timeOut: '16:00' },
    'PROJ-SF4': { timeIn: '08:00', timeOut: '19:00' },
    'PROJ-PE1': { timeIn: '08:45', timeOut: '18:30' },
    'PROJ-PE3': { timeIn: '08:00', timeOut: '16:30' },
    'PROJ-F1':  { timeIn: '08:30', timeOut: '20:00' },
    'PROJ-F2':  { timeIn: '08:00', timeOut: '17:00' },
    'PROJ-F3':  { timeIn: '09:00', timeOut: '17:30' },
    'PROJ-C2':  { timeIn: '08:15', timeOut: '16:15' },
    'PROJ-C3':  { timeIn: '08:00', timeOut: '18:00' },
    'PROJ-C4':  { timeIn: '08:30', timeOut: '19:30' },
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
