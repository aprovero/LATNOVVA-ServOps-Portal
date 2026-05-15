import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const DRY_RUN = true;

// Define the path to your CSV file
const CSV_FILE_PATH = path.resolve(__dirname, 'timesheets.csv');

// Dictionary mapping Exact Name to Supabase personnel_id
const PERSONNEL_NAME_MAPPING: Record<string, string> = {
  "JALDO RONQUILLO DANIEL": "e8655a11-ee7a-474e-9f08-857431d971c1",
  "MARTINEZ BRISEÑO JACQUELINE": "9efbd072-c3ad-4922-bd70-3c976b3be323",
  "ORTIZ MEDINA MANUEL JESUS": "644d56f8-ed44-4bea-bef6-1978722f0bb6",
  "RODRIGUEZ BARBOSA JORGE": "096574ac-2229-49bc-9538-dd36cd3a60ee",
  "SILVA LOPEZ MIGUEL EDUARDO": "cc78fbe6-7090-4723-ae7f-5b95384dbebe",
  "VALENZUELA HERNANDEZ LUZ ELENA": "5b7adf57-ced0-4af8-b9d5-fa7e08211b6a",
  "VARELA ROJAS MARIA GUADALUPE": "61245ca5-8ceb-4c45-bb6a-702d00cd3f3c",
  "VILLAGRAN NAVA SERGIO ENRIQUE": "f69662a1-cd06-4fe4-8038-eb73c366441d",
  "VILLEGAS RAMIREZ OSCAR EDUARDO": "ca3aa2ff-a4f3-49fd-8dc9-b3ccba135be1",
  "CAAMAL HERNANDEZ LUIS ALBERTO": "bdc422cb-4261-431c-a6f4-9ec32a7f2548",
  "FERNANDEZ RIVERA FERNANDO BENJAMIN": "4cdb73e7-4aba-4131-bdf6-ef80055093ae",
  "FLORES PEREGRINO CESAR EDUARDO": "dd408924-77f9-4059-af8d-ed50773ac592",
  "JIMENEZ OLVERA BRENDA EVELYN": "e929c8f1-13a0-4732-8e85-2715e7165678",
  "MARIN HERES MARIA DEL ROCIO MAVILA": "ec4be14a-7149-4d24-ba2b-a38d6c3252da",
  "MIRANDA COCOM LUIS ANTONIO": "9e83f008-b5c6-4d3b-aa2a-14b164802043",
  "MIRANDA MONTIEL MARCO ANTONIO": "60d5577f-8407-4e6a-b562-2bba752981d1",
  "RANGEL RAMOS NANCY SANDI": "16bd6e89-de14-417c-8701-60da51dfead0",
  "REYES BAQUEDANO SILVIA MARIELA": "eabdaa71-a05c-41a9-8a82-14bcebebb584",
  "REYES MONTES DE OCA JUANA DEL CARMEN": "a5ebfe1d-7941-48bb-b78d-053642a3de8c"
};

// Replace this with a real project ID from your database!
const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

async function run() {
    console.log(`🚀 Starting Timesheet CSV Import... (DRY_RUN=${DRY_RUN})`);
    
    // Check if CSV exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`❌ Cannot find CSV file at: ${CSV_FILE_PATH}`);
        console.log("Please create 'timesheets.csv' in the src/scripts directory.");
        process.exit(1);
    }

    const timesheetsToInsert: any[] = [];

    // Parse the CSV file
    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            // Trim whitespace from the name just in case the CSV is messy
            const employeeName = row.Name ? row.Name.trim().toUpperCase() : undefined; 
            
            if (!employeeName) {
                console.warn(`⚠️ Warning: Row missing 'Name' column. Skipping...`);
                return;
            }

            const dbPersonnelId = PERSONNEL_NAME_MAPPING[employeeName];

            if (!dbPersonnelId) {
                console.warn(`⚠️ Warning: Employee Name '${employeeName}' not found in mapping dictionary. Skipping row...`);
                return;
            }

            // Build the timesheet payload exactly matching the database schema
            timesheetsToInsert.push({
                id: `TS-${row.Date}-${uuidv4().substring(0, 8)}`, // Unique ID
                personnel_id: dbPersonnelId,
                project_id: DEFAULT_PROJECT_ID, // Use real project ID!
                date: row.Date, // Expecting YYYY-MM-DD from CSV
                time_in: row.Time_In || "08:00", 
                time_out: row.Time_Out || "17:00", 
                hours: parseFloat(row.Hours), 
                type: row.Type || "On Site", 
                classification: row.Classification || "Regular", 
                status: 'Approved',
                source: 'manual', 
                manual_reason: 'Initial Data Migration from CSV',
                notes: row.Notes || ""
            });
        })
        .on('end', async () => {
            console.log(`\n✅ CSV Parsing Complete. Prepared ${timesheetsToInsert.length} timesheets.`);

            if (timesheetsToInsert.length === 0) {
                console.log("⚠️ No valid timesheets found. Check your CSV headers (Name, Date, Hours) and try again.");
                return;
            }

            if (DRY_RUN) {
                console.log("\n👀 DRY RUN: Here is a sample of what will be inserted:");
                console.log(JSON.stringify(timesheetsToInsert[0], null, 2));
                console.log("\nIf this looks correct, set `const DRY_RUN = false;` and run again.");
                return;
            }

            console.log(`Inserting ${timesheetsToInsert.length} records into 'timesheets' table...`);
            
            // Chunking inserts to avoid overwhelming Supabase API if CSV is very large
            const chunkSize = 100;
            for (let i = 0; i < timesheetsToInsert.length; i += chunkSize) {
                const chunk = timesheetsToInsert.slice(i, i + chunkSize);
                const { error } = await supabaseAdmin.from('timesheets').insert(chunk);
                
                if (error) {
                    console.error(`❌ Error inserting batch ${i} to ${i + chunk.length}:`, error);
                } else {
                    console.log(`✅ Inserted timesheets ${i} to ${i + chunk.length}`);
                }
            }
            console.log("🎉 All Timesheets Imported Successfully!");
        });
}

run().catch(console.error);
