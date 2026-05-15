import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const MOCK_DATA = [
  {
    "employee_id": "MX-SYS-0011",
    "name": "SANTIAGO CASTRO MIGUEL ANGEL",
    "position": "TECNICO DE ESTUDIO Y OFERTA",
    "email": "mascpr99@gmail.com",
    "phoneNumber": "782 168 0567",
    "status": "Active",
    "subsidiary": "MX",
    "onboardingDate": "05/01/2026",
    "subsidiaryMetadata": {
      "projectAssigned": "EST-LNV-000 CDMX",
      "imssDate": "05/01/2026",
      "hireDate": "05/01/2026",
      "curp": "SACM991215HVZNSG09",
      "rfc": "SACM9912153D8",
      "nss": "83169944697",
      "age": 26,
      "gender": "MASCULINO",
      "maritalStatus": "SOLTERO(A)",
      "addressFull": "C.BOCA JUNIORS NO.  2 COL.ARBOLEDAS DEL SUR TLALPAN CIUDAD DE MEXICO C.P.14376",
      "contractDuration": "6 MESES",
      "probationExpiry": "04/07/2026",
      "bank": "BBVA",
      "clabe": "12180015803405501",
      "nominaPpp": 16800.0,
      "nominaImss": 11200.0,
      "totalGross": 28000.0,
      "ine": "IDMEX1734132696",
      "legalEntity": "SYS"
    }
  },
  {
    "employee_id": "MX-LNV-0010",
    "name": "TOMASINI ANZA ALEJANDRO",
    "position": "TECNICO DE COSTOS",
    "email": "alejandro.tomasini@latnovva.com",
    "phoneNumber": "962 141 5248",
    "status": "Active",
    "subsidiary": "MX",
    "onboardingDate": "01/02/2026",
    "subsidiaryMetadata": {
      "projectAssigned": "EST-LNV-000 MID",
      "imssDate": "01/02/2026",
      "hireDate": "01/02/2026",
      "curp": "TOAA000908HCSMNLA5",
      "rfc": "TOAA000908FN1",
      "nss": "5220059827",
      "age": 25,
      "gender": "MASCULINO",
      "maritalStatus": "SOLTERO(A)",
      "addressFull": "C.DE LA SOYA NO.  5 COL.FRACC TULIPANES TAPACHULA  CHIAPAS C.P.30797",
      "contractDuration": "6 MESES",
      "probationExpiry": "31/07/2026",
      "bank": "SANTANDER",
      "clabe": "14910569153997496",
      "nominaPpp": 16000.0,
      "nominaImss": 9000.0,
      "totalGross": 25000.0,
      "ine": "IDMEX1781233900",
      "legalEntity": "LATNOVVA"
    }
  },
  {
    "employee_id": "MX-SYS-0012",
    "name": "TRINIDAD OLVERA AURELIO",
    "position": "RESPONSABLE DE COMPRAS",
    "email": "atrinidad@latnovva.com",
    "phoneNumber": "5559435322",
    "status": "Active",
    "subsidiary": "MX",
    "onboardingDate": "11/10/2021",
    "subsidiaryMetadata": {
      "projectAssigned": "EST-LNV-000 CDMX",
      "imssDate": "11/10/2021",
      "hireDate": "11/10/2021",
      "curp": "TIOA701121HMCRLR04",
      "rfc": "TIOA7011214P9",
      "nss": "1027000882",
      "age": 55,
      "gender": "MASCULINO",
      "maritalStatus": "CASADO(A)",
      "addressFull": "C.SME NO.  211 COL.FRACC. LOS PINOS TULANCINGO HIDALGO C.P.43612",
      "contractDuration": "INDETERMINADO",
      "probationExpiry": null,
      "bank": "BBVA",
      "clabe": "12180015857840853",
      "nominaPpp": 6000.0,
      "nominaImss": 26000.0,
      "totalGross": 32000.0,
      "ine": "´0740032329999",
      "legalEntity": "SYS"
    }
  },
  {
    "employee_id": "MX-SYS-0013",
    "name": "VALERIO LUNA ARTURO",
    "position": "RESPONSABLE DE COMPRAS",
    "email": "avaleriol1000@gmail.com",
    "phoneNumber": "55 7891 6894",
    "status": "Active",
    "subsidiary": "MX",
    "onboardingDate": "23/02/2026",
    "subsidiaryMetadata": {
      "projectAssigned": "EST-LNV-000 CDMX",
      "imssDate": "23/02/2026",
      "hireDate": "23/02/2026",
      "curp": "VALA921125HDFLNR00",
      "rfc": "VALA921125I9A",
      "nss": "42109220527",
      "age": 33,
      "gender": "MASCULINO",
      "maritalStatus": "SOLTERO(A)",
      "addressFull": "C.VIOLETA NO.  SN COL.CARLOS HANK GONZALEZ IZTAPALAPA CIUDAD DE MEXICO C.P.09700",
      "contractDuration": "6 MESES",
      "probationExpiry": "22/08/2026",
      "bank": "BBVA",
      "clabe": "12180015433964182",
      "nominaPpp": 18000.0,
      "nominaImss": 12000.0,
      "totalGross": 30000.0,
      "ine": "IDMEX2228561970",
      "legalEntity": "SYS"
    }
  },
  {
    "employee_id": "MX-SYS-0014",
    "name": "VILLANUEVA PALMA NICOLE MARINA",
    "position": "RESPONSABLE JURIDICO",
    "email": "nvillanueva@latnovva.com",
    "phoneNumber": " 999 272 8509",
    "status": "Active",
    "subsidiary": "MX",
    "onboardingDate": "16/10/2025",
    "subsidiaryMetadata": {
      "projectAssigned": "EST-LNV-000 MID",
      "imssDate": "16/10/2025",
      "hireDate": "16/10/2025",
      "curp": "VIPN971024MYNLLC08",
      "rfc": "VIPN971024DY3",
      "nss": "5139745045",
      "age": 29,
      "gender": "FEMENINO",
      "maritalStatus": "SOLTERO(A)",
      "addressFull": "C. NO.  264A COL.MONTES DE AME MERIDA YUCATAN C.P.97115",
      "contractDuration": "6 MESES",
      "probationExpiry": "15/10/2026",
      "bank": "BBVA",
      "clabe": "12180015962928181",
      "nominaPpp": 14100.0,
      "nominaImss": 9400.0,
      "totalGross": 23500.0,
      "ine": "IDMEX1484532351",
      "legalEntity": "SYS"
    }
  },
  {
    "employee_id": "MX-SYS-0015",
    "name": "YAM ORTIZ JOSUE YOVANI",
    "position": "OFICINA TECNICA",
    "email": "jyovani13@gmail.com",
    "phoneNumber": "999 198 4320",
    "status": "Active",
    "subsidiary": "MX",
    "onboardingDate": "05/01/2026",
    "subsidiaryMetadata": {
      "projectAssigned": "EST-LNV-000 MID",
      "imssDate": "05/01/2026",
      "hireDate": "05/01/2026",
      "curp": "YAOJ000627HYNMRSA8",
      "rfc": "YAOJ000627FE1",
      "nss": "48160031059",
      "age": 26,
      "gender": "MASCULINO",
      "maritalStatus": "SOLTERO(A)",
      "addressFull": "C.CJON 16  NO.  330B COL.SANTIAGO DCASTILLO MOTUL MOTUL C.P.97430",
      "contractDuration": "6 MESES",
      "probationExpiry": "04/07/2026",
      "bank": "BBVA",
      "clabe": "12180015505980418",
      "nominaPpp": 11000.0,
      "nominaImss": 9000.0,
      "totalGross": 20000.0,
      "ine": "IDMEX1770969218",
      "legalEntity": "SYS"
    }
  }
];

const PROJECT_EST_LNV_000_MID = "c95e8081-3323-4c55-87f5-259207865768";
const PROJECT_EST_LNV_000 = "f0eead03-0e28-43fa-96c2-7480bdd579b7";

async function run() {
    console.log(`🚀 Starting Remaining Personnel Import...`);

    const personnelToInsert = MOCK_DATA.map(emp => ({
        id: uuidv4(),
        employee_number: emp.employee_id,
        name: emp.name,
        position: emp.position,
        email: emp.email,
        phone_number: emp.phoneNumber,
        status: emp.status,
        app_role: 'Tech',
        subsidiary: emp.subsidiary,
        subsidiary_metadata: emp.subsidiaryMetadata,
        certifications: []
    }));

    // Insert personnel
    const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('personnel')
        .insert(personnelToInsert)
        .select('id, name, subsidiary_metadata');

    if (insertError) {
        console.error("❌ Error inserting personnel:", insertError);
        return;
    }

    console.log(`✅ Successfully imported ${insertedData.length} missing personnel!`);

    // Group the newly inserted IDs by their assigned project
    const newMidIds = insertedData
        .filter(emp => emp.subsidiary_metadata?.projectAssigned?.includes("MID"))
        .map(emp => emp.id);

    const newRegularIds = insertedData
        .filter(emp => !emp.subsidiary_metadata?.projectAssigned?.includes("MID"))
        .map(emp => emp.id);

    // Fetch existing assigned_personnel for MID
    const { data: midProject } = await supabaseAdmin
        .from('projects')
        .select('assigned_personnel')
        .eq('id', PROJECT_EST_LNV_000_MID)
        .single();

    // Fetch existing assigned_personnel for Regular
    const { data: regularProject } = await supabaseAdmin
        .from('projects')
        .select('assigned_personnel')
        .eq('id', PROJECT_EST_LNV_000)
        .single();

    if (newMidIds.length > 0) {
        const updatedMidTeam = [...(midProject?.assigned_personnel || []), ...newMidIds];
        await supabaseAdmin
            .from('projects')
            .update({ assigned_personnel: updatedMidTeam })
            .eq('id', PROJECT_EST_LNV_000_MID);
        console.log(`✅ Assigned ${newMidIds.length} new personnel to EST-LNV-000 MID`);
    }

    if (newRegularIds.length > 0) {
        const updatedRegularTeam = [...(regularProject?.assigned_personnel || []), ...newRegularIds];
        await supabaseAdmin
            .from('projects')
            .update({ assigned_personnel: updatedRegularTeam })
            .eq('id', PROJECT_EST_LNV_000);
        console.log(`✅ Assigned ${newRegularIds.length} new personnel to EST-LNV-000 (CDMX)`);
    }

    console.log("🎉 All 6 missing personnel have been imported and assigned!");
}

run().catch(console.error);
