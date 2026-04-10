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
    { id: 'CUST_OCA', name: 'OCA Global', logo: 'https://ui-avatars.com/api/?name=OCA+Global&background=F43F5E&color=fff' },
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
    { id: 'PERS-MR1', name: 'JUAN MANUEL RUBIO', position: 'PROJECT MANAGER', employeeNumber: 'EMP-MR01', appRole: 'Manager', status: 'Active', certifications: [] },
    { id: 'PERS-RG1', name: 'ROSARIO GONZALEZ', position: 'INSPECTOR', employeeNumber: 'EMP-RG01', appRole: 'Tech', status: 'Active', certifications: [] },
    { id: 'PERS-NEW1', name: 'FERNANDO ASENSIO', position: 'MANAGER', employeeNumber: 'EMP-NEW01', appRole: 'Manager', status: 'Active', certifications: [], email: 'fasensio@latnovva.com' },
    { id: 'PERS-NEW2', name: 'JESUS REINA', position: 'MANAGER', employeeNumber: 'EMP-NEW02', appRole: 'Manager', status: 'Active', certifications: [], email: 'jreina@latnovva.com' },
    { id: 'PERS-NEW3', name: 'JUAN MARIA DIAZ', position: 'MANAGER', employeeNumber: 'EMP-NEW03', appRole: 'Manager', status: 'Active', certifications: [], email: 'jmdiaz@latnovva.com' },
    { id: 'PERS-HR1', name: 'ALICIA MENDEZ', position: 'HR MANAGER', employeeNumber: 'EMP-HR01', appRole: 'HR', status: 'Active', certifications: [], email: 'amendez@latnovva.com' },
];

export const mockProjects: Project[] = [
    {"id": "P0001", "clientId": "CUST_CEN", "name": "Bellefield II Solar", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Solar", "progress": 45, "location": "35.0117,-118.0638", "assignedPersonnel": ["PERS-BF1", "PERS-BF2", "PERS-BF3", "PERS-BF5", "PERS-BF6", "PERS-BF8", "PERS-BF9", "PERS-BF10", "PERS-BF11", "PERS-BF12", "PERS-BF13", "PERS-BF14"], "scopes": []},
    {"id": "P0002", "clientId": "CUST_POWER_ELEC", "name": "Thundervolt Solar", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Solar", "progress": 45, "location": "33.4354,-112.3406", "assignedPersonnel": ["PERS-TW1"], "scopes": []},
    {"id": "P0003", "clientId": "CUST_CEN", "name": "Alamitos II", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Other", "progress": 45, "location": "33.787310,-118.057136", "assignedPersonnel": ["PERS-AL1", "PERS-AL2"], "scopes": []},
    {"id": "P0004", "clientId": "CUST_COBRA", "name": "Bynum Solar (Grupo Cobra)", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Solar", "progress": 45, "location": "31.39,-97.55", "assignedPersonnel": ["PERS-BY1"], "scopes": []},
    {"id": "P0004-OCA", "clientId": "CUST_OCA", "name": "Bynum Solar (OCA Global)", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Solar", "progress": 45, "location": "31.39,-97.55", "assignedPersonnel": ["PERS-RG1"], "scopes": []},
    {"id": "P0005", "clientId": "CUST_POWER_ELEC", "name": "Sun Valley Solar", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Solar", "progress": 45, "location": "31.8675,-97.0740", "assignedPersonnel": ["PERS-SV2"], "scopes": []},
    {"id": "P0006", "clientId": "CUST_SUNGROW", "name": "PPA Sierra Gorda", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "-22.8986,-68.32", "assignedPersonnel": [], "scopes": []},
    {"id": "P0007", "clientId": "CUST_SUNGROW", "name": "PFV Guajapo", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "10.3948,-74.9385", "assignedPersonnel": [], "scopes": []},
    {"id": "P0008", "clientId": "CUST_SUNGROW", "name": "PFV La Union", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "10.9,-74.3", "assignedPersonnel": [], "scopes": []},
    {"id": "P0009", "clientId": "CUST_SUNGROW", "name": "PFV La Mana", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "10.3072,-73.6167", "assignedPersonnel": [], "scopes": []},
    {"id": "P0010", "clientId": "CUST_POWER_ELEC", "name": "PE Coromuel", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "24.1426,-110.3119", "assignedPersonnel": [], "scopes": []},
    {"id": "P0011", "clientId": "CUST_CFE", "name": "PFV Andaluz II", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "23.6345,-102.5528", "assignedPersonnel": [], "scopes": []},
    {"id": "P0012", "clientId": "CUST_CFE", "name": "PFV Panuco Fase II", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "23.6345,-102.5528", "assignedPersonnel": [], "scopes": []},
    {"id": "P0013", "clientId": "CUST_CFE", "name": "Tren Maya Acometidas Media Tension", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "18.5,-88.2", "assignedPersonnel": [], "scopes": []},
    {"id": "P0014", "clientId": "CUST_TSK", "name": "Combined Cycle Facilities Services", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "22.1565,-100.9855", "assignedPersonnel": [], "scopes": []},
    {"id": "P0015", "clientId": "CUST_TESLA", "name": "Electric Charging Station (4 MW)", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "20.9506,-89.5945", "assignedPersonnel": [], "scopes": []},
    {"id": "P0016", "clientId": "Unknown", "name": "Battlebush Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.4484,-112.0740", "assignedPersonnel": [], "scopes": []},
    {"id": "P0017", "clientId": "Unknown", "name": "Danland Solar Plant 300MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.8461,-113.541", "assignedPersonnel": [], "scopes": []},
    {"id": "P0018", "clientId": "Unknown", "name": "Der Paloma Solar Plant 256MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.9372,-112.713", "assignedPersonnel": [], "scopes": []},
    {"id": "P0019", "clientId": "Unknown", "name": "Red Rock Solar Plant 20MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.2226,-110.9747", "assignedPersonnel": [], "scopes": []},
    {"id": "P0020", "clientId": "Unknown", "name": "Red Rock Solar Project 20MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.0489,-111.0937", "assignedPersonnel": [], "scopes": []},
    {"id": "P0021", "clientId": "Unknown", "name": "Sunstreams Solar Plant 90MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.9795,-111.7574", "assignedPersonnel": [], "scopes": []},
    {"id": "P0022", "clientId": "CUST_CEN", "name": "West Wing Interconnection Project 200KV", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "33.4484,-112.0740", "assignedPersonnel": [], "scopes": []},
    {"id": "P0023", "clientId": "Unknown", "name": "Westside Cold Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.4484,-112.0740", "assignedPersonnel": [], "scopes": []},
    {"id": "P0024", "clientId": "Unknown", "name": "Wilmot Energy Center 100 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "31.5545,-110.3644", "assignedPersonnel": [], "scopes": []},
    {"id": "P0025", "clientId": "Unknown", "name": "Conway Happy Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.7465,-92.2895", "assignedPersonnel": [], "scopes": []},
    {"id": "P0026", "clientId": "Unknown", "name": "Crossett Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.1282,-91.9612", "assignedPersonnel": [], "scopes": []},
    {"id": "P0027", "clientId": "CUST_NOVASOURCE", "name": "Novasource Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.2076,-92.6663", "assignedPersonnel": [], "scopes": []},
    {"id": "P0028", "clientId": "Unknown", "name": "Prairie Mist Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.629,-91.7505", "assignedPersonnel": [], "scopes": []},
    {"id": "P0029", "clientId": "Unknown", "name": "Arica Solar PV Park 270MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0030", "clientId": "Unknown", "name": "Arite Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.7139,-115.4322", "assignedPersonnel": [], "scopes": []},
    {"id": "P0031", "clientId": "Unknown", "name": "Arlington Solar Energy Center 364MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.6103,-117.3963", "assignedPersonnel": [], "scopes": []},
    {"id": "P0032", "clientId": "Unknown", "name": "Arlington Solar Plant 500MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.6103,-114.5964", "assignedPersonnel": [], "scopes": []},
    {"id": "P0033", "clientId": "Unknown", "name": "Big Beau Solar Plant 200 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.9641,-118.1634", "assignedPersonnel": [], "scopes": []},
    {"id": "P0034", "clientId": "CUST_POWER_ELEC", "name": "Blythe Mesa Solar Power Project 700MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.5633,-114.3982", "assignedPersonnel": [], "scopes": []},
    {"id": "P0035", "clientId": "Unknown", "name": "Blythe Solar Plant 500MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.6103,-114.5964", "assignedPersonnel": [], "scopes": []},
    {"id": "P0036", "clientId": "Unknown", "name": "Cold Center Solar Plant 150 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.0951,-117.7499", "assignedPersonnel": [], "scopes": []},
    {"id": "P0037", "clientId": "CUST_POWER_ELEC", "name": "Calipatria Solar PV Park 850MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.1252,-115.5143", "assignedPersonnel": [], "scopes": []},
    {"id": "P0038", "clientId": "Unknown", "name": "Centinela Solar 550MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.6769,-115.6322", "assignedPersonnel": [], "scopes": []},
    {"id": "P0039", "clientId": "Unknown", "name": "Crimson Energy Storage 350MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0040", "clientId": "CUST_POWER_ELEC", "name": "Crimson Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.5633,-114.3982", "assignedPersonnel": [], "scopes": []},
    {"id": "P0041", "clientId": "Unknown", "name": "Desert Harvest Solar Farm 2 850MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0042", "clientId": "Unknown", "name": "Desert Harvest Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.7139,-115.4322", "assignedPersonnel": [], "scopes": []},
    {"id": "P0043", "clientId": "Unknown", "name": "Desert Peak Solar Plant 800MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.7139,-115.4322", "assignedPersonnel": [], "scopes": []},
    {"id": "P0044", "clientId": "Unknown", "name": "Desert Sunlight Solar Farm 1 550MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.8225,-115.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0045", "clientId": "Unknown", "name": "Edwards Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "35.0925,-118.1739", "assignedPersonnel": [], "scopes": []},
    {"id": "P0046", "clientId": "Unknown", "name": "Fallbrook BESS Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.1064,-117.5331", "assignedPersonnel": [], "scopes": []},
    {"id": "P0047", "clientId": "Unknown", "name": "McCoy Solar Energy Project 250MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0048", "clientId": "Unknown", "name": "McCoy Solar Plant 500MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.6103,-114.5964", "assignedPersonnel": [], "scopes": []},
    {"id": "P0049", "clientId": "Unknown", "name": "Midway Solar PV Park 133MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0050", "clientId": "Unknown", "name": "Midway Solar Plant 200 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.8225,-115.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0051", "clientId": "Unknown", "name": "Mojave Solar Storage Farm 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0052", "clientId": "CUST_CEN", "name": "Mojave Solar Farm 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "35.0278,-117.3308", "assignedPersonnel": [], "scopes": []},
    {"id": "P0053", "clientId": "Unknown", "name": "Nova Power Bank Project 680MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0054", "clientId": "Unknown", "name": "Peak Sunlight Storage 2 Battery Project 300MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "38.7763,-119.4179", "assignedPersonnel": [], "scopes": []},
    {"id": "P0055", "clientId": "Unknown", "name": "Rosamond Solar Plant 100 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.9641,-118.1634", "assignedPersonnel": [], "scopes": []},
    {"id": "P0056", "clientId": "Unknown", "name": "Saint Solar & Battery Project 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.1064,-117.5331", "assignedPersonnel": [], "scopes": []},
    {"id": "P0057", "clientId": "Unknown", "name": "Sunborn Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "35.0925,-118.1739", "assignedPersonnel": [], "scopes": []},
    {"id": "P0058", "clientId": "Unknown", "name": "Sunlight Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "34.9641,-118.1634", "assignedPersonnel": [], "scopes": []},
    {"id": "P0059", "clientId": "Unknown", "name": "Valley Center Energy Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "34.0951,-117.7499", "assignedPersonnel": [], "scopes": []},
    {"id": "P0060", "clientId": "Unknown", "name": "Valley Center Energy Storage Facility 139MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "33.2189,-116.9789", "assignedPersonnel": [], "scopes": []},
    {"id": "P0061", "clientId": "Unknown", "name": "Valley Center Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.792,-115.5631", "assignedPersonnel": [], "scopes": []},
    {"id": "P0062", "clientId": "Unknown", "name": "Arcadia Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "27.2159,-81.8584", "assignedPersonnel": [], "scopes": []},
    {"id": "P0063", "clientId": "Unknown", "name": "Balm Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "27.7534,-82.2612", "assignedPersonnel": [], "scopes": []},
    {"id": "P0064", "clientId": "Unknown", "name": "Big Juniper Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0065", "clientId": "Unknown", "name": "Blue Indigo Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0066", "clientId": "Unknown", "name": "Canoe Solar Energy Center 74.5MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0067", "clientId": "Unknown", "name": "Canoe Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0068", "clientId": "Unknown", "name": "Clewiston Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "25.7617,-80.1918", "assignedPersonnel": [], "scopes": []},
    {"id": "P0069", "clientId": "Unknown", "name": "Crestview Energy & Storage Project 74.5MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0070", "clientId": "Unknown", "name": "Decarous Solar Plant 150 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.4383,-84.2807", "assignedPersonnel": [], "scopes": []},
    {"id": "P0071", "clientId": "Unknown", "name": "Little Manatee Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "27.4989,-82.5748", "assignedPersonnel": [], "scopes": []},
    {"id": "P0072", "clientId": "Unknown", "name": "Manatee BESS Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "27.4989,-82.5748", "assignedPersonnel": [], "scopes": []},
    {"id": "P0073", "clientId": "Unknown", "name": "Peace Creek Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.3322,-81.6557", "assignedPersonnel": [], "scopes": []},
    {"id": "P0074", "clientId": "Unknown", "name": "Pearl River Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "27.5646,-81.4572", "assignedPersonnel": [], "scopes": []},
    {"id": "P0075", "clientId": "Unknown", "name": "Pecan Tree Solar Energy Center 75MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "27.5646,-81.5158", "assignedPersonnel": [], "scopes": []},
    {"id": "P0076", "clientId": "Unknown", "name": "Pecan Tree Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0077", "clientId": "Unknown", "name": "Wild Quail Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0078", "clientId": "Unknown", "name": "Wing Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7621,-86.5705", "assignedPersonnel": [], "scopes": []},
    {"id": "P0079", "clientId": "Unknown", "name": "Hazelhurst Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.836,-83.6324", "assignedPersonnel": [], "scopes": []},
    {"id": "P0080", "clientId": "Unknown", "name": "Ocelot Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.836,-83.6324", "assignedPersonnel": [], "scopes": []},
    {"id": "P0081", "clientId": "Unknown", "name": "Twiggs Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.5813,-82.8107", "assignedPersonnel": [], "scopes": []},
    {"id": "P0082", "clientId": "Unknown", "name": "Wadley Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.8683,-82.4045", "assignedPersonnel": [], "scopes": []},
    {"id": "P0083", "clientId": "Unknown", "name": "Washington Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.5813,-82.8107", "assignedPersonnel": [], "scopes": []},
    {"id": "P0084", "clientId": "Unknown", "name": "Milligan Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "39.8045,-87.6734", "assignedPersonnel": [], "scopes": []},
    {"id": "P0085", "clientId": "Unknown", "name": "Prairie Wolf Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "39.8045,-87.6734", "assignedPersonnel": [], "scopes": []},
    {"id": "P0086", "clientId": "Unknown", "name": "Canary Solar Plant 300MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "41.4721,-87.0511", "assignedPersonnel": [], "scopes": []},
    {"id": "P0087", "clientId": "Unknown", "name": "Dunnbridge Solar Plant 300MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "41.4655,-87.1786", "assignedPersonnel": [], "scopes": []},
    {"id": "P0088", "clientId": "CUST_NEXTERA", "name": "NewEra Cavalry Solar Farm 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "41.4655,-86.1581", "assignedPersonnel": [], "scopes": []},
    {"id": "P0089", "clientId": "Unknown", "name": "Elizabeth Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.4515,-91.1871", "assignedPersonnel": [], "scopes": []},
    {"id": "P0090", "clientId": "Unknown", "name": "Osborn Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.4515,-91.1871", "assignedPersonnel": [], "scopes": []},
    {"id": "P0091", "clientId": "Unknown", "name": "Albany Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "42.3212,-85.1797", "assignedPersonnel": [], "scopes": []},
    {"id": "P0092", "clientId": "Unknown", "name": "Supply Chain Solution Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "42.3212,-85.1797", "assignedPersonnel": [], "scopes": []},
    {"id": "P0093", "clientId": "Unknown", "name": "Gemini Solar and Battery Storage Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "36.1609,-115.152", "assignedPersonnel": [], "scopes": []},
    {"id": "P0094", "clientId": "Unknown", "name": "Yellow Pine Solar 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "36.1609,-115.152", "assignedPersonnel": [], "scopes": []},
    {"id": "P0095", "clientId": "Unknown", "name": "Clayton Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "43.9748,-75.9106", "assignedPersonnel": [], "scopes": []},
    {"id": "P0096", "clientId": "Unknown", "name": "High River Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "43.4696,-73.7562", "assignedPersonnel": [], "scopes": []},
    {"id": "P0097", "clientId": "Unknown", "name": "The Shaw Creek Solar Project 74.9 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.5381,-81.1557", "assignedPersonnel": [], "scopes": []},
    {"id": "P0098", "clientId": "Unknown", "name": "Big Cypress Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "35.3415,-89.8373", "assignedPersonnel": [], "scopes": []},
    {"id": "P0099", "clientId": "Unknown", "name": "Providence Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "35.3431,-89.3901", "assignedPersonnel": [], "scopes": []},
    {"id": "P0100", "clientId": "Unknown", "name": "Salinas Solar Plant 50MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "35.1056,-88.5833", "assignedPersonnel": [], "scopes": []},
    {"id": "P0101", "clientId": "Unknown", "name": "Skyhawk Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "35.4242,-89.1775", "assignedPersonnel": [], "scopes": []},
    {"id": "P0102", "clientId": "CUST_ORTIZ", "name": "7V Ranch Solar Photovoltaic Plant 140MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "29.0858,-96.8767", "assignedPersonnel": [], "scopes": []},
    {"id": "P0103", "clientId": "Unknown", "name": "Armed lla Solar Center 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.1364,-96.4883", "assignedPersonnel": [], "scopes": []},
    {"id": "P0104", "clientId": "Unknown", "name": "Bat Cave Energy Storage 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "29.529061,-98.411234", "assignedPersonnel": [], "scopes": []},
    {"id": "P0105", "clientId": "Unknown", "name": "Bat Cave Solar Plant 200MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "29.529061,-98.411234", "assignedPersonnel": [], "scopes": []},
    {"id": "P0106", "clientId": "Unknown", "name": "Candelaria Solar Plant 300MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "29.529061,-98.411234", "assignedPersonnel": [], "scopes": []},
    {"id": "P0107", "clientId": "Unknown", "name": "Crown Solar 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "31.5453,-97.1467", "assignedPersonnel": [], "scopes": []},
    {"id": "P0108", "clientId": "Unknown", "name": "Elara Solar 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7635,-99.2306", "assignedPersonnel": [], "scopes": []},
    {"id": "P0109", "clientId": "Unknown", "name": "Gulfcoast Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "28.9828,-95.9694", "assignedPersonnel": [], "scopes": []},
    {"id": "P0110", "clientId": "Unknown", "name": "Mission Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "26.2034,-98.23", "assignedPersonnel": [], "scopes": []},
    {"id": "P0111", "clientId": "Unknown", "name": "Noble Solar Plant 210MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "32.7767,-96.797", "assignedPersonnel": [], "scopes": []},
    {"id": "P0112", "clientId": "Unknown", "name": "North Fork Mason Solar Center 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.7635,-99.2306", "assignedPersonnel": [], "scopes": []},
    {"id": "P0113", "clientId": "Unknown", "name": "North Fork Plant Solar 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "30.2672,-97.7431", "assignedPersonnel": [], "scopes": []},
    {"id": "P0114", "clientId": "Unknown", "name": "Paris Solar Plant 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "33.6609,-95.5555", "assignedPersonnel": [], "scopes": []},
    {"id": "P0115", "clientId": "Unknown", "name": "Seguin 150MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "30.2672,-97.7431", "assignedPersonnel": [], "scopes": []},
    {"id": "P0116", "clientId": "Unknown", "name": "Sunvalley Solar Farm 250MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "29.4222,-97.1467", "assignedPersonnel": [], "scopes": []},
    {"id": "P0117", "clientId": "Unknown", "name": "The Beaumont Energy Storage Project 30MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Other", "progress": 100, "location": "30.0802,-94.1266", "assignedPersonnel": [], "scopes": []},
    {"id": "P0118", "clientId": "Unknown", "name": "Albani Solar Project 50MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "42.7057,-89.4183", "assignedPersonnel": [], "scopes": []},
    {"id": "P0119", "clientId": "Unknown", "name": "Albany Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "42.6702,-89.4183", "assignedPersonnel": [], "scopes": []},
    {"id": "P0120", "clientId": "Unknown", "name": "Arch Solar Project 30 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "44.5,-88.5", "assignedPersonnel": [], "scopes": []},
    {"id": "P0121", "clientId": "Unknown", "name": "Bear Creek Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "43.1822,-90.1372", "assignedPersonnel": [], "scopes": []},
    {"id": "P0122", "clientId": "Unknown", "name": "Beaver Dam Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "43.4578,-88.9372", "assignedPersonnel": [], "scopes": []},
    {"id": "P0123", "clientId": "Unknown", "name": "Central City Solar 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "44.5,-88.5", "assignedPersonnel": [], "scopes": []},
    {"id": "P0124", "clientId": "Unknown", "name": "Coosville Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "42.8428,-89.5523", "assignedPersonnel": [], "scopes": []},
    {"id": "P0125", "clientId": "Unknown", "name": "Duane Arnold Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "42.0807,-90.7385", "assignedPersonnel": [], "scopes": []},
    {"id": "P0126", "clientId": "Unknown", "name": "Hardy Hills Solar Farm 195MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "44.5,-88.5", "assignedPersonnel": [], "scopes": []},
    {"id": "P0127", "clientId": "Unknown", "name": "Hazelhurst 1 & 2 Solar Farm 20 MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "45.7755,-89.7324", "assignedPersonnel": [], "scopes": []},
    {"id": "P0128", "clientId": "Unknown", "name": "Nort Rock Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "42.6011,-89.1381", "assignedPersonnel": [], "scopes": []},
    {"id": "P0129", "clientId": "Unknown", "name": "Paddock Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "43.0731,-89.4112", "assignedPersonnel": [], "scopes": []},
    {"id": "P0130", "clientId": "Unknown", "name": "Springfield Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "44.8455,-92.2388", "assignedPersonnel": [], "scopes": []},
    {"id": "P0131", "clientId": "Unknown", "name": "Wascana Solar Plant 100MW", "type": "Simple", "status": "Completed", "projectSize": "100MW", "systemType": "Solar", "progress": 100, "location": "45.7771,-89.4112", "assignedPersonnel": [], "scopes": []},
    {"id": "P0132", "clientId": "CUST_SAFT", "name": "AES Guayama Power Complex", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Other", "progress": 45, "location": "17.9632,-66.1110", "assignedPersonnel": ["PERS-PR1"], "scopes": []},
    {"id": "P0133", "clientId": "CUST_GREENSOL", "name": "Murch Solar PV", "type": "Complete", "status": "Active", "projectSize": "100MW", "systemType": "Solar", "progress": 45, "location": "42.1880,-86.0300", "assignedPersonnel": ["PERS-MR1", "PERS-BY2", "PERS-SV3", "PERS-SV4", "PERS-BF7", "PERS-SV1", "PERS-BF4", "PERS-TW2"], "scopes": []},
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
