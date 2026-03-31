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
    { id: 'PROJ-S1', clientId: 'CUST_SUNGROW', name: 'Sungrow Outback Array', codeName: 'EST-LNV-000 CDMX', type: 'Complete', status: 'Active', progress: 45, scopes: [{ id: 's1-scp1', name: 'Civil Works', activities: [{ id: 's1-a1', title: 'Trenching', status: 'Completed', progress: 100 }, { id: 's1-a2', title: 'Mounting', status: 'In Progress', progress: 50 }] }], location: '32.7157,-117.1611' },
    { id: 'PROJ-S2', clientId: 'CUST_SUNGROW', name: 'Texas Desert Inverter Install', codeName: 'EST-LNV-000 MID', type: 'Simple', status: 'Completed', progress: 100, scopes: [], location: '31.9686,-99.9018' },
    { id: 'PROJ-S3', clientId: 'CUST_SUNGROW', name: 'Sungrow Coastal BESS', codeName: 'VM-LNV-098', type: 'Complete', status: 'Active', progress: 15, scopes: [], location: '25.7617,-80.1918' },
    
    // SAFT
    { id: 'PROJ-SF1', clientId: 'CUST_SAFT', name: 'SAFT Battery Hub Alpha', codeName: 'CH-LNVEM-090', type: 'Complete', status: 'Active', progress: 80, scopes: [], location: '41.8781,-87.6298' },
    { id: 'PROJ-SF2', clientId: 'CUST_SAFT', name: 'SAFT Urban Microgrid', codeName: 'OPDE-LNV-085', type: 'Complete', status: 'Completed', progress: 100, scopes: [], location: '34.0522,-118.2437' },
    { id: 'PROJ-SF3', clientId: 'CUST_SAFT', name: 'New York Storage Ext.', codeName: 'NK-LNV-089', type: 'Simple', status: 'On Hold', progress: 20, scopes: [], location: '40.7128,-74.0060' },
    { id: 'PROJ-SF4', clientId: 'CUST_SAFT', name: 'Grid Support Station', type: 'Complete', status: 'Active', progress: 5, scopes: [], location: '47.6062,-122.3321' },
    
    // Power Electronics
    { id: 'PROJ-PE1', clientId: 'CUST_POWER_ELEC', name: 'PE Inverter Array Beta', type: 'Complete', status: 'Active', progress: 95, scopes: [], location: '39.7392,-104.9903' },
    { id: 'PROJ-PE2', clientId: 'CUST_POWER_ELEC', name: 'PE Grid Tie Expansion', type: 'Simple', status: 'Completed', progress: 100, scopes: [], location: '33.4484,-112.0740' },
    { id: 'PROJ-PE3', clientId: 'CUST_POWER_ELEC', name: 'PE Rural Farm Install', type: 'Complete', status: 'Active', progress: 60, scopes: [], location: '44.9778,-93.2650' },

    // Ferrovial
    { id: 'PROJ-F1', clientId: 'CUST_FERROVIAL', name: 'Ferrovial Highway Solar', type: 'Complete', status: 'Active', progress: 30, scopes: [], location: '35.0844,-106.6504' },
    { id: 'PROJ-F2', clientId: 'CUST_FERROVIAL', name: 'Interstate Charging Hub', type: 'Simple', status: 'Active', progress: 10, scopes: [], location: '36.1699,-115.1398' },
    { id: 'PROJ-F3', clientId: 'CUST_FERROVIAL', name: 'Border Station Microgrid', type: 'Complete', status: 'On Hold', progress: 0, scopes: [], location: '31.7619,-106.4850' },
    { id: 'PROJ-F4', clientId: 'CUST_FERROVIAL', name: 'Ferrovial Valley Wind', type: 'Complete', status: 'Completed', progress: 100, scopes: [], location: '36.7783,-119.4179' },

    // CEN Solutions
    { id: 'PROJ-C1', clientId: 'CUST_CEN', name: 'CEN Smart Control Room', type: 'Complete', status: 'Completed', progress: 100, scopes: [], location: '32.7767,-96.7970' },
    { id: 'PROJ-C2', clientId: 'CUST_CEN', name: 'CEN Substation Upgrade', type: 'Simple', status: 'Active', progress: 75, scopes: [], location: '29.7604,-95.3698' },
    { id: 'PROJ-C3', clientId: 'CUST_CEN', name: 'Transmission Automation', type: 'Complete', status: 'Active', progress: 50, scopes: [], location: '30.2672,-97.7431' },
    { id: 'PROJ-C4', clientId: 'CUST_CEN', name: 'SCADA Implementation', type: 'Complete', status: 'Active', progress: 25, scopes: [], location: '29.4241,-98.4936' },
];

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];

export const mockPersonnel: Personnel[] = Array.from({ length: 30 }).map((_, i) => {
    const isExpired = i < 5; // First 5 people have expired certs (roughly 15%)
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
        certificationExpiry: i % 8 === 0 ? '2023-05-15' : '2027-10-20', // Some expired
        assignedProjectId: i % 3 === 0 ? mockProjects[i % mockProjects.length].id : undefined,
        history: [
            { date: '2024-01-10', description: 'Calibrated and ready.' }
        ]
    };
});

export const mockReports: Report[] = mockProjects.flatMap((p) => {
    // Generate 3 reports per project (Draft, Review, Approved)
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
        labor: [
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
        personnelId: `PERS-${(i % 30) + 1}`,
        date: new Date(Date.now() - ((i % 5) * 86400000)).toISOString().split('T')[0],
        hours,
        type: type as any,
        projectId: pId,
        status: i % 3 === 0 ? 'Approved' : 'Pending',
        notes: type === 'Overtime' ? 'Late shift to finish commissioning' : type === 'Travel' ? 'Travel to site' : 'Standard hours'
    };
});
