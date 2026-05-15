import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

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

// Set to false to actually insert the timesheets into the database
const DRY_RUN = false;

// The exact payload you provided:
const RAW_TIMESHEETS = [
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548",
    "project_id": "c95e8081-3323-4c55-87f5-259207865768",
    "date": "2026-04-23",
    "time_in": "08:01",
    "time_out": "18:20",
    "hours": 9.32,
    "type": "On Site",
    "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548",
    "project_id": "c95e8081-3323-4c55-87f5-259207865768",
    "date": "2026-04-24",
    "time_in": "08:00",
    "time_out": "17:00",
    "hours": 8.0,
    "type": "Home Office",
    "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548",
    "project_id": "c95e8081-3323-4c55-87f5-259207865768",
    "date": "2026-04-27",
    "time_in": "08:12",
    "time_out": "22:51",
    "hours": 13.65,
    "type": "On Site",
    "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548",
    "project_id": "c95e8081-3323-4c55-87f5-259207865768",
    "date": "2026-04-28",
    "time_in": "07:58", "time_out": "20:43", "hours": 11.75, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:14", "time_out": "20:56", "hours": 11.7, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "08:22", "time_out": "21:45", "hours": 12.38, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:15", "time_out": "19:03", "hours": 9.8, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:10", "time_out": "20:11", "hours": 11.02, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "08:35", "time_out": "19:53", "hours": 10.3, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "bdc422cb-4261-431c-a6f4-9ec32a7f2548", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:11", "time_out": "19:18", "hours": 10.12, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "08:19", "time_out": "18:03", "hours": 8.73, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:19", "time_out": "18:03", "hours": 8.73, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "08:16", "time_out": "18:04", "hours": 8.8, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:19", "time_out": "18:11", "hours": 8.87, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:18", "time_out": "18:08", "hours": 8.83, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "08:23", "time_out": "18:06", "hours": 8.72, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:18", "time_out": "18:01", "hours": 8.72, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:18", "time_out": "18:02", "hours": 8.73, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "08:16", "time_out": "18:03", "hours": 8.78, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "4cdb73e7-4aba-4131-bdf6-ef80055093ae", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:11", "time_out": "18:08", "hours": 8.95, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "dd408924-77f9-4059-af8d-ed50773ac592", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:00", "time_out": "18:00", "hours": 9.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "e929c8f1-13a0-4732-8e85-2715e7165678", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "08:45", "time_out": "20:37", "hours": 10.87, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "e929c8f1-13a0-4732-8e85-2715e7165678", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "e929c8f1-13a0-4732-8e85-2715e7165678", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:37", "time_out": "18:53", "hours": 9.27, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "e929c8f1-13a0-4732-8e85-2715e7165678", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:36", "time_out": "20:17", "hours": 10.68, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "e929c8f1-13a0-4732-8e85-2715e7165678", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:34", "time_out": "18:01", "hours": 8.45, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "e929c8f1-13a0-4732-8e85-2715e7165678", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:04", "time_out": "18:51", "hours": 9.78, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "07:22", "time_out": "17:40", "hours": 9.3, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "07:53", "time_out": "17:39", "hours": 8.77, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "07:51", "time_out": "17:40", "hours": 8.82, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "07:50", "time_out": "17:18", "hours": 8.47, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:08", "time_out": "13:15", "hours": 4.12, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "ec4be14a-7149-4d24-ba2b-a38d6c3252da", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:07", "time_out": "17:15", "hours": 8.13, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "09:04", "time_out": "21:58", "hours": 11.9, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "09:09", "time_out": "22:43", "hours": 12.57, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "08:45", "time_out": "19:52", "hours": 10.12, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:38", "time_out": "19:03", "hours": 9.42, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:52", "time_out": "20:17", "hours": 10.42, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "09:00", "time_out": "19:52", "hours": 9.87, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:29", "time_out": "18:43", "hours": 9.23, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "08:51", "time_out": "19:27", "hours": 9.6, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "9efbd072-c3ad-4922-bd70-3c976b3be323", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:47", "time_out": "20:28", "hours": 10.68, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "08:40", "time_out": "18:15", "hours": 8.58, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:37", "time_out": "17:08", "hours": 7.52, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "08:31", "time_out": "18:28", "hours": 8.95, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:26", "time_out": "18:56", "hours": 9.5, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:34", "time_out": "18:27", "hours": 8.88, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "08:35", "time_out": "19:12", "hours": 9.62, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:30", "time_out": "18:39", "hours": 9.15, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:24", "time_out": "18:43", "hours": 9.32, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "08:34", "time_out": "18:08", "hours": 8.57, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "60d5577f-8407-4e6a-b562-2bba752981d1", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:29", "time_out": "18:35", "hours": 9.1, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "644d56f8-ed44-4bea-bef6-1978722f0bb6", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "644d56f8-ed44-4bea-bef6-1978722f0bb6", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "644d56f8-ed44-4bea-bef6-1978722f0bb6", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "644d56f8-ed44-4bea-bef6-1978722f0bb6", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "08:29", "time_out": "18:06", "hours": 8.62, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "644d56f8-ed44-4bea-bef6-1978722f0bb6", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "08:21", "time_out": "18:30", "hours": 9.15, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "644d56f8-ed44-4bea-bef6-1978722f0bb6", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "08:00", "time_out": "18:36", "hours": 9.6, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:02", "time_out": "18:11", "hours": 9.15, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "07:54", "time_out": "18:54", "hours": 10.0, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:03", "time_out": "18:42", "hours": 9.65, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "07:58", "time_out": "19:15", "hours": 10.28, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "07:50", "time_out": "19:58", "hours": 11.13, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:01", "time_out": "20:14", "hours": 11.22, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:00", "time_out": "17:53", "hours": 8.88, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "07:56", "time_out": "11:33", "hours": 2.62, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "16bd6e89-de14-417c-8701-60da51dfead0", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "07:46", "time_out": "18:25", "hours": 9.65, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "07:49", "time_out": "18:10", "hours": 9.35, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "07:47", "time_out": "18:09", "hours": 9.37, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "07:52", "time_out": "18:06", "hours": 9.23, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "07:51", "time_out": "18:23", "hours": 9.53, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "07:57", "time_out": "18:02", "hours": 9.08, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "07:43", "time_out": "18:06", "hours": 9.38, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "07:37", "time_out": "18:06", "hours": 9.48, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "07:47", "time_out": "18:17", "hours": 9.5, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "eabdaa71-a05c-41a9-8a82-14bcebebb584", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "07:52", "time_out": "18:15", "hours": 9.38, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-23", "time_in": "10:37", "time_out": "21:58", "hours": 10.35, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-24", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-27", "time_in": "10:11", "time_out": "21:03", "hours": 9.87, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-28", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-29", "time_in": "10:01", "time_out": "20:04", "hours": 9.05, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-04-30", "time_in": "09:25", "time_out": "20:42", "hours": 10.28, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-04", "time_in": "08:44", "time_out": "20:14", "hours": 10.5, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-05", "time_in": "08:00", "time_out": "17:00", "hours": 8.0, "type": "Home Office", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-06", "time_in": "09:28", "time_out": "21:36", "hours": 11.13, "type": "On Site", "notes": ""
  },
  {
    "personnel_id": "a5ebfe1d-7941-48bb-b78d-053642a3de8c", "project_id": "c95e8081-3323-4c55-87f5-259207865768", "date": "2026-05-07", "time_in": "09:20", "time_out": "20:52", "hours": 10.53, "type": "On Site", "notes": ""
  }
];

async function run() {
    console.log(`🚀 Starting Direct Timesheet Import... (DRY_RUN=${DRY_RUN})`);
    
    // Add required system fields (id, status, source)
    const timesheetsToInsert = RAW_TIMESHEETS.map(row => {
        return {
            ...row,
            id: uuidv4(), // Must be a strict UUID format for PostgreSQL
            project_id: row.project_id, // Use the project ID from the JSON payload
            status: 'Approved',
            source: 'manual', 
            manual_reason: 'Batch imported from provided payload payload'
        };
    });

    if (DRY_RUN) {
        console.log(`\n👀 DRY RUN: Formatted ${timesheetsToInsert.length} timesheets.`);
        console.log("Here is the first item:");
        console.log(JSON.stringify(timesheetsToInsert[0], null, 2));
        console.log("\nIf this looks correct, set `const DRY_RUN = false;` and run again.");
        return;
    }

    console.log(`Inserting ${timesheetsToInsert.length} records into 'timesheets' table...`);
    
    // Chunking inserts to avoid overwhelming Supabase API if the list grows
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
}

run().catch(console.error);
