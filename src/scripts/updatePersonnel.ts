/**
 * updatePersonnel.ts
 * -----------------
 * Bulk-updates personnel information from a spreadsheet paste (TSV).
 * 
 * Logic:
 * 1. Matches existing personnel by NAME (case-insensitive, trimmed).
 * 2. If no match is found, creates a new personnel record and a Supabase Auth account.
 * 3. Maps columns: Name, Status, Email, Positions, Number (Phone), DBO.
 * 4. Merges certification columns into the 'certifications' JSONB array.
 * 
 * DRY_RUN:
 * Set DRY_RUN = true to see a comparison report without committing changes.
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

// ==========================================
// CONFIGURATION
// ==========================================
const DRY_RUN = false; // Set to false to apply changes

/**
 * PASTE YOUR DATA HERE (Copy from Excel/Sheets and paste between the backticks)
 * Expected columns (Tab separated):
 * Name | Status | Email | Positions | Number | DBO | ...Certs...
 */
const TSV_DATA = `
NAME SUPPORT TECH	STATUS	EMAIL	POSITIONS	NUMBER	DBO	OSHA 10	FAC	WH/FP	LOTO	FIRE E	NFPA 70E 	FORKLIFT
PEDRO LUIS RAMIREZ MORENO	ACTIVE	pedroluisram1990@icloud.com	LEADER	3462429260	09/22/1990	9/24/2024	03/04/2025	03/01/2026	03/02/20206	03/02/2026	9/24/2024	
LIETER MESA VELAZCO	ACTIVE	lietermesavelazco@gmail.com	TECHNICIAN	5178027789	05/19/2003	8/30/2025	03/04/2026	03/03/2026	03/03/2026	03/04/2026	8/23/2025	
MAYLENE TORRES MALDONADO	NO ACTIVE	maylenetorresmaldonado87@gmail.com	LEADER	3463493593	08/07/1987	12/06/2024	03/02/2026	03/02/2026	03/01/2026	03/02/2026	12/05/2024	
-	NO ACTIVE	-	-	-	-	-	-	-	-	-	-	-
MILDRED BAYARD BOLANOS	ACTIVE	milbayard38@yahoo.es 	HSE	8325440690	08/24/1975	6/26/2022	02/28/2026	02/28/2026		03/05/2026	2/28/2025	
BRAINE GAMBOA MORENO	ACTIVE	braine1995@icloud.com	TECHNICIAN	3463552374	        04/23/1995	08/09/2023	04/12/2025	03/05/2026	03/04/2026	03/05/2026	9/24/2025	
JOHN AGUILAR 	ACTIVE	jaayr.9@gmail.com	TECHNICIAN	7606045834	        09/06/1990	01/23/25						
WILLIAM GIL RODRIGUEZ	ACTIVE	williamgil420@gmail.com	ASSEMBLER	3464255343	        06/27/1979	6/20/2024					09/24/2024	
GEORDANIS RODRIGUEZ NEGRE	ACTIVE	geordanisrodriges@gmail.com	ASSEMBLER	7275575458	         09/11/1987	03/03/2026	03/01/2026	03/01/2026	03/01/2026	03/01/2026	03/01/2026	
JUAN GONZALEZ	ACTIVE	Chakal815@gmail.com	TECHNICIAN	7606750622	         01/15/2000							
JOSE ASCENCIO LOPEZ	ACTIVE	Ibethrigo@gmail.com	TECHNICIAN	7609257506	08/14/1976	01/31/2025	07/04/2024		03/07/2025		06/07/2024	
SEBASTIAN RODRIGO YANCA AGUILERA	ACTIVE	syanca@latnovva.com	LEADER	3467927900	           07/25/1980	12/28/2024	07/01/2025		03/07/2025		12/28/2024	
ADRIAN RASCON	ACTIVE	adrianrascon502@yahoo.com	TECHNICIAN	7605508543	 12/06/1997	9/25/2024	03/04/2026	03/04/2026	03/07/2025	03/04/2026	10/10/2024	
CHRISTIAN FURET HERNANDEZ	ACTIVE	Christianfurethernandez28@gmail.com	ASSEMBLER	5177752101	08/28/1995	06/01/2025	03/03/2026	03/04/2026	03/04/2026	03/04/2026	5/26/2025	
FRANCISCO MARTINEZ MARRERO	ACTIVE	franciscomartinezmarrero@gmail.com	ASSEMBLER	8587896764	 12/06/1997	4/18/2025	5/15/2025				4/15/2025	
LUIS ANGEL GONZALEZ ROMEO	ACTIVE	gonzalesluisangel958@gmail.com	ASSEMBLER	5178027869	11/26/1994	07/07/2025	03/04/2026	03/04/2026	03/05/2026	03/05/2026	07/03/2025	
RICHARD RADAMEZ NUNEZ ROMEO	ACTIVE	richardnunezromeo0805@gmail.com	TECHNICIAN	8323741605	08/05/2001	5/30/2025	11/07/2025	03/03/2026	03/03/2026	03/04/2026	5/26/2025	
ALEJANDRO RODRIGUEZ GONZALEZ	ACTIVE	rodriguezgonzalez0209@gmail.com	TECHNICIAN	2814512552	02/09/1993	2/24/2025	03/01/2026	03/01/2026	03/11/2026	03/01/2026	2/28/2025	
ANABEL RODRIGUEZ VILATO	ACTIVE	anabel.vilato1997@gmail.com	TECHNICIAN	2516508279	       12/24/1997	03/09/2026	03/05/2026	03/05/2026	03/04/2026	03/04/2026	03/06/2026	
JESUS ROGELIO ORTEGA	ACTIVE	Jortega4967@gmail.com 	TECHNICIAN	7602223941	11/03/1999	08/10/2024	07/01/2025	03/01/2026	03/01/2026	03/01/2026	08/08/2024	
RICARDO OLIVA	ACTIVE	roliva@latnovva.com	OPERADOR TH	9562808290	         12/03/2003	03/01/2021	08/08/2024	03/06/2026	03/04/2026	03/05/2026	8/24/2024	
ILIANIS MERLADETE	ACTIVE	Imerladet23@gmail.com	HSE									
JUAN ALBERTO GARCIA SARIOL	ACTIVE	garciajuan1722@gmail.com 	LABORER	7864005350	03/15/1985	2/29/2024	03/03/2026	03/03/2026	03/11/2025	03/03/2026	9/23/2024	
JORGE LUIS CALDERON PEREZ	ACTIVE	 jorgeluiscalderonperez236@gmail.com  	LABORER	786 921 2568	03/17/1987  	2/27/2025	03/07/2026	03/02/2026	10/22/2025	03/02/2026	2/25/2025	
LAZARO RODRIGUEZ MARTINEZ	ACTIVE	lazarorodriguez458@gmail.com	OPERADOR SK	8325040949	12/17/1985	02/12/2024	03/02/2026		03/02/2026	03/05/2026	9/25/2024	09/12/2026
WILFREDO LOPEZ MATA	ACTIVE	wilfredolopez2033@gmail.com	LABORER	8324505021	10/31/2003	6/30/2024			03/04/2026	03/05/2026	04/11/2025	
YORDAN GUERRERO SAAVEDRA	ACTIVE	yordanguerrero83@gmail.com 	LABORER	5027922201	04/20/1983	06/10/2025	10/07/2025				06/11/2025	
NATHAN NAVARRETE	ACTIVE	Nathannavarrete92@gmail.com	LABORER	7605620105	04/23/1992 	2/23/2025	03/07/2026	03/08/2026	03/07/2026	03/08/2026	02/01/2025	
JOSHUA SANCHEZ	ACTIVE	Joshisan333@gmail.com	LABORER	9563724332	        09/03/2002	9/27/2024	03/01/2026	01/03/2026	28/02/2026	01/03/2026	09/26/2024	
EDIAGNEL RIVERA	ACTIVE	riveraurquiza19@gmail.com	OPERADOR SK	3465464725	        03/19/2002	08/09/2023	04/12/2002	03/08/2026	03/07/2025	03/06/2026	9/24/2025	
VALERIA MENDEZ	ACTIVE	valeriamendez542@gmail.com	SUVERYOR	4199840356								
DAVID MENDEZ	ACTIVE	davidface1010@gmail.com	LABORER									
RAYMOND HERNANDEZ	ACTIVE	rayminino955@gmail.com	LABORER	5022604670								
PABLO A MORA SMITH	ACTIVE	morapablo600@gmail.com	LABORER	5613606333								
JANETH LOZA	ACTIVE	janethloza.jl@gmail.com	OPERADOR PD-10									
MAILO BRAVO	NO ACTIVE	mailobravobarcelo@gmail.com	OPERADOR PD-10									
VELMORE RODRIGUEZ	ACTIVE	 valrodve@gmail.com	OPERADOR LASSER	3463071010								
MARIN LEDEZMA SALAYA	ACTIVE	mledezma@latnovva.com	OPERATION LEAD	7604858780	06/06/1991	09/10/2023					09/09/2024	
`.trim();

// Column Header Mapping (adjust indices based on your paste)
const COLS = {
    NAME: 0,
    STATUS: 1,
    EMAIL: 2,
    POSITION: 3,
    PHONE: 4,
    DBO: 5,
    CERTS_START: 6 // First certification column index
};

const CERT_NAMES = ["OSHA 10", "FAC", "WH/FP", "LOTO", "FIRE E", "NFPA 70E", "FORKLIFT"];

// ==========================================
// UTILS
// ==========================================
function normalizeName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface ParsedPerson {
    name: string;
    status: string;
    email: string;
    position: string;
    phone: string;
    dbo: string;
    certifications: { name: string; expirationDate: string }[];
}

// ==========================================
// MAIN
// ==========================================
async function runUpdate() {
    console.log(`🚀 Starting Personnel Update (DRY_RUN: ${DRY_RUN})\n`);

    // 1. Fetch Existing Personnel
    const { data: existingPersonnel, error: fetchError } = await supabaseAdmin
        .from('personnel')
        .select('*');

    if (fetchError) {
        console.error('❌ Failed to fetch existing personnel:', fetchError);
        return;
    }

    const existingMap = new Map(existingPersonnel.map(p => [normalizeName(p.name), p]));

    // 2. Parse TSV Data
    const lines = TSV_DATA.split('\n');
    const updates: any[] = [];
    const creates: any[] = [];
    const summary = {
        created: 0,
        updated: 0,
        unchanged: 0
    };

    for (const line of lines) {
        // Handle both tabs and multiple spaces as delimiters
        let parts = line.split('\t');
        if (parts.length < 6) {
            parts = line.split(/ {2,}/).filter(p => p.trim().length > 0);
        }

        if (parts.length < 5) continue;

        const name = parts[COLS.NAME]?.trim();
        if (!name || name === '-' || name === 'NAME SUPPORT TECH') continue;

        const normName = normalizeName(name);
        const email = parts[COLS.EMAIL]?.trim().toLowerCase() || '';
        if (email === '-') continue;

        const status = parts[COLS.STATUS].trim().toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive';
        const position = parts[COLS.POSITION].trim();
        const phone = parts[COLS.PHONE].trim();
        const dbo = parts[COLS.DBO].trim();

        const certifications: any[] = [];
        CERT_NAMES.forEach((certName, idx) => {
            const dateStr = parts[COLS.CERTS_START + idx]?.trim();
            if (dateStr && dateStr !== '-' && dateStr.length > 2) {
                // Convert to ISO or keep as is? User has MM/DD/YYYY. 
                // Let's try to convert to YYYY-MM-DD for consistency in the app.
                try {
                    const dateParts = dateStr.split('/');
                    if (dateParts.length === 3) {
                        const isoDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
                        certifications.push({ name: certName, expirationDate: isoDate });
                    } else {
                        certifications.push({ name: certName, expirationDate: dateStr });
                    }
                } catch {
                    certifications.push({ name: certName, expirationDate: dateStr });
                }
            }
        });

        const personData = {
            name,
            email,
            status,
            position,
            phone_number: phone,
            dbo,
            certifications
        };

        const existing = existingMap.get(normName);

        if (existing) {
            // PRIORITY: Preserve corporate emails (@latnovva.com) if the new email is personal
            const existingIsCorporate = existing.email?.toLowerCase().endsWith('@latnovva.com');
            const newIsCorporate = personData.email.endsWith('@latnovva.com');

            if (existingIsCorporate && !newIsCorporate && personData.email !== '-') {
                console.log(`   ℹ️  Preserving corporate email for ${name}: ${existing.email} (skipping personal ${personData.email})`);
                personData.email = existing.email;
            }

            // Check for changes
            const hasChanges =
                existing.email !== personData.email ||
                existing.status !== personData.status ||
                existing.position !== personData.position ||
                existing.phone_number !== personData.phone_number ||
                existing.dbo !== personData.dbo ||
                JSON.stringify(existing.certifications) !== JSON.stringify(personData.certifications);

            if (hasChanges) {
                console.log(`[UPDATE] ${name}`);
                if (existing.email !== personData.email) console.log(`   Email: ${existing.email} -> ${personData.email}`);
                if (existing.status !== personData.status) console.log(`   Status: ${existing.status} -> ${personData.status}`);
                if (existing.dbo !== personData.dbo) console.log(`   DBO: ${existing.dbo} -> ${personData.dbo}`);

                updates.push({ id: existing.id, ...personData });
                summary.updated++;
            } else {
                summary.unchanged++;
            }
        } else {
            console.log(`[CREATE] ${name} (${email})`);
            creates.push(personData);
            summary.created++;
        }
    }

    console.log('\n📊 COMPARISON SUMMARY:');
    console.log(`   New Records:     ${summary.created}`);
    console.log(`   Updated Records: ${summary.updated}`);
    console.log(`   Unchanged:       ${summary.unchanged}`);

    if (DRY_RUN) {
        console.log('\n⚠️ DRY_RUN is enabled. No changes were applied.');
        console.log('   Review the output above. If it looks correct, set DRY_RUN = false in the script and run again.');
        return;
    }

    // 3. Apply Changes
    if (creates.length > 0) {
        console.log('\n⏳ Creating/Syncing new records...');
        for (const p of creates) {
            // 1. Create/Get Auth User
            let userId: string;
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: p.email,
                email_confirm: true,
                user_metadata: { name: p.name }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    console.log(`   ℹ️  Auth user already exists for ${p.name}, fetching ID...`);
                    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                    const existingAutoUser = listData?.users.find(u => u.email?.toLowerCase() === p.email.toLowerCase());
                    if (!existingAutoUser) {
                        console.error(`   ❌ Could not find ID for existing user ${p.email}`);
                        continue;
                    }
                    userId = existingAutoUser.id;
                } else {
                    console.error(`   ❌ Failed to create auth for ${p.name}:`, authError.message);
                    continue;
                }
            } else {
                userId = authUser.user.id;
            }

            // 2. Upsert Personnel (Handles triggers that might have auto-inserted the row)
            const { error: upsertError } = await supabaseAdmin.from('personnel').upsert({
                id: userId,
                ...p
            });

            if (upsertError) {
                console.error(`   ❌ Failed to sync personnel record for ${p.name}:`, upsertError.message);
            } else {
                console.log(`   ✅ Synced: ${p.name}`);
            }
        }
    }

    if (updates.length > 0) {
        console.log('\n⏳ Updating existing records...');
        for (const p of updates) {
            const { error: updError } = await supabaseAdmin
                .from('personnel')
                .update(p)
                .eq('id', p.id);

            if (updError) {
                console.error(`   ❌ Failed to update ${p.name}:`, updError.message);
            } else {
                console.log(`   ✅ Updated: ${p.name}`);
            }
        }
    }

    console.log('\n🎉 Update process complete!');
}

runUpdate().catch(console.error);
