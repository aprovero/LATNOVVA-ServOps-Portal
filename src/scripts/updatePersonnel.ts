/**
 * updatePersonnel.ts
 * -----------------
 * RESILIENT SYNC SCRIPT: Updates personnel with the latest detailed JSON.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const DRY_RUN = false;

const PERSONNEL_JSON = [
    {
        "name": "PEDRO LUIS RAMIREZ MORENO",
        "STATUS": "ACTIVE",
        "EMAIL": "pedroluisram1990@icloud.com",
        "POSITIONS": "LEADER",
        "phone number": "3462429260",
        "DBO": "09/22/1990",
        "OSHA 10": "9/24/2024",
        "FAC": "2025-04-03",
        "WH/FP": "2026-01-03",
        "LOTO": "03/02/20206",
        "FIRE E": "2026-02-03",
        "NFPA 70E": "9/24/2024",
        "FORKLIFT": null,
        "Employee ID": 10056.0,
        "SITE": "SUN VALLEY",
        "REGULAR RATE": 25.0,
        "RAINY DAY RATE": 25.0,
        "OVERTIME RATE": 37.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "LIETER MESA VELAZCO",
        "STATUS": "ACTIVE",
        "EMAIL": "lietermesavelazco@gmail.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "5178027789",
        "DBO": "05/19/2003",
        "OSHA 10": "8/30/2025",
        "FAC": "2026-04-03",
        "WH/FP": "2026-03-03",
        "LOTO": "2026-03-03",
        "FIRE E": "2026-04-03",
        "NFPA 70E": "8/23/2025",
        "FORKLIFT": null,
        "Employee ID": null,
        "SITE": "SUN VALLEY",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "MAYLENE TORRES MALDONADO",
        "STATUS": "NO ACTIVE",
        "EMAIL": "maylenetorresmaldonado87@gmail.com",
        "POSITIONS": "LEADER",
        "phone number": "3463493593",
        "DBO": "1987-07-08",
        "OSHA 10": "2024-06-12",
        "FAC": "2026-02-03",
        "WH/FP": "2026-02-03",
        "LOTO": "2026-01-03",
        "FIRE E": "2026-02-03",
        "NFPA 70E": "2024-05-12",
        "FORKLIFT": null,
        "Employee ID": 10081.0,
        "SITE": "SUN VALLEY",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "MILDRED BAYARD BOLANOS",
        "STATUS": "ACTIVE",
        "EMAIL": "milbayard38@yahoo.es ",
        "POSITIONS": "HSE",
        "phone number": "8325440690",
        "DBO": "08/24/1975",
        "OSHA 10": "6/26/2022",
        "FAC": "02/28/2026",
        "WH/FP": "02/28/2026",
        "LOTO": null,
        "FIRE E": "2026-05-03",
        "NFPA 70E": "2/28/2025",
        "FORKLIFT": null,
        "Employee ID": 10111.0,
        "SITE": "SUN VALLEY",
        "REGULAR RATE": 22.0,
        "RAINY DAY RATE": 22.0,
        "OVERTIME RATE": 33.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "BRAINE GAMBOA MORENO",
        "STATUS": "ACTIVE",
        "EMAIL": "braine1995@icloud.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "3463552374",
        "DBO": "04/23/1995",
        "OSHA 10": "2023-09-08",
        "FAC": "2025-12-04",
        "WH/FP": "2026-05-03",
        "LOTO": "2026-04-03",
        "FIRE E": "2026-05-03",
        "NFPA 70E": "9/24/2025",
        "FORKLIFT": null,
        "Employee ID": null,
        "SITE": "BYNUM Solar (Cobra)",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JOHN AGUILAR ",
        "STATUS": "ACTIVE",
        "EMAIL": "jaayr.9@gmail.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "7606045834",
        "DBO": "09/06/1990",
        "OSHA 10": "01/23/25",
        "SITE": "BELLEFIELD II",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "WILLIAM GIL RODRIGUEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "williamgil420@gmail.com",
        "POSITIONS": "ASSEMBLER",
        "phone number": "3464255343",
        "DBO": "06/27/1979",
        "OSHA 10": "6/20/2024",
        "NFPA 70E": "09/24/2024",
        "SITE": "BELLEFIELD II",
        "REGULAR RATE": 16.0,
        "RAINY DAY RATE": 16.0,
        "OVERTIME RATE": 24.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "GEORDANIS RODRIGUEZ NEGRE",
        "STATUS": "ACTIVE",
        "EMAIL": "geordanisrodriges@gmail.com",
        "POSITIONS": "ASSEMBLER",
        "phone number": "7275575458",
        "DBO": "09/11/1987",
        "OSHA 10": "2026-03-03",
        "FAC": "2026-01-03",
        "WH/FP": "2026-01-03",
        "LOTO": "2026-01-03",
        "FIRE E": "2026-01-03",
        "NFPA 70E": "2026-01-03",
        "SITE": "BELLEFIELD II",
        "REGULAR RATE": 16.0,
        "RAINY DAY RATE": 16.0,
        "OVERTIME RATE": 24.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JUAN GONZALEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "Chakal815@gmail.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "7606750622",
        "DBO": "01/15/2000",
        "Employee ID": 10093.0,
        "SITE": "BELLEFIELD II",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JOSE ASCENCIO LOPEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "Ibethrigo@gmail.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "7609257506",
        "DBO": "08/14/1976",
        "OSHA 10": "01/31/2025",
        "FAC": "2024-04-07",
        "LOTO": "2025-07-03",
        "NFPA 70E": "2024-07-06",
        "SITE": "BELLEFIELD II",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "SEBASTIAN RODRIGO YANCA AGUILERA",
        "STATUS": "ACTIVE",
        "EMAIL": "syanca@latnovva.com",
        "POSITIONS": "LEADER",
        "phone number": "3467927900",
        "DBO": "07/25/1980",
        "OSHA 10": "12/28/2024",
        "FAC": "2025-01-07",
        "LOTO": "2025-07-03",
        "NFPA 70E": "12/28/2024",
        "SITE": "BELLEFIELD II",
        "REGULAR RATE": 25.0,
        "RAINY DAY RATE": 25.0,
        "OVERTIME RATE": 37.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "ADRIAN RASCON",
        "STATUS": "ACTIVE",
        "EMAIL": "adrianrascon502@yahoo.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "7605508543",
        "DBO": "12/06/1997",
        "OSHA 10": "9/25/2024",
        "FAC": "2026-04-03",
        "WH/FP": "2026-04-03",
        "LOTO": "2025-07-03",
        "FIRE E": "2026-04-03",
        "NFPA 70E": "2024-10-10",
        "Employee ID": 10004.0,
        "SITE": "ALAMITO",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "CHRISTIAN FURET HERNANDEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "Christianfurethernandez28@gmail.com",
        "POSITIONS": "ASSEMBLER",
        "phone number": "5177752101",
        "DBO": "08/28/1995",
        "OSHA 10": "2025-01-06",
        "FAC": "2026-03-03",
        "WH/FP": "2026-04-03",
        "LOTO": "2026-04-03",
        "FIRE E": "2026-04-03",
        "NFPA 70E": "5/26/2025",
        "SITE": "ALAMITO",
        "REGULAR RATE": 16.0,
        "RAINY DAY RATE": 16.0,
        "OVERTIME RATE": 24.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "FRANCISCO MARTINEZ MARRERO",
        "STATUS": "ACTIVE",
        "EMAIL": "franciscomartinezmarrero@gmail.com",
        "POSITIONS": "ASSEMBLER",
        "phone number": "8587896764",
        "DBO": "12/06/1997",
        "OSHA 10": "4/18/2025",
        "FAC": "5/15/2025",
        "NFPA 70E": "4/15/2025",
        "Employee ID": 10117.0,
        "SITE": "ALAMITO",
        "REGULAR RATE": 16.0,
        "RAINY DAY RATE": 16.0,
        "OVERTIME RATE": 24.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "LUIS ANGEL GONZALEZ ROMEO",
        "STATUS": "ACTIVE",
        "EMAIL": "gonzalesluisangel958@gmail.com",
        "POSITIONS": "ASSEMBLER",
        "phone number": "5178027869",
        "DBO": "11/26/1994",
        "OSHA 10": "2025-07-07",
        "FAC": "2026-04-03",
        "WH/FP": "2026-04-03",
        "LOTO": "2026-05-03",
        "FIRE E": "2026-05-03",
        "NFPA 70E": "2025-03-07",
        "SITE": "ALAMITO",
        "REGULAR RATE": 16.0,
        "RAINY DAY RATE": 16.0,
        "OVERTIME RATE": 24.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "RICHARD RADAMEZ NUNEZ ROMEO",
        "STATUS": "ACTIVE",
        "EMAIL": "richardnunezromeo0805@gmail.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "8323741605",
        "DBO": "2001-05-08",
        "OSHA 10": "5/30/2025",
        "FAC": "2025-07-11",
        "WH/FP": "2026-03-03",
        "LOTO": "2026-03-03",
        "FIRE E": "2026-04-03",
        "NFPA 70E": "5/26/2025",
        "SITE": "ALAMITO",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "ALEJANDRO RODRIGUEZ GONZALEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "rodriguezgonzalez0209@gmail.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "2814512552",
        "DBO": "1993-09-02",
        "OSHA 10": "2/24/2025",
        "FAC": "2026-01-03",
        "WH/FP": "2026-01-03",
        "LOTO": "2026-11-03",
        "FIRE E": "2026-01-03",
        "NFPA 70E": "2/28/2025",
        "SITE": "ALAMITO",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "ANABEL RODRIGUEZ VILATO",
        "STATUS": "ACTIVE",
        "EMAIL": "anabel.vilato1997@gmail.com",
        "POSITIONS": "TECHNICIAN",
        "phone number": "2516508279",
        "DBO": "12/24/1997",
        "OSHA 10": "2026-09-03",
        "FAC": "2026-05-03",
        "WH/FP": "2026-05-03",
        "LOTO": "2026-04-03",
        "FIRE E": "2026-04-03",
        "NFPA 70E": "2026-06-03",
        "SITE": "ALAMITO",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JESUS ROGELIO ORTEGA",
        "STATUS": "ACTIVE",
        "EMAIL": "Jortega4967@gmail.com ",
        "POSITIONS": "TECHNICIAN",
        "phone number": "7602223941",
        "DBO": "1999-03-11",
        "OSHA 10": "2024-10-08",
        "FAC": "2025-01-07",
        "WH/FP": "2026-01-03",
        "LOTO": "2026-01-03",
        "FIRE E": "2026-01-03",
        "NFPA 70E": "2024-08-08",
        "SITE": "ALAMITO",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "RICARDO OLIVA",
        "STATUS": "ACTIVE",
        "EMAIL": "roliva@latnovva.com",
        "POSITIONS": "OPERADOR TH",
        "phone number": "9562808290",
        "DBO": "12/03/2003",
        "OSHA 10": "2021-01-03",
        "FAC": "2024-08-08",
        "WH/FP": "2026-06-03",
        "LOTO": "2026-04-03",
        "FIRE E": "2026-05-03",
        "NFPA 70E": "8/24/2024",
        "Employee ID": 10023.0,
        "SITE": "ALAMITO",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "ILIANIS MERLADETE",
        "STATUS": "ACTIVE",
        "EMAIL": "Imerladet23@gmail.com",
        "POSITIONS": "HSE",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 22.0,
        "RAINY DAY RATE": 22.0,
        "OVERTIME RATE": 33.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JUAN ALBERTO GARCIA SARIOL",
        "STATUS": "ACTIVE",
        "EMAIL": "garciajuan1722@gmail.com ",
        "POSITIONS": "LABORER",
        "phone number": "7864005350",
        "DBO": "03/15/1985",
        "OSHA 10": "2/29/2024",
        "FAC": "2026-03-03",
        "WH/FP": "2026-03-03",
        "LOTO": "2025-11-03",
        "FIRE E": "2026-03-03",
        "NFPA 70E": "9/23/2024",
        "Employee ID": 10039.0,
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JORGE LUIS CALDERON PEREZ",
        "STATUS": "ACTIVE",
        "EMAIL": " jorgeluiscalderonperez236@gmail.com  ",
        "POSITIONS": "LABORER",
        "phone number": "786 921 2568",
        "DBO": "03/17/1987",
        "OSHA 10": "2/27/2025",
        "FAC": "2026-07-03",
        "WH/FP": "2026-02-03",
        "LOTO": "10/22/2025",
        "FIRE E": "2026-02-03",
        "NFPA 70E": "2/25/2025",
        "Employee ID": 10083.0,
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "LAZARO RODRIGUEZ MARTINEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "lazarorodriguez458@gmail.com",
        "POSITIONS": "OPERADOR SK",
        "phone number": "8325040949",
        "DBO": "12/17/1985",
        "OSHA 10": "2024-12-02",
        "FAC": "2026-02-03",
        "LOTO": "2026-02-03",
        "FIRE E": "2026-05-03",
        "NFPA 70E": "9/25/2024",
        "FORKLIFT": "2026-12-09",
        "Employee ID": 10066.0,
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "WILFREDO LOPEZ MATA",
        "STATUS": "ACTIVE",
        "EMAIL": "wilfredolopez2033@gmail.com",
        "POSITIONS": "LABORER",
        "phone number": "8324505021",
        "DBO": "10/31/2003",
        "OSHA 10": "6/30/2024",
        "LOTO": "2026-04-03",
        "FIRE E": "2026-05-03",
        "NFPA 70E": "2025-11-04",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "YORDAN GUERRERO SAAVEDRA",
        "STATUS": "ACTIVE",
        "EMAIL": "yordanguerrero83@gmail.com ",
        "POSITIONS": "LABORER",
        "phone number": "5027922201",
        "DBO": "04/20/1983",
        "OSHA 10": "2025-10-06",
        "FAC": "2025-07-10",
        "NFPA 70E": "2025-11-06",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "NATHAN NAVARRETE",
        "STATUS": "ACTIVE",
        "EMAIL": "Nathannavarrete92@gmail.com",
        "POSITIONS": "LABORER",
        "phone number": "7605620105",
        "DBO": "04/23/1992",
        "OSHA 10": "2/23/2025",
        "FAC": "2026-07-03",
        "WH/FP": "2026-08-03",
        "LOTO": "2026-07-03",
        "FIRE E": "2026-08-03",
        "NFPA 70E": "2025-01-02",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JOSHUA SANCHEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "Joshisan333@gmail.com",
        "POSITIONS": "LABORER",
        "phone number": "9563724332",
        "DBO": "09/03/2002",
        "OSHA 10": "9/27/2024",
        "FAC": "2026-01-03",
        "WH/FP": "2026-03-01",
        "LOTO": "2026-02-28",
        "FIRE E": "2026-03-01",
        "NFPA 70E": "09/26/2024",
        "Employee ID": 10064.0,
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "EDIAGNEL RIVERA",
        "STATUS": "ACTIVE",
        "EMAIL": "riveraurquiza19@gmail.com",
        "POSITIONS": "OPERADOR SK",
        "phone number": "3465464725",
        "DBO": "03/19/2002",
        "OSHA 10": "2023-09-08",
        "FAC": "2002-12-04",
        "WH/FP": "2026-08-03",
        "LOTO": "2025-07-03",
        "FIRE E": "2026-06-03",
        "NFPA 70E": "9/24/2025",
        "Employee ID": 10042.0,
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "VALERIA MENDEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "valeriamendez542@gmail.com",
        "POSITIONS": "SUVERYOR",
        "phone number": "4199840356",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 18.0,
        "RAINY DAY RATE": 18.0,
        "OVERTIME RATE": 27.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "DAVID MENDEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "davidface1010@gmail.com",
        "POSITIONS": "LABORER",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "RAYMOND HERNANDEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "rayminino955@gmail.com",
        "POSITIONS": "LABORER",
        "phone number": "5022604670",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "PABLO A MORA SMITH",
        "STATUS": "ACTIVE",
        "EMAIL": "morapablo600@gmail.com",
        "POSITIONS": "LABORER",
        "phone number": "5613606333",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "JANETH LOZA",
        "STATUS": "ACTIVE",
        "EMAIL": "janethloza.jl@gmail.com",
        "POSITIONS": "OPERADOR PD-10",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "MAILO BRAVO",
        "STATUS": "NO ACTIVE",
        "EMAIL": "mailobravobarcelo@gmail.com",
        "POSITIONS": "OPERADOR PD-10",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "VELMORE RODRIGUEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "valrodve@gmail.com",
        "POSITIONS": "OPERADOR LASSER",
        "phone number": "3463071010",
        "SITE": "MURCH SOLAR",
        "REGULAR RATE": 20.0,
        "RAINY DAY RATE": 20.0,
        "OVERTIME RATE": 30.0,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "MARIN LEDEZMA SALAYA",
        "STATUS": "ACTIVE",
        "EMAIL": "mledezma@latnovva.com",
        "POSITIONS": "OPERATION LEAD",
        "phone number": "7604858780",
        "DBO": "1991-06-06",
        "OSHA 10": "2023-10-09",
        "NFPA 70E": "2024-09-09",
        "Employee ID": 10059.0,
        "SITE": "ALAMITO",
        "REGULAR RATE": 25.0,
        "RAINY DAY RATE": 25.0,
        "OVERTIME RATE": 37.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 250.0
    },
    {
        "name": "ROSARIO GONZALEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "rosario.outsourced@example.com",
        "POSITIONS": "OUTSOURCED",
        "phone number": "7373488215",
        "SITE": "BYNUM Solar (OCA)",
        "REGULAR RATE": 15.0,
        "RAINY DAY RATE": 15.0,
        "OVERTIME RATE": 22.5,
        "MEAL ALLOWANCE": 0,
        "GAS ALLOWANCE": 0,
        "TRUCK": 0,
        "LEAD": 0,
        "TOTAL PERDIEM AMOUNT": 0
    },
    {
        "name": "JAIME VAZQUEZ",
        "STATUS": "ACTIVE",
        "EMAIL": "jaime.vazquezsr@saft.com",
        "POSITIONS": "SUPERVISOR",
        "phone number": "9044343108",
        "DBO": "11/22/1965",
        "OSHA 10": "8/27/2024",
        "FAC": "2026-07-03",
        "WH/FP": "2026-08-03",
        "LOTO": "2026-08-03",
        "FIRE E": "2026-08-03",
        "NFPA 70E": "8/27/2024",
        "FORKLIFT": "2026-07-03",
        "Employee ID": 10130.0,
        "SITE": "AES PR",
        "TRUCK": 250.0,
        "LEAD": 0.0,
        "TOTAL PERDIEM AMOUNT": 250.0,
        "REGULAR RATE": 35.0,
        "RAINY DAY RATE": 35.0,
        "OVERTIME RATE": 52.5,
        "MEAL ALLOWANCE": 60,
        "GAS ALLOWANCE": 0
    }
];

const CERT_NAMES = ["OSHA 10", "FAC", "WH/FP", "LOTO", "FIRE E", "NFPA 70E", "FORKLIFT"];

async function runUpdate() {
    console.log(`🚀 Starting Enhanced Personnel Sync...\n`);

    // 1. Fetch current data for mapping
    console.log(`📦 Fetching current Auth user list...`);
    const { data: authUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) { console.error(`❌ Failed to fetch user list: ${listErr.message}`); return; }
    const authMap = new Map(authUsers.users.map(u => [u.email?.toLowerCase(), u.id]));

    console.log(`🏗️ Fetching projects for site assignment...`);
    const { data: projectsDB, error: projErr } = await supabaseAdmin.from('projects').select('id, name, assigned_personnel');
    if (projErr) { console.error(`❌ Failed to fetch projects: ${projErr.message}`); return; }
    
    // Project identity map: Name -> Project Object
    const projectMap = new Map(projectsDB.map(p => [p.name.trim().toUpperCase(), p]));
    // Assignment tracker: ProjectID -> Set of Personnel IDs
    const newAssignments = new Map<string, Set<string>>();
    projectsDB.forEach(p => newAssignments.set(p.id, new Set(p.assigned_personnel || [])));

    let syncedCount = 0;

    for (const p of PERSONNEL_JSON) {
        const name = p.name.trim();
        const email = p.EMAIL ? p.EMAIL.trim().toLowerCase() : `${name.toLowerCase().replace(/\s+/g, '.')}@temporary.com`;
        const position = p.POSITIONS ? p.POSITIONS.trim() : 'Technician';
        const phone = (p as any)["phone number"] || '';
        const dbo = (p as any).DBO ? (p as any).DBO.trim() : '';
        const empId = (p as any)["Employee ID"] ? String((p as any)["Employee ID"]) : '';

        const personData = {
            name,
            email,
            status: p.STATUS.trim().toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive',
            position,
            phone_number: phone,
            employee_number: empId,
            dbo,
            app_role: (position.includes('LEAD') || position.includes('MANAGER') || position.includes('HSE') || position.includes('SUPERVISOR')) ? 'Supervisor' : 'Tech',
            regular_rate: (p as any)["REGULAR RATE"] || null,
            rainy_day_rate: (p as any)["RAINY DAY RATE"] || null,
            overtime_rate: (p as any)["OVERTIME RATE"] || null,
            meal_allowance: (p as any)["MEAL ALLOWANCE"] || null,
            gas_allowance: (p as any)["GAS ALLOWANCE"] || null,
            truck_allowance: (p as any)["TRUCK"] || null,
            lead_pay: (p as any)["LEAD"] || null,
            per_diem: (p as any)["TOTAL PERDIEM AMOUNT"] || null,
            certifications: CERT_NAMES.map(c => ({ name: c, expirationDate: (p as any)[c] })).filter(c => !!c.expirationDate)
        };

        // Identity Resolution
        let userId = authMap.get(email);
        if (!userId) {
            console.log(`⏳ Creating Auth: ${name}...`);
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email, email_confirm: true, user_metadata: { name }
            });
            if (authError) { console.error(`   ❌ Auth error for ${name}:`, authError.message); continue; }
            userId = authUser.user.id;
        }

        // Upsert Personnel
        const { error: upsertError } = await supabaseAdmin.from('personnel').upsert({ id: userId, ...personData });
        if (upsertError) {
            console.error(`   ❌ DB error for ${name}: ${upsertError.message}`);
        } else {
            console.log(`   ✅ Synced: ${name}`);
            syncedCount++;

            // Intelligent Project Assignment
            if (p.SITE) {
                const matchedProj = projectMap.get(p.SITE.trim().toUpperCase());
                if (matchedProj) {
                    newAssignments.get(matchedProj.id)?.add(userId);
                }
            }
        }
    }

    // Update Projects with new personnel assignments
    console.log(`\n🔗 Updating Project Assignments...`);
    for (const [projId, personnelSet] of newAssignments.entries()) {
        const personnelArray = Array.from(personnelSet);
        const { error: updateErr } = await supabaseAdmin
            .from('projects')
            .update({ assigned_personnel: personnelArray })
            .eq('id', projId);
        
        if (updateErr) {
            console.error(`   ❌ Failed to update project ${projId}: ${updateErr.message}`);
        } else {
            const projName = projectsDB.find(p => p.id === projId)?.name;
            console.log(`   ✅ Project "${projName}" now has ${personnelArray.length} workers assigned.`);
        }
    }

    console.log(`\n🎉 Sync complete! Personnel: ${syncedCount} | Projects Updated: ${newAssignments.size}`);
}

runUpdate().catch(console.error);
