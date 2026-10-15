-- ==============================================================================
-- PASS 13I-V: PROPOSED INITIAL GEOFENCE SEED SET (READ ONLY - DO NOT EXECUTE)
-- Generated At: 2026-10-15T04:16:07.388Z
-- Ready to seed: 25 projects
-- Blocked: 2 projects
-- Effective From Timestamp: 2026-10-15 00:00:00+00
-- ==============================================================================

BEGIN;

-- [1/25] Oficina CDMX (Project ID: a68210e5-d579-4e6f-b2d3-af1a9d3a4911)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '74425b02-ae11-41b6-a65d-cd0866adf002'::uuid,
    'a68210e5-d579-4e6f-b2d3-af1a9d3a4911'::uuid,
    1,
    19.4293,
    -99.1724,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: Oficina CDMX'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [2/25] OPDE-LNV-085 (Project ID: 4fe5c8c4-f381-4f4f-a6c2-fa54ee0838de)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'eb15b1d7-8ee9-4142-a922-002e6ea0bbdd'::uuid,
    '4fe5c8c4-f381-4f4f-a6c2-fa54ee0838de'::uuid,
    1,
    21.9167,
    -101.9667,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: OPDE-LNV-085'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [3/25] GE-LNV-123 (Project ID: 8e77400e-efda-438f-9fcb-44d003121629)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'cf6f1692-4a62-4a0c-a025-b95d520eeffe'::uuid,
    '8e77400e-efda-438f-9fcb-44d003121629'::uuid,
    1,
    19.5614,
    -97.2428,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GE-LNV-123'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [4/25] GR-LNV-094 (Project ID: 1ee84b64-a16d-4a06-8be9-97302819dd1d)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '2d183788-aace-4952-a0e0-895233167c3a'::uuid,
    '1ee84b64-a16d-4a06-8be9-97302819dd1d'::uuid,
    1,
    32.6245,
    -115.4523,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GR-LNV-094'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [5/25] GR-LNV-095 (Project ID: 7b46a034-87cb-4379-a6ca-8a01f195d130)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '95cfc173-e75c-4268-a811-4a204fa505b5'::uuid,
    '7b46a034-87cb-4379-a6ca-8a01f195d130'::uuid,
    1,
    20.6296,
    -87.0739,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GR-LNV-095'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [6/25] CH-LNVEM-090 (Project ID: fbf941fd-75ee-4770-b668-c3b4afbe0d94)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'ae27f35a-f33a-4614-a42e-3ba4b7bd945d'::uuid,
    'fbf941fd-75ee-4770-b668-c3b4afbe0d94'::uuid,
    1,
    20.9889,
    -89.6133,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: CH-LNVEM-090'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [7/25] VM-LNV-098 (Project ID: 521e3442-222b-4944-98f8-2a060e948a09)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'cfd8d92b-42b7-4e85-abd7-962486bd8021'::uuid,
    '521e3442-222b-4944-98f8-2a060e948a09'::uuid,
    1,
    25.6866,
    -100.3161,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: VM-LNV-098'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [8/25] LNVEM-LNV-068 (Project ID: 6b3bb78f-67dc-4f43-add6-c44a3807d5cf)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '092ac037-7ef0-48f2-a07c-eeafa5c3ea1f'::uuid,
    '6b3bb78f-67dc-4f43-add6-c44a3807d5cf'::uuid,
    1,
    20.9674,
    -89.6236,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: LNVEM-LNV-068'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [9/25] Test (Project ID: e32c1e4a-8de0-4bd8-9ccd-f79797f9f882)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '786c9b5e-5b02-4e85-a0c3-9546774917f8'::uuid,
    'e32c1e4a-8de0-4bd8-9ccd-f79797f9f882'::uuid,
    1,
    19.4326,
    -99.1332,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: Test'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [10/25] SK-LNV-117 (Project ID: e2db03da-0849-4ead-9307-72f060c70c05)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '4e6e8d18-6d51-4e46-a697-d0c8ea4d944f'::uuid,
    'e2db03da-0849-4ead-9307-72f060c70c05'::uuid,
    1,
    19.3553,
    -99.6436,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: SK-LNV-117'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [11/25] EL-LNV-131 (Project ID: edd5426e-3f66-402d-980f-85f9fc9828bb)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'fd521c2d-a3b2-4bf7-a576-60b084293f61'::uuid,
    'edd5426e-3f66-402d-980f-85f9fc9828bb'::uuid,
    1,
    20.9674,
    -89.6236,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: EL-LNV-131'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [12/25] Mérida (Project ID: c95e8081-3323-4c55-87f5-259207865768)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '5140fe05-0958-452e-a524-4e258af045b9'::uuid,
    'c95e8081-3323-4c55-87f5-259207865768'::uuid,
    1,
    20.9889,
    -89.6133,
    500.00,
    150,
    TRUE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: Mérida'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [13/25] KE-LNV-122 (Project ID: db2bcf50-fe8e-4c16-8255-24610f81fc75)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '1ec26525-b94c-461a-ae65-b29c309f629a'::uuid,
    'db2bcf50-fe8e-4c16-8255-24610f81fc75'::uuid,
    1,
    25.5428,
    -103.4068,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: KE-LNV-122'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [14/25] EST-LNV-000 (Project ID: f0eead03-0e28-43fa-96c2-7480bdd579b7)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'c6548790-9e73-4052-ac25-db878d055c75'::uuid,
    'f0eead03-0e28-43fa-96c2-7480bdd579b7'::uuid,
    1,
    19.4293,
    -99.1724,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: EST-LNV-000'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [15/25] DHL-LNV-120 (Project ID: 42c213a3-f619-425b-939d-78168df9d891)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '05a82898-f90f-42fd-ac31-02d67edaa92e'::uuid,
    '42c213a3-f619-425b-939d-78168df9d891'::uuid,
    1,
    19.3664718,
    -99.1900566,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: DHL-LNV-120'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [16/25] DHL-LVN-121 (Project ID: 2c52e976-179b-4a8b-a446-6ca5cf2c2724)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '34553c3c-1657-4f18-ae71-468f37b17a2d'::uuid,
    '2c52e976-179b-4a8b-a446-6ca5cf2c2724'::uuid,
    1,
    19.3575435,
    -99.2347478,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: DHL-LVN-121'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [17/25] GIMNASIO (Project ID: 0373dfaa-b802-4f31-a1f5-23bad2d82785)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '15057852-51b4-4b7d-a878-fd1db061302b'::uuid,
    '0373dfaa-b802-4f31-a1f5-23bad2d82785'::uuid,
    1,
    20.9674,
    -89.6236,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GIMNASIO'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [18/25] SK-LNV-116 (Project ID: e309ddc3-a69c-40d5-9433-2342f82b4c97)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '7a504b28-b00a-4c94-ab6b-2e7409ae9a84'::uuid,
    'e309ddc3-a69c-40d5-9433-2342f82b4c97'::uuid,
    1,
    25.6866,
    -100.3161,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: SK-LNV-116'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [19/25] GE-LNV-93 (Project ID: 1da60bca-efa5-41c8-87a3-3286ac2b956e)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '8942d532-72d6-42d8-a31e-006f92520b59'::uuid,
    '1da60bca-efa5-41c8-87a3-3286ac2b956e'::uuid,
    1,
    16.6346,
    -90.1873,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GE-LNV-93'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [20/25] GE-LNV-096 (Project ID: 24e0feba-1760-486e-ac43-ba39a8672b8b)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'e92f0491-7504-452d-a708-3178578059ed'::uuid,
    '24e0feba-1760-486e-ac43-ba39a8672b8b'::uuid,
    1,
    14.6349,
    -90.5069,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GE-LNV-096'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [21/25] GE-LNV-130 - Xalostoc (Bachoco 52) (Project ID: dfd9231b-f396-4d58-8894-9cccc3c61ccf)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '6e0116bc-8a9f-4da0-a9cb-935bb01aa444'::uuid,
    'dfd9231b-f396-4d58-8894-9cccc3c61ccf'::uuid,
    1,
    18.7446518,
    -98.8896561,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GE-LNV-130 - Xalostoc (Bachoco 52)'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [22/25] GE-LNV-130 - Pedregal (Bachoco) (Project ID: 8e7935ea-d46b-47c0-b03e-d2fbce4bfe8e)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'c9770a97-fad8-47fa-a9a0-e35e838ce301'::uuid,
    '8e7935ea-d46b-47c0-b03e-d2fbce4bfe8e'::uuid,
    1,
    18.7694815,
    -98.860592,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GE-LNV-130 - Pedregal (Bachoco)'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [23/25] LNV-CUAJIMALPA (Project ID: 159564fd-e752-46b3-956e-76e770403e4e)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '20923cff-f9c8-4b16-a5ce-ceebb728bd43'::uuid,
    '159564fd-e752-46b3-956e-76e770403e4e'::uuid,
    1,
    19.3582,
    -99.2989,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: LNV-CUAJIMALPA'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [24/25] TR-LNV-102 (Project ID: 95a2f026-c64a-4dec-a070-5d1f66cbd9d8)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    'aa81a562-8435-4bfd-ad19-3e98590a678c'::uuid,
    '95a2f026-c64a-4dec-a070-5d1f66cbd9d8'::uuid,
    1,
    20.6597,
    -103.3496,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: TR-LNV-102'
) ON CONFLICT (project_id, version_number) DO NOTHING;

-- [25/25] GE-LNV-108 (Project ID: 9b9d92ae-69e6-4378-a3ef-a932273613e5)
INSERT INTO public.project_geofence_versions (
    version_id,
    project_id,
    version_number,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    warehouse_bypass_allowed,
    home_office_allowed,
    effective_from,
    notes
) VALUES (
    '6128f3cb-1ded-4210-a0cc-6d1f76912cd0'::uuid,
    '9b9d92ae-69e6-4378-a3ef-a932273613e5'::uuid,
    1,
    16.8,
    -89.8333,
    1000.00,
    150,
    FALSE,
    TRUE,
    '2026-10-15 00:00:00+00'::timestamptz,
    'PASS 13I-V Initial Seed: GE-LNV-108'
) ON CONFLICT (project_id, version_number) DO NOTHING;

COMMIT;
-- ==============================================================================
-- END OF PROPOSED GEOFENCE SEED SCRIPT
-- ==============================================================================
