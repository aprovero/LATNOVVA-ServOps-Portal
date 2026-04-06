import json
from datetime import datetime, timedelta

# Clients
clients = [
    {'id': 'CUST_SUNGROW', 'name': 'SUNGROW', 'logo': 'G'},
    {'id': 'CUST_SAFT', 'name': 'SAFT', 'logo': 'S'},
    {'id': 'CUST_POWER_ELEC', 'name': 'Power Electronics', 'logo': 'P'},
    {'id': 'CUST_FERROVIAL', 'name': 'Ferrovial', 'logo': 'F'},
    {'id': 'CUST_CEN', 'name': 'CEN Solutions', 'logo': 'C'},
    {'id': 'CUST_COBRA', 'name': 'Grupo Cobra', 'logo': 'CO'},
    {'id': 'CUST_CFE', 'name': 'CFE', 'logo': 'CFE'},
    {'id': 'CUST_NEXTERA', 'name': 'NextEra', 'logo': 'N'},
    {'id': 'CUST_TERNI', 'name': 'Terni-Energia', 'logo': 'T'},
    {'id': 'CUST_NOVASOURCE', 'name': 'NovaSource', 'logo': 'NS'},
    {'id': 'CUST_GREENSOL', 'name': 'Greensol', 'logo': 'GS'},
    {'id': 'CUST_AES', 'name': 'AES', 'logo': 'AES'},
    {'id': 'CUST_EURUS', 'name': 'EURUS ENERGY', 'logo': 'EE'},
    {'id': 'CUST_TESLA', 'name': 'Tesla', 'logo': 'T'},
    {'id': 'CUST_ORTIZ', 'name': 'Grupo Ortiz', 'logo': 'GO'},
    {'id': 'CUST_TSK', 'name': 'TSK', 'logo': 'TSK'},
]

# Personnel
personnel = [
    {'id': 'PERS-SV1', 'name': 'RICARDO OLIVA', 'position': 'TEAM LEADER', 'role': 'Supervisor'},
    {'id': 'PERS-SV2', 'name': 'PEDRO LUIS RAMIREZ MORENO', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-SV3', 'name': 'JUAN ALBERTO GARCIA SARIOL', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-SV4', 'name': 'JORGE LUIS CALDERON PEREZ', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-TW1', 'name': 'MAYLENE TORRES MALDONADO', 'position': 'TEAM LEADER', 'role': 'Supervisor'},
    {'id': 'PERS-TW2', 'name': 'LAZARO RODRIGUEZ MARTINEZ', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BF1', 'name': 'SEBASTIAN YANCA', 'position': 'TEAM LEADER', 'role': 'Supervisor'},
    {'id': 'PERS-BF2', 'name': 'JOHN ANTHONY AGUILAR JR', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-BF3', 'name': 'JUAN GONZALEZ', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-BF4', 'name': 'EDIAGNEL RIVERA', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-BF5', 'name': 'BRAINE GAMBOA', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-BF6', 'name': 'RICHARD RADAMES NUNES ROMERO', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BF7', 'name': 'JOSHUA SANCHEZ', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-BF8', 'name': 'VINCENT TORRES MALDONADO', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BF9', 'name': 'ARIEL CABALLERO', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BF10', 'name': 'FRANCISCO MARTINEZ MARRERO', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BF11', 'name': 'JOSE LOPEZ', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-BF12', 'name': 'GEORDANIS RODRIGUEZ', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BF13', 'name': 'LUIS ANGEL GONZALEZ ROMERO', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BF14', 'name': 'CRISTIAN FURE HERNANDEZ', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-AL1', 'name': 'JESUS ORTEGA', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-AL2', 'name': 'ADRIAN RASCON', 'position': 'TECHNICIAN', 'role': 'Tech'},
    {'id': 'PERS-PR1', 'name': 'JAIME VAZQUEZ', 'position': 'SUPERVISOR', 'role': 'Supervisor'},
    {'id': 'PERS-BY1', 'name': 'MILDRED BAYARD BOLANOS', 'position': 'ASSEMBLER', 'role': 'Tech'},
    {'id': 'PERS-BY2', 'name': 'MARIN LEDEZMA SALAYA', 'position': 'OPERATION LEADER', 'role': 'Supervisor'},
    {'id': 'PERS-DOE', 'name': 'JOHN DOE', 'position': 'FIELD SUPPORT', 'role': 'Tech'},
]

# Mapping Assignments
assignments = {
    'BELLEFIELD': [p['id'] for p in personnel if p['id'].startswith('PERS-BF')],
    'SUN VALLEY': [p['id'] for p in personnel if p['id'].startswith('PERS-SV')],
    'THUNDERWOLF': [p['id'] for p in personnel if p['id'].startswith('PERS-TW')],
    'ALAMITO': [p['id'] for p in personnel if p['id'].startswith('PERS-AL')],
    'AES': ['PERS-PR1'],
    'BYN': ['PERS-BY1', 'PERS-BY2'],
}

projects = []
for i in range(1, 134):
    p_id = f'P{i:04d}'
    name = f'Project {i}'
    client = 'Unknown'
    size = '100MW'
    s_type = 'Solar'
    lat, lng = '30.0', '-100.0'
    status = 'Completed'
    
    if i == 1: name, client, size, lat, lng, status = 'Bellefield II Solar', 'CUST_CEN', '200MW', '35.0117', '-118.0638', 'Active'
    elif i == 2: name, client, size, lat, lng, status = 'Thundervolt Solar', 'CUST_POWER_ELEC', '300MW', '33.4354', '-112.3406', 'Active'
    elif i == 3: name, client, size, lat, lng, status = 'Alamito Solar', 'CUST_CEN', '150MW', '32.09', '-96.38', 'Active'
    elif i == 4: name, client, size, lat, lng, status = 'Byrum Solar', 'CUST_COBRA', '100MW', '31.39', '-97.55', 'Active'
    elif i == 5: name, client, size, lat, lng, status = 'Sun Valley Solar', 'CUST_POWER_ELEC', '200MW', '31.8675', '-97.0740', 'Active'
    elif i == 6: name, client, size, lat, lng, status = 'PPA Sierra Gorda', 'CUST_SUNGROW', '440MW', '-22.8986', '-68.32', 'Completed'
    elif i == 7: name, client, size, lat, lng, status = 'PFV Guajapo', 'CUST_SUNGROW', '330MW', '10.3948', '-74.9385', 'Completed'
    elif i == 8: name, client, size, lat, lng, status = 'PFV La Union', 'CUST_SUNGROW', '80MW', '10.9', '-74.3', 'Completed'
    elif i == 132: name, client, s_type, lat, lng, status = 'AES Puerto Rico Power Plant', 'CUST_AES', 'Other', '17.9632', '-66.1110', 'Active'
    elif i == 133: name, client, s_type, lat, lng, status = 'Murch Solar PV', 'CUST_GREENSOL', 'Construction', '42.1880', '-86.0300', 'Active'
    
    assigned = []
    if 'BELLEFIELD' in name.upper(): assigned = assignments['BELLEFIELD']
    elif 'SUN VALLEY' in name.upper(): assigned = assignments['SUN VALLEY']
    elif 'THUNDERWOLF' in name.upper(): assigned = assignments['THUNDERWOLF']
    elif 'ALAMITO' in name.upper(): assigned = assignments['ALAMITO']
    elif 'AES' in name.upper(): assigned = assignments['AES']
    elif 'BYN' in name.upper(): assigned = assignments['BYN']
    
    projects.append({
        'id': p_id,
        'clientId': client,
        'name': name,
        'type': 'Complete' if status == 'Active' else 'Simple',
        'status': status,
        'projectSize': size,
        'systemType': s_type,
        'progress': 45 if status == 'Active' else 100,
        'location': f'{lat},{lng}',
        'assignedPersonnel': assigned,
        'scopes': []
    })

print(json.dumps({'clients': clients, 'personnel': personnel, 'projects': projects}))
