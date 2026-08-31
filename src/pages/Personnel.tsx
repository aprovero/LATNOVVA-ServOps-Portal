import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useStore, Personnel as PersonnelType } from '../store/useStore';
import {
    User, Plus, Trash2, Shield, Award, Search, Camera, ExternalLink,
    Activity, FolderGit2, Network, List, ChevronDown, Phone, Mail,
    Briefcase, CheckCircle2, CircleDashed, Save, ArrowLeft, X, Upload,
    FileText, FileSpreadsheet
} from 'lucide-react';
import OrgChartView from '../components/personnel/OrgChartView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabase';
import { MexicoHRForm } from '../components/personnel/MexicoHRForm';
import { validateImageQualityAndGetDescriptor } from '../utils/faceId.utils';

export default function Personnel() {
    const { t } = useTranslation();
    const { personnel, addPersonnel, updatePersonnel, deletePersonnel, userRole, projects, updateProject, transferPersonnel, activeSubsidiary, language } = useStore();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('q') || '';
    });
    const [filterRole, setFilterRole] = useState('All');
    const [viewMode, setViewMode] = useState<'list' | 'org'>('list');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<Partial<PersonnelType> | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    // Bulk personnel upload states for POC
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkFileError, setBulkFileError] = useState<string | null>(null);
    const [bulkFileSuccess, setBulkFileSuccess] = useState<string | null>(null);
    const [isBulkUploading, setIsBulkUploading] = useState(false);

    const handleDownloadTemplate = () => {
        const headers = [
            // 1. Información General / Core Info
            'EMPRESA',
            'NOMBRE',
            'PUESTO',
            'NUMERO_EMPLEADO',
            'ROL_APP',
            'ESTATUS',
            'PROYECTO',
            'FECHA_NACIMIENTO',
            'EDAD',
            'GENERO',
            'EDO_CIVIL',
            'DOMICILIO',
            'CORP_EMAIL',
            'EMAIL',
            'TEL',
            'CONTACTO_EMERGENCIA',
            'TEL_EMERGENCIA',
            'PARENTESCO_EMERGENCIA',
            'CARPETA_CERTIFICADOS',

            // 2. Identificación & Demografía (Mexico HR)
            'CURP',
            'INE',
            'RFC',
            'CP_FISCAL',
            'NSS',

            // 3. Datos Laborales & Contratación (Mexico HR)
            'TIPO_TRABAJADOR',
            'NIVEL_ESTUDIOS',
            'ESPECIALIDAD',
            'ANIOS_SERVICIO',
            'CONTRATO',
            'VENCE_CONTRATO',
            'VENCE_PRUEBA',
            'ALTA_IMSS',
            'REGISTRO_PATRONAL',
            'INGRESO',

            // 4. Nómina, Percepciones & Banco (Mexico HR)
            'PERIODICIDAD_PAGO',
            'BANCO',
            'CLABE',
            'NOMINA_PPP',
            'NOMINA_IMSS',
            'SDI',
            'TOTAL',
            'VIATICOS_MENSUALES',
            'BONOS',
            'DIAS_AGUINALDO',
            'DIAS_VACACIONES_TOTAL',
            'DIAS_VACACIONES_RESTANTES',
            'CREDITO_INFONAVIT',
            'MONTO_INFONAVIT',
            'BENEFICIARIO_PRINCIPAL',

            // 5. Logística & Tallas (Mexico HR)
            'TALLA_CHALECO',
            'TALLA_CAMISA',
            'TALLA_CALZADO',

            // 6. Finanzas Adicionales / US Rates (Opcional)
            'SUELDO_HORA',
            'HORA_EXTRA',
            'PER_DIEM'
        ];

        const sampleRow = [
            'LATNOVVA',
            'JUAN PEREZ SANCHEZ',
            'TECHNICIAN',
            'MX-LNV-0001',
            'Tech',
            'Active',
            'EST-LNV-000 CDMX',
            '1980-04-04',
            '46',
            'MASCULINO',
            'SOLTERO(A)',
            'AV REFORMA 123 CDMX',
            'jperez@latnovva.com',
            'juan.perez@gmail.com',
            '5512345678',
            'MARIA SANCHEZ',
            '5587654321',
            'MADRE',
            'https://drive.google.com/drive/folders/sample',
            'PESJ800404HQRMRS03',
            'IDMEX1952181883',
            'PESJ800404BW7',
            '06010',
            '82968014975',
            'LOCAL',
            'LICENCIATURA',
            'INGENIERIA ELECTRICA',
            '2.5',
            '6 MESES',
            '18/09/2026',
            '18/09/2026',
            '19/03/2026',
            'Y1234567890',
            '19/03/2026',
            'QUINCENAL',
            'BBVA',
            '12180015309895246',
            '15000',
            '10000',
            '850.50',
            '25000',
            '3000',
            '1500',
            '15',
            '12',
            '10',
            'NO',
            '0',
            'MARIA SANCHEZ PEREZ',
            'L',
            'L',
            '28',
            '0',
            '0',
            '0'
        ];

        const escapeCSV = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
        const csvContent = '\uFEFF' + [
            headers.map(escapeCSV).join(','),
            sampleRow.map(escapeCSV).join(',')
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "plantilla_carga_masiva_personal.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadInstructions = () => {
        const instructions = `================================================================================
GUIA Y ESPECIFICACION DE COLUMNAS PARA CARGA MASIVA DE PERSONAL - LATNOVVA
================================================================================

Este documento contiene las especificaciones detalladas para el llenado de la 
plantilla de carga masiva de colaboradores (archivo .csv).

--------------------------------------------------------------------------------
1. REGLAS GENERALES Y RECOMENDACIONES
--------------------------------------------------------------------------------
- Formato de Archivo: CSV delimitado por comas (,) codificado en UTF-8.
- Columnas Obligatorias: Unicamente la columna 'NOMBRE' es estrictamente requerida. 
  Todas las demas columnas son opcionales pero recomendadas para tener el expediente completo.
- Textos con Comas: Si un campo contiene comas (por ejemplo, direcciones como 
  "Av. Reforma 123, Col. Juarez"), debe encerrarse entre comillas dobles.
- Cuentas CLABE y Numeros Largos: En Excel, configure la columna CLABE como 'Texto' 
  para evitar que se convierta a notacion cientifica (ej. 1.218E+16). El sistema 
  detecta y sanitiza automaticamente numeros en notacion cientifica.
- Asignacion Automatica a Oficina CDMX: Si el campo 'PROYECTO' se deja vacio o el 
  proyecto no se encuentra activo, el colaborador se asignara automaticamente a la 
  Oficina Central de Ciudad de Mexico (EST-LNV-000 CDMX).
- Autocalculo de Edad: Si 'EDAD' se deja en blanco pero se proporciona 'FECHA_NACIMIENTO', 
  el sistema calculara la edad automaticamente.
- Autocalculo de Total: Si 'TOTAL' se deja en 0 o vacio y se capturan 'NOMINA_PPP' y 
  'NOMINA_IMSS', el sistema calculara la suma automaticamente.
- Autogeneracion de ID: Si 'NUMERO_EMPLEADO' se deja en blanco, el sistema generara un 
  codigo consecutivo unico (ej. MX-LNV-0001 o MX-SYS-0001).

--------------------------------------------------------------------------------
2. DICCIONARIO DE COLUMNAS (EN ORDEN DE APARICION)
--------------------------------------------------------------------------------

[ SECCION 1: INFORMACION GENERAL / PERFIL ]
1. EMPRESA
   - Descripcion: Empresa a la que pertenece el colaborador.
   - Valores recomendados: 'LATNOVVA' o 'SYS'.
   - Valor por defecto: 'LATNOVVA'.

2. NOMBRE
   - Descripcion: Nombre completo del colaborador (Apellidos y Nombres).
   - Requerido: SI.
   - Ejemplo: 'JUAN PEREZ SANCHEZ'.

3. PUESTO
   - Descripcion: Cargo o puesto desempenado en la empresa.
   - Ejemplo: 'TECHNICIAN', 'GERENTE DE IT', 'COORDINADOR DE CONSTRUCCION'.

4. NUMERO_EMPLEADO
   - Descripcion: Identificador de empleado asignado internamente.
   - Ejemplo: 'MX-LNV-0001'. Si se deja vacio, el sistema lo genera automaticamente.

5. ROL_APP
   - Descripcion: Nivel de acceso y permisos dentro de la plataforma.
   - Valores permitidos: 'Tech', 'Office', 'Supervisor', 'Manager', 'HR'.
   - Valor por defecto: 'Tech'.

6. ESTATUS
   - Descripcion: Estado laboral del colaborador.
   - Valores permitidos: 'Active' o 'Inactive'.
   - Valor por defecto: 'Active'.

7. PROYECTO
   - Descripcion: Proyecto, obra o sitio asignado.
   - Ejemplo: 'EST-LNV-000 CDMX', 'EST-LNV-000 MID', 'PROYECTO SOLAR NORTE'.
   - Nota: Si no coincide con un proyecto registrado o esta vacio, se asigna a CDMX.

8. FECHA_NACIMIENTO
   - Descripcion: Fecha de nacimiento del colaborador.
   - Formatos aceptados: 'YYYY-MM-DD' (ej. 1980-04-04) o 'DD/MM/YYYY' (ej. 04/04/1980).

9. EDAD
   - Descripcion: Edad en anos cumplidos.
   - Ejemplo: 46. (Se autocalcula si se proporciona FECHA_NACIMIENTO).

10. GENERO
    - Descripcion: Genero del colaborador.
    - Valores sugeridos: 'MASCULINO', 'FEMENINO', 'OTRO'.

11. EDO_CIVIL
    - Descripcion: Estado civil.
    - Valores sugeridos: 'SOLTERO(A)', 'CASADO(A)', 'DIVORCIADO(A)', 'VIUDO(A)', 'UNION LIBRE'.

12. DOMICILIO
    - Descripcion: Direccion completa de residencia (Calle, No., Colonia, Municipio/Alcaldia, C.P., Estado).
    - Ejemplo: 'AV REFORMA 123 COL. JUAREZ CUAUHTEMOC CDMX C.P. 06600'.

13. CORP_EMAIL
    - Descripcion: Correo electronico corporativo oficial.
    - Ejemplo: 'jperez@latnovva.com'.

14. EMAIL
    - Descripcion: Correo electronico personal.
    - Ejemplo: 'juan.perez@gmail.com'.

15. TEL
    - Descripcion: Numero telefonico de contacto principal (10 digitos).
    - Ejemplo: '5512345678'.

16. CONTACTO_EMERGENCIA
    - Descripcion: Nombre completo de la persona a contactar en caso de emergencia.
    - Ejemplo: 'MARIA SANCHEZ PEREZ'.

17. TEL_EMERGENCIA
    - Descripcion: Telefono del contacto de emergencia.
    - Ejemplo: '5587654321'.

18. PARENTESCO_EMERGENCIA
    - Descripcion: Relacion o parentesco con el contacto de emergencia.
    - Ejemplo: 'MADRE', 'ESPOSA', 'HERMANO', 'HIJO'.

19. CARPETA_CERTIFICADOS
    - Descripcion: Enlace (URL) a la carpeta compartida en Google Drive / OneDrive con DC3 o certificados.
    - Ejemplo: 'https://drive.google.com/drive/folders/...'.


[ SECCION 2: IDENTIFICACION & DEMOGRAFIA (RH MEXICO) ]
20. CURP
    - Descripcion: Clave Unica de Registro de Poblacion (18 caracteres).
    - Ejemplo: 'PESJ800404HQRMRS03'.

21. INE
    - Descripcion: Clave de elector o codigo identificador de la credencial para votar.
    - Ejemplo: 'IDMEX1952181883'.

22. RFC
    - Descripcion: Registro Federal de Contribuyentes con Homoclave (13 caracteres).
    - Ejemplo: 'PESJ800404BW7'.

23. CP_FISCAL
    - Descripcion: Codigo Postal fiscal de la Constancia de Situacion Fiscal SAT (5 digitos).
    - Ejemplo: '06010'.

24. NSS
    - Descripcion: Numero de Seguridad Social IMSS (11 digitos).
    - Ejemplo: '82968014975'.


[ SECCION 3: DATOS LABORALES & CONTRATACION (RH MEXICO) ]
25. TIPO_TRABAJADOR
    - Descripcion: Clasificacion del colaborador por residencia/desplazamiento.
    - Valores: 'LOCAL' o 'FORANEO'.

26. NIVEL_ESTUDIOS
    - Descripcion: Maximo grado de estudios completado.
    - Ejemplos: 'PRIMARIA', 'SECUNDARIA', 'PREPARATORIA', 'LICENCIATURA', 'INGENIERIA', 'MAESTRIA'.

27. ESPECIALIDAD
    - Descripcion: Area de especializacion o carrera profesional.
    - Ejemplo: 'INGENIERIA ELECTRICA', 'ADMINISTRACION', 'RECURSOS HUMANOS'.

28. ANIOS_SERVICIO
    - Descripcion: Antiguedad en la empresa en anos (numero entero o decimal).
    - Ejemplo: 2.5.

29. CONTRATO
    - Descripcion: Modalidad o vigencia del contrato de trabajo.
    - Ejemplos: '1 MES', '3 MESES', '6 MESES', '1 ANO', 'INDEFINIDO'.

30. VENCE_CONTRATO
    - Descripcion: Fecha de termino o renovacion del contrato.
    - Formato: 'DD/MM/YYYY' o 'YYYY-MM-DD'.

31. VENCE_PRUEBA
    - Descripcion: Fecha de conclusion del periodo de prueba.
    - Formato: 'DD/MM/YYYY' o 'YYYY-MM-DD'.

32. ALTA_IMSS
    - Descripcion: Fecha oficial de alta ante el Instituto Mexicano del Seguro Social.
    - Formato: 'DD/MM/YYYY' o 'YYYY-MM-DD'.

33. REGISTRO_PATRONAL
    - Descripcion: Numero o clave de Registro Patronal de la empresa.
    - Ejemplo: 'Y1234567890'.

34. INGRESO
    - Descripcion: Fecha formal de ingreso / contratacion a la empresa.
    - Formato: 'DD/MM/YYYY' o 'YYYY-MM-DD'.


[ SECCION 4: NOMINA, PERCEPCIONES & BANCO (RH MEXICO) ]
35. PERIODICIDAD_PAGO
    - Descripcion: Frecuencia con la que se dispersa la nomina.
    - Valores: 'QUINCENAL', 'SEMANAL', 'MENSUAL'.
    - Valor por defecto: 'QUINCENAL'.

36. BANCO
    - Descripcion: Nombre del banco donde el colaborador recibe sus depositos.
    - Ejemplos: 'BBVA', 'SANTANDER', 'BANAMEX', 'BANORTE', 'BANCO AZTECA', 'NU MEXICO'.

37. CLABE
    - Descripcion: Clave Bancaria Estandarizada (18 digitos numericos).
    - Ejemplo: '12180015309895246'.

38. NOMINA_PPP
    - Descripcion: Monto mensual dispersado por concepto de PPP / Sueldo Neto.
    - Ejemplo: 15000.

39. NOMINA_IMSS
    - Descripcion: Monto mensual registrado formalmente ante el IMSS.
    - Ejemplo: 10000.

40. SDI
    - Descripcion: Salario Diario Integrado (pesos mexicanos).
    - Ejemplo: 850.50.

41. TOTAL
    - Descripcion: Sueldo bruto mensual integral (NOMINA_PPP + NOMINA_IMSS).
    - Ejemplo: 25000.

42. VIATICOS_MENSUALES
    - Descripcion: Asignacion mensual promedio para viaticos en campo.
    - Ejemplo: 3000.

43. BONOS
    - Descripcion: Bonos mensuales recurrentes o de productividad.
    - Ejemplo: 1500.

44. DIAS_AGUINALDO
    - Descripcion: Dias de aguinaldo pactados anualmente.
    - Ejemplo: 15.

45. DIAS_VACACIONES_TOTAL
    - Descripcion: Dias totales de vacaciones anuales segun antiguedad.
    - Ejemplo: 12.

46. DIAS_VACACIONES_RESTANTES
    - Descripcion: Dias de vacaciones disponibles pendientes de disfrutar.
    - Ejemplo: 10.

47. CREDITO_INFONAVIT
    - Descripcion: El trabajador cuenta con credito Infonavit activo?
    - Valores: 'SI' o 'NO'.

48. MONTO_INFONAVIT
    - Descripcion: Monto mensual de descuento por retencion de credito Infonavit.
    - Ejemplo: 2450.00.

49. BENEFICIARIO_PRINCIPAL
    - Descripcion: Nombre completo de la persona designada como beneficiaria legal.
    - Ejemplo: 'MARIA SANCHEZ PEREZ'.


[ SECCION 5: LOGISTICA & TALLAS (RH MEXICO) ]
50. TALLA_CHALECO
    - Descripcion: Talla para chaleco de seguridad y EPP.
    - Valores: 'S', 'M', 'L', 'XL', 'XXL'.

51. TALLA_CAMISA
    - Descripcion: Talla para camisolas de trabajo y uniformes.
    - Valores: 'S', 'M', 'L', 'XL', 'XXL'.

52. TALLA_CALZADO
    - Descripcion: Talla de calzado / botas de seguridad con casquillo.
    - Ejemplo: '27', '27.5', '28'.


[ SECCION 6: TARIFAS ADICIONALES / US RATES (OPCIONAL) ]
53. SUELDO_HORA
    - Descripcion: Tarifa por hora regular (para colaboradores en esquema horario o US).
    - Ejemplo: 25.00.

54. HORA_EXTRA
    - Descripcion: Tarifa por hora extraordinaria.
    - Ejemplo: 37.50.

55. PER_DIEM
    - Descripcion: Tarifa de viatico diario fijo (Per Diem).
    - Ejemplo: 75.00.

================================================================================
SOPORTE Y ASISTENCIA TECNICA - LATNOVVA SERVOPS
================================================================================
Si experimenta algun error durante la carga masiva, revise que no existan comillas 
abiertas sin cerrar y que la columna 'NOMBRE' contenga informacion en cada fila.
`;

        const blob = new Blob([instructions], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "instrucciones_carga_masiva.txt");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setBulkFileError(null);
        setBulkFileSuccess(null);
        setIsBulkUploading(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                if (!text) throw new Error("Could not read file contents");

                // Parse CSV supporting quotes and multi-line values
                const parseCSV = (csvText: string) => {
                    const rows: string[][] = [];
                    let currentRow: string[] = [];
                    let currentField = '';
                    let inQuotes = false;

                    for (let i = 0; i < csvText.length; i++) {
                        const char = csvText[i];
                        const nextChar = csvText[i + 1];

                        if (char === '"') {
                            if (inQuotes && nextChar === '"') {
                                currentField += '"';
                                i++; // skip escaped quote
                            } else {
                                inQuotes = !inQuotes;
                            }
                        } else if (char === ',' && !inQuotes) {
                            currentRow.push(currentField.trim());
                            currentField = '';
                        } else if ((char === '\r' || char === '\n') && !inQuotes) {
                            if (char === '\r' && nextChar === '\n') {
                                i++;
                            }
                            currentRow.push(currentField.trim());
                            if (currentRow.some(c => c.length > 0)) {
                                rows.push(currentRow);
                            }
                            currentRow = [];
                            currentField = '';
                        } else {
                            currentField += char;
                        }
                    }
                    if (currentField.length > 0 || currentRow.length > 0) {
                        currentRow.push(currentField.trim());
                        if (currentRow.some(c => c.length > 0)) {
                            rows.push(currentRow);
                        }
                    }
                    return rows;
                };

                const parsedRows = parseCSV(text);
                if (parsedRows.length <= 1) {
                    throw new Error("No data rows found in CSV. Please check the file.");
                }

                // Clean and normalize file headers
                const fileHeaders = parsedRows[0].map(h => 
                    h.toUpperCase().trim().replace(/^["']|["']$/g, '').replace(/[\s_]+/g, '_')
                );

                // Helper to match column indices flexibly by alias
                const getCol = (aliases: string[]) => {
                    for (const alias of aliases) {
                        const cleanAlias = alias.toUpperCase().trim().replace(/[\s_]+/g, '_');
                        const idx = fileHeaders.indexOf(cleanAlias);
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                // Validate required Name column
                const idxNombre = getCol(['NOMBRE', 'NAME', 'FULL_NAME', 'NOMBRE_COMPLETO', 'COLABORADOR']);
                if (idxNombre === -1) {
                    throw new Error("CSV must include a 'NOMBRE' or 'NAME' column.");
                }

                // Header mapping across all sections
                const idxEmpresa = getCol(['EMPRESA', 'COMPANY', 'SUBSIDIARY_COMPANY']);
                const idxPuesto = getCol(['PUESTO', 'POSITION', 'JOB_TITLE', 'CARGO']);
                const idxNumEmpleado = getCol(['NUMERO_EMPLEADO', 'NUM_EMPLEADO', 'EMPLOYEE_NUMBER', 'ID_EMPLEADO', 'EMPLOYEE_ID', 'ID']);
                const idxRolApp = getCol(['ROL_APP', 'APP_ROLE', 'ROL', 'ROLE']);
                const idxEstatus = getCol(['ESTATUS', 'STATUS', 'ESTADO']);
                const idxProyecto = getCol(['PROYECTO', 'PROJECT', 'SITIO_ASIGNADO', 'SITE_ASSIGNED', 'OBRA', 'SITE']);
                const idxFechaNac = getCol(['FECHA_NACIMIENTO', 'BIRTH_DATE', 'BIRTHDATE', 'DBO', 'FECHA_DE_NACIMIENTO', 'NACIMIENTO']);
                const idxEdad = getCol(['EDAD', 'AGE']);
                const idxGenero = getCol(['GENERO', 'GENDER', 'SEXO']);
                const idxEdoCivil = getCol(['EDO_CIVIL', 'ESTADO_CIVIL', 'MARITAL_STATUS', 'CIVIL_STATUS']);
                const idxDomicilio = getCol(['DOMICILIO', 'DIRECCION', 'ADDRESS', 'FULL_ADDRESS', 'CALLE', 'STREET', 'ADDRESS_FULL']);
                const idxCorpEmail = getCol(['CORP_EMAIL', 'CORREO_CORPORATIVO', 'CORPORATE_EMAIL', 'EMAIL_CORP']);
                const idxEmail = getCol(['EMAIL', 'CORREO', 'CORREO_PERSONAL', 'PERSONAL_EMAIL']);
                const idxTel = getCol(['TEL', 'TELEFONO', 'PHONE', 'PHONE_NUMBER', 'CELULAR', 'MOBILE']);
                const idxContactoEmerg = getCol(['CONTACTO_EMERGENCIA', 'EMERGENCY_CONTACT', 'EMERGENCY_CONTACT_NAME']);
                const idxTelEmerg = getCol(['TEL_EMERGENCIA', 'TELEFONO_EMERGENCIA', 'EMERGENCY_PHONE', 'EMERGENCY_CONTACT_PHONE']);
                const idxParentescoEmerg = getCol(['PARENTESCO_EMERGENCIA', 'PARENTESCO', 'EMERGENCY_RELATIONSHIP', 'EMERGENCY_CONTACT_RELATIONSHIP']);
                const idxCertsFolder = getCol(['CARPETA_CERTIFICADOS', 'CERTIFICADOS', 'CERTS_FOLDER', 'SHARED_FOLDER_LINK', 'SHARED_FOLDER']);

                // Identifiers
                const idxCurp = getCol(['CURP']);
                const idxIne = getCol(['INE', 'ID_OFICIAL']);
                const idxRfc = getCol(['RFC']);
                const idxCpFiscal = getCol(['CP_FISCAL', 'RFC_POSTAL_CODE', 'CODIGO_POSTAL_FISCAL', 'CP', 'ZIP_CODE']);
                const idxNss = getCol(['NSS', 'NUMERO_SEGURO_SOCIAL', 'SEGURO_SOCIAL']);

                // Employment
                const idxTipoTrabajador = getCol(['TIPO_TRABAJADOR', 'WORKER_TYPE', 'TIPO_EMPLEADO']);
                const idxNivelEstudios = getCol(['NIVEL_ESTUDIOS', 'STUDIES_LEVEL', 'ESCOLARIDAD', 'ESTUDIOS']);
                const idxEspecialidad = getCol(['ESPECIALIDAD', 'SPECIALTY', 'CARRERA', 'PROFESION']);
                const idxAniosServicio = getCol(['ANIOS_SERVICIO', 'YEARS_OF_SERVICE', 'ANTIGUEDAD', 'TIEMPO_SERVICIO']);
                const idxContrato = getCol(['CONTRATO', 'DURACION_CONTRATO', 'CONTRACT_DURATION', 'TIPO_CONTRATO']);
                const idxVenceContrato = getCol(['VENCE_CONTRATO', 'CONTRACT_EXPIRY', 'FIN_CONTRATO', 'VENCIMIENTO_CONTRATO']);
                const idxVencePrueba = getCol(['VENCE_PRUEBA', 'PROBATION_EXPIRY', 'FIN_PRUEBA', 'VENCIMIENTO_PRUEBA']);
                const idxAltaImss = getCol(['ALTA_IMSS', 'IMSS_DATE', 'FECHA_IMSS', 'FECHA_ALTA_IMSS']);
                const idxRegPatronal = getCol(['REGISTRO_PATRONAL', 'PATRONAL']);
                const idxIngreso = getCol(['INGRESO', 'HIRE_DATE', 'FECHA_INGRESO', 'FECHA_DE_INGRESO', 'ONBOARDING_DATE']);

                // Payroll & Banking
                const idxPeriodoPago = getCol(['PERIODICIDAD_PAGO', 'PAYROLL_TYPE', 'TIPO_NOMINA', 'FRECUENCIA_PAGO']);
                const idxBanco = getCol(['BANCO', 'BANK', 'BANK_NAME', 'INSTITUCION_BANCARIA']);
                const idxClabe = getCol(['CLABE', 'CUENTA_CLABE', 'CLABE_INTERBANCARIA']);
                const idxNominaPpp = getCol(['NOMINA_PPP', 'SUELDO_PPP', 'PPP', 'NOMINA_NETA']);
                const idxNominaImss = getCol(['NOMINA_IMSS', 'SUELDO_IMSS', 'IMSS_SALARY', 'NOMINA_FISCAL']);
                const idxSdi = getCol(['SDI', 'SALARIO_DIARIO_INTEGRADO']);
                const idxTotal = getCol(['TOTAL', 'TOTAL_GROSS', 'SUELDO_TOTAL', 'SALARIO_TOTAL', 'TOTAL_MENSUAL']);
                const idxViaticos = getCol(['VIATICOS_MENSUALES', 'VIATICOS', 'MONTHLY_VIATICOS', 'VIATICO']);
                const idxBonos = getCol(['BONOS', 'BONUSES', 'BONO']);
                const idxAguinaldo = getCol(['DIAS_AGUINALDO', 'AGUINALDO_DAYS', 'AGUINALDO']);
                const idxVacacionesTotal = getCol(['DIAS_VACACIONES_TOTAL', 'VACATION_DAYS_TOTAL', 'VACACIONES_TOTAL', 'TOTAL_VACACIONES']);
                const idxVacacionesRest = getCol(['DIAS_VACACIONES_RESTANTES', 'VACATION_DAYS_REMAINING', 'VACACIONES_RESTANTES']);
                const idxInfonavitCredito = getCol(['CREDITO_INFONAVIT', 'INFONAVIT_CREDIT', 'INFONAVIT', 'INFONAVIT_ACTIVO']);
                const idxInfonavitMonto = getCol(['MONTO_INFONAVIT', 'INFONAVIT_AMOUNT', 'RETENCION_INFONAVIT']);
                const idxBeneficiario = getCol(['BENEFICIARIO_PRINCIPAL', 'PRIMARY_BENEFICIARY', 'BENEFICIARIO']);

                // Uniforms & Logistics
                const idxTallaChaleco = getCol(['TALLA_CHALECO', 'VEST_SIZE', 'CHALECO']);
                const idxTallaCamisa = getCol(['TALLA_CAMISA', 'SHIRT_SIZE', 'CAMISA']);
                const idxTallaCalzado = getCol(['TALLA_CALZADO', 'SHOE_SIZE', 'CALZADO', 'BOTAS']);

                // Financial rates
                const idxRegularRate = getCol(['SUELDO_HORA', 'HOURLY_RATE', 'REGULAR_RATE', 'REGULAR_HOURS']);
                const idxOvertimeRate = getCol(['HORA_EXTRA', 'OVERTIME_RATE', 'OVER_TIME']);
                const idxPerDiem = getCol(['PER_DIEM', 'TOTAL_PERDIEM']);

                // Helper sanitizers
                const cleanStr = (val: string | undefined): string => val ? val.trim().replace(/^["']|["']$/g, '') : '';
                const cleanNum = (val: string | undefined): number => {
                    if (!val) return 0;
                    const c = val.replace(/[\$, ]/g, '').trim();
                    const n = parseFloat(c);
                    return isNaN(n) ? 0 : n;
                };
                const cleanClabe = (val: string | undefined): string => {
                    if (!val) return '';
                    let s = val.trim().replace(/^["']|["']$/g, '');
                    if (/^[0-9.]+e\+[0-9]+$/i.test(s)) {
                        try {
                            s = BigInt(Math.round(Number(s))).toString();
                        } catch {}
                    }
                    return s.replace(/[^0-9]/g, '');
                };

                let importedCount = 0;
                let lnvCount = personnel.filter(p => p.employeeNumber?.includes('LNV')).length;
                let sysCount = personnel.filter(p => p.employeeNumber?.includes('SYS')).length;

                for (let i = 1; i < parsedRows.length; i++) {
                    const row = parsedRows[i];
                    const name = cleanStr(row[idxNombre]);
                    if (!name) continue;

                    const empresa = idxEmpresa !== -1 ? (cleanStr(row[idxEmpresa]) || 'LATNOVVA') : 'LATNOVVA';
                    const position = idxPuesto !== -1 ? (cleanStr(row[idxPuesto]) || 'TECHNICIAN') : 'TECHNICIAN';
                    
                    // Generate sequential ID if not provided
                    let empNumber = idxNumEmpleado !== -1 ? cleanStr(row[idxNumEmpleado]) : '';
                    if (!empNumber) {
                        if (empresa.toUpperCase().includes('LATNOVVA') || empresa.toUpperCase().includes('LNV')) {
                            lnvCount++;
                            empNumber = `MX-LNV-${String(lnvCount).padStart(4, '0')}`;
                        } else {
                            sysCount++;
                            empNumber = `MX-SYS-${String(sysCount).padStart(4, '0')}`;
                        }
                    }

                    // App Role & Status
                    const rawRole = idxRolApp !== -1 ? cleanStr(row[idxRolApp]) : '';
                    const validRoles = ['Tech', 'Office', 'Supervisor', 'Manager', 'HR'];
                    const appRole = validRoles.find(r => r.toLowerCase() === rawRole.toLowerCase()) as any || 'Tech';
                    
                    const rawStatus = idxEstatus !== -1 ? cleanStr(row[idxEstatus]) : '';
                    const status = rawStatus.toLowerCase().startsWith('inact') ? 'Inactive' : 'Active';

                    // Project & Birth Date
                    const siteAssigned = idxProyecto !== -1 ? cleanStr(row[idxProyecto]) : '';
                    const birthDate = idxFechaNac !== -1 ? cleanStr(row[idxFechaNac]) : '';
                    
                    // Auto-calculate age if DOB is provided
                    let age = idxEdad !== -1 ? cleanNum(row[idxEdad]) : 0;
                    if (!age && birthDate) {
                        const bDate = new Date(birthDate.includes('/') ? birthDate.split('/').reverse().join('-') : birthDate);
                        if (!isNaN(bDate.getTime())) {
                            const today = new Date();
                            let a = today.getFullYear() - bDate.getFullYear();
                            const m = today.getMonth() - bDate.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) a--;
                            if (a > 0) age = a;
                        }
                    }

                    // Payroll calculations
                    const nominaPpp = idxNominaPpp !== -1 ? cleanNum(row[idxNominaPpp]) : 0;
                    const nominaImss = idxNominaImss !== -1 ? cleanNum(row[idxNominaImss]) : 0;
                    let totalGross = idxTotal !== -1 ? cleanNum(row[idxTotal]) : 0;
                    if (!totalGross && (nominaPpp || nominaImss)) {
                        totalGross = nominaPpp + nominaImss;
                    }

                    const infonavitActive = idxInfonavitCredito !== -1 ? (cleanStr(row[idxInfonavitCredito]).toUpperCase().startsWith('S') || cleanStr(row[idxInfonavitCredito]).toUpperCase() === 'YES') : false;

                    const metadata = {
                        company: empresa,
                        siteAssigned,
                        birthDate,
                        age: age > 0 ? age : undefined,
                        gender: idxGenero !== -1 ? cleanStr(row[idxGenero]).toUpperCase() : '',
                        maritalStatus: idxEdoCivil !== -1 ? cleanStr(row[idxEdoCivil]).toUpperCase() : '',
                        street: idxDomicilio !== -1 ? cleanStr(row[idxDomicilio]) : '',
                        addressFull: idxDomicilio !== -1 ? cleanStr(row[idxDomicilio]) : '',
                        personalEmail: idxEmail !== -1 ? cleanStr(row[idxEmail]) : '',
                        emergencyContactRelationship: idxParentescoEmerg !== -1 ? cleanStr(row[idxParentescoEmerg]) : '',
                        curp: idxCurp !== -1 ? cleanStr(row[idxCurp]).toUpperCase() : '',
                        ine: idxIne !== -1 ? cleanStr(row[idxIne]) : '',
                        rfc: idxRfc !== -1 ? cleanStr(row[idxRfc]).toUpperCase() : '',
                        rfcPostalCode: idxCpFiscal !== -1 ? cleanStr(row[idxCpFiscal]) : '',
                        nss: idxNss !== -1 ? cleanStr(row[idxNss]) : '',
                        workerType: idxTipoTrabajador !== -1 ? cleanStr(row[idxTipoTrabajador]).toUpperCase() : '',
                        studiesLevel: idxNivelEstudios !== -1 ? cleanStr(row[idxNivelEstudios]) : '',
                        specialty: idxEspecialidad !== -1 ? cleanStr(row[idxEspecialidad]) : '',
                        yearsOfService: idxAniosServicio !== -1 ? cleanNum(row[idxAniosServicio]) : undefined,
                        contractDuration: idxContrato !== -1 ? cleanStr(row[idxContrato]) : '',
                        contractExpiry: idxVenceContrato !== -1 ? cleanStr(row[idxVenceContrato]) : (idxVencePrueba !== -1 ? cleanStr(row[idxVencePrueba]) : ''),
                        probationExpiry: idxVencePrueba !== -1 ? cleanStr(row[idxVencePrueba]) : '',
                        imssDate: idxAltaImss !== -1 ? cleanStr(row[idxAltaImss]) : '',
                        registroPatronal: idxRegPatronal !== -1 ? cleanStr(row[idxRegPatronal]) : '',
                        hireDate: idxIngreso !== -1 ? cleanStr(row[idxIngreso]) : '',
                        payrollType: idxPeriodoPago !== -1 ? cleanStr(row[idxPeriodoPago]).toUpperCase() : 'QUINCENAL',
                        bank: idxBanco !== -1 ? cleanStr(row[idxBanco]) : '',
                        bankName: idxBanco !== -1 ? cleanStr(row[idxBanco]) : '',
                        clabe: idxClabe !== -1 ? cleanClabe(row[idxClabe]) : '',
                        nominaPpp: nominaPpp > 0 ? nominaPpp : undefined,
                        nominaImss: nominaImss > 0 ? nominaImss : undefined,
                        sdi: idxSdi !== -1 ? cleanNum(row[idxSdi]) : undefined,
                        totalGross: totalGross > 0 ? totalGross : undefined,
                        viaticosMonthly: idxViaticos !== -1 ? cleanNum(row[idxViaticos]) : undefined,
                        bonuses: idxBonos !== -1 ? cleanNum(row[idxBonos]) : undefined,
                        aguinaldoDays: idxAguinaldo !== -1 ? cleanNum(row[idxAguinaldo]) : undefined,
                        vacationDaysTotal: idxVacacionesTotal !== -1 ? cleanNum(row[idxVacacionesTotal]) : undefined,
                        vacationDaysRemaining: idxVacacionesRest !== -1 ? cleanNum(row[idxVacacionesRest]) : undefined,
                        infonavitCredit: infonavitActive ? 'SI' : 'NO',
                        infonavitActive,
                        infonavitAmount: idxInfonavitMonto !== -1 ? cleanNum(row[idxInfonavitMonto]) : undefined,
                        primaryBeneficiary: idxBeneficiario !== -1 ? cleanStr(row[idxBeneficiario]) : '',
                        vestSize: idxTallaChaleco !== -1 ? cleanStr(row[idxTallaChaleco]).toUpperCase() : '',
                        shirtSize: idxTallaCamisa !== -1 ? cleanStr(row[idxTallaCamisa]).toUpperCase() : '',
                        shoeSize: idxTallaCalzado !== -1 ? cleanStr(row[idxTallaCalzado]) : ''
                    };

                    const newPersonId = crypto.randomUUID();
                    const corpEmail = idxCorpEmail !== -1 ? cleanStr(row[idxCorpEmail]) : '';
                    const persEmail = idxEmail !== -1 ? cleanStr(row[idxEmail]) : '';
                    const primaryEmail = corpEmail || persEmail || undefined;

                    await addPersonnel({
                        id: newPersonId,
                        name,
                        position,
                        employeeNumber: empNumber,
                        email: primaryEmail,
                        phoneNumber: idxTel !== -1 ? cleanStr(row[idxTel]) : undefined,
                        emergencyContactName: idxContactoEmerg !== -1 ? cleanStr(row[idxContactoEmerg]) : undefined,
                        emergencyContactPhone: idxTelEmerg !== -1 ? cleanStr(row[idxTelEmerg]) : undefined,
                        sharedFolderLink: idxCertsFolder !== -1 ? cleanStr(row[idxCertsFolder]) : undefined,
                        dbo: birthDate || undefined,
                        status,
                        appRole,
                        subsidiary: 'MX',
                        subsidiaryMetadata: metadata,
                        certifications: [],
                        regularRate: idxRegularRate !== -1 ? cleanNum(row[idxRegularRate]) : undefined,
                        overtimeRate: idxOvertimeRate !== -1 ? cleanNum(row[idxOvertimeRate]) : undefined,
                        totalPerdiem: idxPerDiem !== -1 ? cleanNum(row[idxPerDiem]) : undefined
                    });

                    // Link to project if assigned, or automatically assign to Mexico City Office if unassigned / not found
                    let matchProject = null;
                    if (siteAssigned) {
                        matchProject = projects.find(p => 
                            p.name.toLowerCase() === siteAssigned.toLowerCase() || 
                            p.codeName?.toLowerCase() === siteAssigned.toLowerCase() ||
                            p.name.toLowerCase().includes(siteAssigned.toLowerCase())
                        );
                    }

                    // Fallback to Mexico City Office if no project was specified or found
                    if (!matchProject) {
                        matchProject = projects.find(p => 
                            p.name.toLowerCase().includes('cdmx') || 
                            p.codeName?.toLowerCase().includes('cdmx') ||
                            p.name === 'EST-LNV-000' ||
                            p.codeName === 'EST-LNV-000' ||
                            p.name.toLowerCase().includes('ciudad de méxico') ||
                            p.name.toLowerCase().includes('mexico city')
                        );
                    }

                    if (matchProject) {
                        await transferPersonnel(newPersonId, matchProject.id);
                    }

                    importedCount++;
                }

                setBulkFileSuccess(`Successfully imported ${importedCount} active collaborators!`);
            } catch (err: any) {
                console.error(err);
                setBulkFileError(err.message || "Failed to process CSV file.");
            } finally {
                setIsBulkUploading(false);
            }
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('q');
        if (q !== null) {
            setSearchTerm(q);
            // If the query is a direct ID match, auto-select that person
            const match = personnel.find(p => p.id.toLowerCase() === q.toLowerCase());
            if (match) {
                setSelectedPersonId(match.id);
                setEditDraft({ ...match });
            }
        }

        // Deep linking for view mode
        const view = params.get('view');
        if (view === 'assignments') {
            setViewMode('org');
        }
    }, [location.search, personnel]);

    const [faceValError, setFaceValError] = useState<string | null>(null);
    const [faceValSuccess, setFaceValSuccess] = useState<boolean>(false);
    const [isValInProgress, setIsValInProgress] = useState<boolean>(false);

    const handlePhotoValidate = async (base64Image: string, isEdit: boolean) => {
        setFaceValError(null);
        setFaceValSuccess(false);
        setIsValInProgress(true);
        try {
            const res = await validateImageQualityAndGetDescriptor(base64Image);
            if (res.success && res.descriptor) {
                setFaceValSuccess(true);
                if (isEdit) {
                    setEditDraft(d => d ? { ...d, image: base64Image, faceDescriptor: res.descriptor } : d);
                } else {
                    setNewPerson(p => p ? { ...p, image: base64Image, faceDescriptor: res.descriptor } : null);
                }
            } else {
                let friendlyMsg = 'Face quality validation failed. Try a clearer photo.';
                if (res.error === 'no_face_detected') {
                    friendlyMsg = 'No face detected in photo. Please use a clear profile picture.';
                } else if (res.error === 'multiple_faces_detected') {
                    friendlyMsg = 'Multiple faces detected. Please upload an image with only one person.';
                } else if (res.error === 'low_detection_confidence') {
                    friendlyMsg = 'The face is not clear enough. Please check lighting and avoid angles.';
                }
                setFaceValError(friendlyMsg);
                if (isEdit) {
                    setEditDraft(d => d ? { ...d, image: base64Image, faceDescriptor: undefined } : d);
                } else {
                    setNewPerson(p => p ? { ...p, image: base64Image, faceDescriptor: undefined } : null);
                }
            }
        } catch (e: any) {
            setFaceValError('Validation error: ' + e.message);
        } finally {
            setIsValInProgress(false);
        }
    };

    // Add modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPerson, setNewPerson] = useState<Partial<PersonnelType> | null>(null);

    const isManager = userRole === 'Manager';
    const canManagePersonnel = ['Manager', 'HR', 'Supervisor'].includes(userRole);
    const isHROrManager = ['Manager', 'HR', 'Supervisor'].includes(userRole);

    // Select a person → load into edit draft
    const handleSelectPerson = (person: PersonnelType) => {
        setSelectedPersonId(person.id);
        setEditDraft({ ...person });
        setIsSaved(false);
    };

    // Save edits inline
    const handleSave = async () => {
        if (!editDraft?.id || !selectedPerson) return;
        
        try {
            // Optimization: Only update auth layer if core security fields changed
            const emailChanged = editDraft.email !== selectedPerson.email;
            const roleChanged = editDraft.appRole !== selectedPerson.appRole;
            const passwordProvided = !!editDraft.password;

            if (emailChanged || roleChanged || passwordProvided) {
                const { error } = await supabase.rpc('admin_update_user', {
                    target_user_id: editDraft.id,
                    new_email: editDraft.email || '',
                    new_role: editDraft.appRole || 'Tech',
                    new_password: editDraft.password || ''
                } as any);

                if (error) throw error;
            }
            
            updatePersonnel(editDraft.id, editDraft);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch(err: any) {
            alert('Failed to sync auth credentials to backend: ' + err.message);
        }
    };

    // Add new person
    const handleAdd = async () => {
        if (!newPerson?.name || !newPerson?.position || !newPerson?.email) {
            alert(t('personnel.alerts.email_required', 'Name, Position, and Email are absolutely required to explicitly invite a new user to the secure system.'));
            return;
        }

        try {
            // First, trigger the secure backend RPC to create physical Supabase Auth user & linked Profile Trigger
            const { data: newUserId, error } = await supabase.rpc('admin_create_user', {
                user_email: newPerson.email,
                user_name: newPerson.name,
                user_role: newPerson.appRole || 'Tech',
                user_password: newPerson.password || ''
            } as any);

            if (error) throw error;

            const created: PersonnelType = {
                id: newUserId,
                name: newPerson.name,
                position: newPerson.position,
                employeeNumber: newPerson.employeeNumber || `EMP-${Math.floor(Math.random() * 1000)}`,
                phoneNumber: newPerson.phoneNumber,
                email: newPerson.email,
                image: newPerson.image,
                faceDescriptor: newPerson.faceDescriptor,
                status: newPerson.status || 'Active',
                sharedFolderLink: newPerson.sharedFolderLink,
                certifications: newPerson.certifications || [],
                appRole: newPerson.appRole || 'Tech',
                prevailingWage: newPerson.prevailingWage || false,
                emergencyContactName: newPerson.emergencyContactName,
                emergencyContactPhone: newPerson.emergencyContactPhone,
                onboardingDate: newPerson.onboardingDate,
                regularRate: newPerson.regularRate,
                rainyDayRate: newPerson.rainyDayRate,
                overtimeRate: newPerson.overtimeRate,
                mealAllowance: newPerson.mealAllowance,
                gasAllowance: newPerson.gasAllowance,
                truckAllowance: newPerson.truckAllowance,
                leadPay: newPerson.leadPay,
                totalPerdiem: newPerson.totalPerdiem,
                subsidiary: activeSubsidiary,
                subsidiaryMetadata: newPerson.subsidiaryMetadata || {}
            };
            
            // Sync locally & backend via zustand trigger updates
            addPersonnel(created);
            
            let targetProjId = newPerson.tempProjectId;
            if (!targetProjId && activeSubsidiary === 'MX') {
                const cdmxProj = projects.find(p => 
                    p.name.toLowerCase().includes('cdmx') || 
                    p.codeName?.toLowerCase().includes('cdmx') ||
                    p.name === 'EST-LNV-000' ||
                    p.codeName === 'EST-LNV-000' ||
                    p.name.toLowerCase().includes('ciudad de méxico') ||
                    p.name.toLowerCase().includes('mexico city')
                );
                if (cdmxProj) {
                    targetProjId = cdmxProj.id;
                }
            }

            if (targetProjId) {
                await transferPersonnel(created.id, targetProjId);
            }
            
            setIsAddModalOpen(false);
            setNewPerson(null);
            
            // Auto-select newly created person
            setSelectedPersonId(created.id);
            setEditDraft({ ...created });
        } catch (err: any) {
            alert(`Failed to seamlessly invite user: ${err.message}`);
        }
    };

    const handleAddCert = (draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => {
        setter({ ...draft, certifications: [...(draft.certifications || []), { name: '', expirationDate: '', hasAttachment: false }] });
    };

    const handleUpdateCert = (index: number, field: string, value: string, draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => {
        const certs = [...(draft.certifications || [])];
        certs[index] = { ...certs[index], [field]: value };
        setter({ ...draft, certifications: certs });
    };

    const handleRemoveCert = (index: number, draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => {
        setter({ ...draft, certifications: (draft.certifications || []).filter((_, i) => i !== index) });
    };

    // Filter + sort: active first, inactive at bottom
    const filteredPersonnel = personnel
        .filter(p => !['Customer'].includes(p.appRole || ''))
        .filter(p => (p.subsidiary || 'US') === activeSubsidiary)
        .filter(p => {
            if (filterRole === 'All') return true;
            if (filterRole === 'Prevailing Wage') return p.prevailingWage;
            return p.appRole === filterRole;
        })
        .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            if (a.status === b.status) return a.name.localeCompare(b.name);
            return a.status === 'Active' ? -1 : 1;
        });

    const selectedPerson = personnel.find(p => p.id === selectedPersonId) ?? null;
    const assignedProjects = selectedPerson
        ? projects.filter(p => p.assignedPersonnel?.includes(selectedPerson.id))
        : [];

    const renderCertsEditor = (draft: Partial<PersonnelType>, setter: (d: Partial<PersonnelType>) => void) => (
        <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Award size={12} className="text-brand-teal" /> {t('personnel.profile.certifications')}
                </label>
                <Button variant="outline" size="sm" onClick={() => handleAddCert(draft, setter)} className="h-7 gap-1 rounded-lg text-xs">
                    <Plus size={12} /> {t('personnel.profile.add_cert')}
                </Button>
            </div>
            {(draft.certifications || []).map((cert, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl group relative overflow-hidden">
                    <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{t('personnel.profile.cert_name')}</label>
                        <Input
                            placeholder="e.g. OSHA 30"
                            value={cert.name}
                            onChange={e => handleUpdateCert(index, 'name', e.target.value, draft, setter)}
                            className="h-9 text-sm bg-white border-gray-200"
                        />
                    </div>
                    <div className="w-36 shrink-0 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Certification Date</label>
                        <Input
                            type="date"
                            value={cert.expirationDate}
                            onChange={e => handleUpdateCert(index, 'expirationDate', e.target.value, draft, setter)}
                            className="h-9 text-sm bg-white border-gray-200 pr-0"
                            style={{ 
                                colorScheme: 'light',
                                paddingRight: '2px'
                            }}
                        />
                    </div>
                    <div className="self-end pb-0.5">
                        <button 
                            onClick={() => handleRemoveCert(index, draft, setter)} 
                            className="p-2.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all shadow-sm"
                            title="Delete Certification"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
            {(!draft.certifications || draft.certifications.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    {t('personnel.profile.no_certs')}. {t('common.actions')}.
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-accent-greyDark flex items-center gap-3">
                        <User className="text-brand-teal" size={28} />
                        {t('nav.personnel')}
                    </h1>
                    <p className="text-gray-500 mt-1">{t('personnel.subtitle')}</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl gap-2 font-bold shadow-sm h-11 px-6"
                        onClick={() => {
                            setBulkFileError(null);
                            setBulkFileSuccess(null);
                            setIsBulkModalOpen(true);
                        }}
                    >
                        <Upload size={18} /> Carga Masiva
                    </Button>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button
                                className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl gap-2 font-bold shadow-soft h-11 px-6"
                                onClick={() => setNewPerson(null)}
                            >
                                <Plus size={18} /> {t('personnel.new_personnel')}
                            </Button>
                        </DialogTrigger>
                    <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-accent-greyDark">{t('personnel.new_personnel')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.name')}</label>
                                <Input placeholder="e.g. John Doe" value={newPerson?.name || ''} onChange={e => setNewPerson({ ...newPerson, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.position')}</label>
                                    <Input placeholder="e.g. Lead Electrician" value={newPerson?.position || ''} onChange={e => setNewPerson({ ...newPerson, position: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><FolderGit2 size={14} className="text-brand-teal" /> {t('personnel.columns.id')}</label>
                                    <Input placeholder="e.g. EMP-1234" value={newPerson?.employeeNumber || ''} onChange={e => setNewPerson({ ...newPerson, employeeNumber: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.email')}</label>
                                    <Input type="email" placeholder="john.doe@latnovva.com" value={newPerson?.email || ''} onChange={e => setNewPerson({ ...newPerson, email: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">Password (Optional)</label>
                                    <Input type="text" placeholder="Leaves as magic link if blank" value={newPerson?.password || ''} onChange={e => setNewPerson({ ...newPerson, password: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.phone')}</label>
                                    <Input placeholder="e.g. 956-280-8290" value={newPerson?.phoneNumber || ''} onChange={e => setNewPerson({ ...newPerson, phoneNumber: e.target.value })} />
                                </div>
                            </div>
                            {canManagePersonnel && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Shield size={14} className="text-brand-teal" /> {t('personnel.columns.role')}</label>
                                        <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={newPerson?.appRole || 'Tech'} onChange={e => setNewPerson({ ...newPerson, appRole: e.target.value as any })}>
                                            <option value="Tech">Tech</option>
                                            <option value="Office">Office</option>
                                            <option value="Supervisor">Supervisor</option>
                                            <option value="Manager">Manager</option>
                                            <option value="HR">HR</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Activity size={14} className="text-brand-teal" /> {t('personnel.columns.status')}</label>
                                        <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={newPerson?.status || 'Active'} onChange={e => setNewPerson({ ...newPerson, status: e.target.value as any })}>
                                            <option value="Active">{t('common.active')}</option>
                                            <option value="Inactive">{t('common.inactive')}</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Información Básica / General Info</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Sitio Asignado / Assigned Site</label>
                                                <select 
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                                    value={newPerson?.tempProjectId || ''}
                                                    onChange={e => {
                                                        const pId = e.target.value;
                                                        const pName = projects.find(p => p.id === pId)?.name || '';
                                                        setNewPerson({ 
                                                            ...newPerson, 
                                                            tempProjectId: pId,
                                                            subsidiaryMetadata: { 
                                                                ...newPerson?.subsidiaryMetadata, 
                                                                siteAssigned: pName 
                                                            } 
                                                        });
                                                    }}
                                                >
                                                    <option value="">{t('personnel.unassigned', 'Unassigned / Ninguno')}</option>
                                                    {projects
                                                        .filter(p => p.status === 'Active')
                                                        .map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.dbo', 'Date of Birth')}</label>
                                                <Input type="date" value={newPerson?.dbo || ''} onChange={e => {
                                                    const dob = e.target.value;
                                                    const today = new Date();
                                                    const birth = new Date(dob);
                                                    let calculatedAge = '';
                                                    if (!isNaN(birth.getTime())) {
                                                        let age = today.getFullYear() - birth.getFullYear();
                                                        const m = today.getMonth() - birth.getMonth();
                                                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                                                            age--;
                                                        }
                                                        calculatedAge = String(age);
                                                    }
                                                    setNewPerson({ 
                                                        ...newPerson, 
                                                        dbo: dob,
                                                        subsidiaryMetadata: { 
                                                            ...newPerson?.subsidiaryMetadata, 
                                                            birthDate: dob,
                                                            age: calculatedAge 
                                                        } 
                                                    });
                                                }} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Edad / Age</label>
                                                <Input type="number" readOnly placeholder="Auto-calculated" value={newPerson?.subsidiaryMetadata?.age || ''} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Género / Gender</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={newPerson?.subsidiaryMetadata?.gender || ''} onChange={e => setNewPerson({ ...newPerson, subsidiaryMetadata: { ...newPerson?.subsidiaryMetadata, gender: e.target.value } })}>
                                                    <option value="">Select...</option>
                                                    <option value="MASCULINO">Masculino / Male</option>
                                                    <option value="FEMENINO">Femenino / Female</option>
                                                    <option value="OTRO">Otro / Other</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Estado Civil / Marital Status</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={newPerson?.subsidiaryMetadata?.maritalStatus || ''} onChange={e => setNewPerson({ ...newPerson, subsidiaryMetadata: { ...newPerson?.subsidiaryMetadata, maritalStatus: e.target.value } })}>
                                                    <option value="">Select...</option>
                                                    <option value="SOLTERO(A)">Soltero(a) / Single</option>
                                                    <option value="CASADO(A)">Casado(a) / Married</option>
                                                    <option value="DIVORCIADO(A)">Divorciado(a) / Divorced</option>
                                                    <option value="VIUDO(A)">Viudo(a) / Widowed</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Dirección Completa / Full Address</label>
                                                <Input placeholder="e.g. Calle 60 #123, Mérida" value={newPerson?.subsidiaryMetadata?.addressFull || ''} onChange={e => setNewPerson({ ...newPerson, subsidiaryMetadata: { ...newPerson?.subsidiaryMetadata, addressFull: e.target.value } })} />
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Correo Personal / Personal Email</label>
                                                <Input type="email" placeholder="personal.email@example.com" value={newPerson?.subsidiaryMetadata?.personalEmail || ''} onChange={e => setNewPerson({ ...newPerson, subsidiaryMetadata: { ...newPerson?.subsidiaryMetadata, personalEmail: e.target.value } })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Contacto de Emergencia / Emergency Contact</label>
                                                <Input placeholder="e.g. Jane Doe" value={newPerson?.emergencyContactName || ''} onChange={e => setNewPerson({ ...newPerson, emergencyContactName: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Teléfono de Emergencia / Emergency Phone</label>
                                                <Input placeholder="e.g. 999-123-4567" value={newPerson?.emergencyContactPhone || ''} onChange={e => setNewPerson({ ...newPerson, emergencyContactPhone: e.target.value })} />
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Parentesco de Emergencia / Emergency Relationship</label>
                                                <Input placeholder="e.g. Esposa, Madre, Hermano" value={newPerson?.subsidiaryMetadata?.emergencyContactRelationship || ''} onChange={e => setNewPerson({ ...newPerson, subsidiaryMetadata: { ...newPerson?.subsidiaryMetadata, emergencyContactRelationship: e.target.value } })} />
                                            </div>
                                        </div>
                                    </div>

                                    {activeSubsidiary === 'US' && (
                                        <div className="space-y-4 pt-2 border-t border-gray-100">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">US Onboarding Info</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.onboarding_date')}</label>
                                                    <Input type="date" value={newPerson?.onboardingDate || ''} onChange={e => setNewPerson({ ...newPerson, onboardingDate: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><ExternalLink size={14} className="text-brand-teal" /> {t('personnel.certs_folder')}</label>
                                        <Input placeholder={t('personnel.certs_folder_placeholder')} value={newPerson?.sharedFolderLink || ''} onChange={e => setNewPerson({ ...newPerson, sharedFolderLink: e.target.value })} />
                                    </div>

                                    {newPerson && renderCertsEditor(newPerson, setNewPerson)}

                                    {(userRole === 'HR' || userRole === 'Manager') && (
                                        activeSubsidiary === 'US' ? (
                                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                                                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                                                    <Shield size={14} /> {t('personnel.finance.title')}
                                                </h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.regular_hours')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.regularRate ?? 0} onChange={e => setNewPerson({ ...newPerson, regularRate: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.rainy_day')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.rainyDayRate ?? 0} onChange={e => setNewPerson({ ...newPerson, rainyDayRate: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.over_time')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.overtimeRate ?? 0} onChange={e => setNewPerson({ ...newPerson, overtimeRate: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.meal_days')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.mealAllowance ?? 0} onChange={e => setNewPerson({ ...newPerson, mealAllowance: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.gas_day')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.gasAllowance ?? 0} onChange={e => setNewPerson({ ...newPerson, gasAllowance: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.truck')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.truckAllowance ?? 0} onChange={e => setNewPerson({ ...newPerson, truckAllowance: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.lead_pay')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.leadPay ?? 0} onChange={e => setNewPerson({ ...newPerson, leadPay: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                    <div className="space-y-1 col-span-2">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.per_diem', 'Per Diem')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={newPerson?.totalPerdiem ?? 0} onChange={e => setNewPerson({ ...newPerson, totalPerdiem: parseFloat(e.target.value) || 0 })} />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <MexicoHRForm data={newPerson || {}} onChange={(updates) => setNewPerson(p => p ? { ...p, ...updates } : p)} />
                                        )
                                    )}
                                </div>
                            <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">{t('personnel.profile_photo')}</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-brand-teal/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-brand-teal">
                                        {newPerson?.image ? <img src={newPerson.image} alt="Preview" className="w-full h-full object-cover" /> : <Camera size={20} />}
                                    </div>
                                    <Input type="file" accept="image/*" className="h-9 text-xs cursor-pointer flex-1"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) { 
                                                const r = new FileReader(); 
                                                r.onloadend = () => handlePhotoValidate(r.result as string, false); 
                                                r.readAsDataURL(file); 
                                            }
                                        }}
                                    />
                                </div>
                                {isValInProgress && (
                                    <p className="text-[10px] text-brand-teal animate-pulse mt-2 font-bold">
                                        {language === 'es' ? 'Validando calidad del rostro...' : 'Validating face quality...'}
                                    </p>
                                )}
                                {faceValSuccess && (
                                    <p className="text-[10px] text-emerald-600 mt-2 font-bold">
                                        ✓ {language === 'es' ? '¡Rostro detectado y verificado para acceso biométrico!' : 'Face detected and verified for Biometric clock-in!'}
                                    </p>
                                )}
                                {faceValError && (
                                    <p className="text-[10px] text-amber-600 mt-2 font-semibold">
                                        ⚠ {faceValError} ({language === 'es' ? 'guardada como foto de respaldo' : 'saved as fallback photo'})
                                    </p>
                                )}
                            </div>

                            <Button className="w-full mt-2 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl h-11 font-bold" onClick={handleAdd}>
                                {t('personnel.create_user')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-[1.5] min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Search size={12} /> {t('personnel.filters.search')}</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                            placeholder={t('personnel.filters.search_placeholder')}
                            className="pl-10 w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-teal h-10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Shield size={12} /> {t('personnel.filters.title', 'FILTER')}</label>
                    <div className="relative">
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-teal appearance-none cursor-pointer h-10"
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                        >
                            <option value="All">{t('personnel.filters.all_roles')}</option>
                            <option value="Tech">Techs</option>
                            <option value="Supervisor">Supervisors</option>
                            <option value="Manager">Managers</option>
                            <option value="Prevailing Wage">Prevailing Wage</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-xl items-center self-end h-10 ml-auto xl:ml-0">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <List size={16} /> {t('common.search')}
                    </button>
                    <button
                        onClick={() => setViewMode('org')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'org' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Network size={16} /> {t('personnel.columns.project')}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'list' ? (
                <div className="flex flex-col md:flex-row gap-4" style={{ minHeight: '560px' }}>
                    {/* LEFT: Person List */}
                    <div className={`w-full md:w-64 shrink-0 flex flex-col bg-gray-50 rounded-2xl border border-gray-100 p-2 overflow-y-auto gap-0.5 ${selectedPersonId ? 'hidden md:flex' : 'flex'}`}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1.5">
                            {t('personnel.directory_count', { count: filteredPersonnel.length })}
                        </p>

                        {filteredPersonnel.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 px-4 text-center">
                                <User size={28} className="mb-2 opacity-30" />
                                <p className="text-xs font-medium">{t('common.no_results')}</p>
                            </div>
                        )}

                        {filteredPersonnel.map(person => {
                            const isSelected = selectedPersonId === person.id;
                            const isInactive = person.status === 'Inactive';
                            return (
                                <button
                                    key={person.id}
                                    onClick={() => handleSelectPerson(person)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${
                                        isSelected
                                            ? 'bg-brand-teal text-white shadow-md'
                                            : isInactive
                                                ? 'hover:bg-white hover:shadow-sm opacity-50'
                                                : 'hover:bg-white hover:shadow-sm'
                                    }`}
                                >
                                    {/* Square avatar (matches Deployments style) */}
                                    <div className={`w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center text-xs font-bold shrink-0 relative ${
                                        isSelected ? 'bg-white/20 text-white' : isInactive ? 'bg-gray-200 text-gray-400' : 'bg-brand-teal/10 text-brand-teal'
                                    }`}>
                                        {person.image
                                            ? <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
                                            : person.name.charAt(0)
                                        }
                                        {/* Status dot */}
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border ${isSelected ? 'border-brand-teal' : 'border-gray-50'} ${person.status === 'Active' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-white' : 'text-accent-greyDark'}`}>
                                                {person.name}
                                            </p>
                                            {person.prevailingWage && (
                                                <span className={`text-[10px] font-black shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} title="Prevailing Wage">P</span>
                                            )}
                                        </div>
                                        <p className={`text-[10px] font-semibold mt-0.5 truncate ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                            {person.position}
                                        </p>
                                    </div>

                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 uppercase ${
                                        isSelected
                                            ? 'bg-white/20 text-white'
                                            : person.appRole === 'Supervisor'
                                                ? 'bg-blue-100 text-blue-600'
                                                : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {person.appRole}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* RIGHT: Detail / Edit Panel */}
                    <div className={`flex-1 min-w-0 ${!selectedPersonId ? 'hidden md:block' : 'block'}`}>
                        {editDraft && selectedPerson ? (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                                {/* Profile Header */}
                                <div className={`p-6 border-b border-gray-100 shrink-0 ${selectedPerson.status === 'Inactive' ? 'bg-gray-50' : 'bg-gradient-to-r from-brand-teal/5 to-transparent'}`}>
                                    <div className="flex items-center gap-5">
                                        <button 
                                            onClick={() => setSelectedPersonId(null)}
                                            className="md:hidden p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
                                        >
                                            <ArrowLeft size={20} className="text-accent-greyDark" />
                                        </button>
                                        {/* Avatar + Photo Upload */}
                                        <div className="relative shrink-0 group">
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-brand-teal/10 flex items-center justify-center text-brand-teal text-2xl font-bold">
                                                {editDraft.image
                                                    ? <img src={editDraft.image} alt={editDraft.name} className="w-full h-full object-cover" />
                                                    : editDraft.name?.charAt(0)
                                                }
                                            </div>
                                            <label className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                <Camera size={18} className="text-white" />
                                                <input type="file" accept="image/*" className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) { 
                                                            const r = new FileReader(); 
                                                            r.onloadend = () => handlePhotoValidate(r.result as string, true); 
                                                            r.readAsDataURL(file); 
                                                        }
                                                    }}
                                                />
                                            </label>
                                            {/* Status dot */}
                                            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow ${selectedPerson.status === 'Active' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h2 className="text-xl font-bold text-accent-greyDark leading-tight">{selectedPerson.name}</h2>
                                                    <p className="text-sm text-brand-teal font-semibold mt-0.5">{selectedPerson.position}</p>
                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                            selectedPerson.appRole === 'Supervisor' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            selectedPerson.appRole === 'Manager' ? 'bg-brand-teal/5 text-brand-teal border-brand-teal/10' :
                                                            'bg-gray-50 text-gray-500 border-gray-100'
                                                        }`}>
                                                            {selectedPerson.appRole}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                            selectedPerson.status === 'Active' ? 'bg-brand-teal/5 text-brand-teal border-brand-teal/10' : 'bg-gray-50 text-gray-400 border-gray-200'
                                                        }`}>
                                                            {selectedPerson.status === 'Active' ? <CheckCircle2 size={10} /> : <CircleDashed size={10} />}
                                                            {selectedPerson.status}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                                                            #{selectedPerson.employeeNumber}
                                                        </span>
                                                        {selectedPerson.prevailingWage && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-600 border border-amber-400/20 shadow-sm">
                                                                <Award size={10} /> Prevailing Wage
                                                            </span>
                                                        )}
                                                        {canManagePersonnel ? (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {/* Assigned Projects Tags */}
                                                                {/* Current Project Tag (if any) */}
                                                                {assignedProjects.length > 0 && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-teal text-white border border-brand-teal shadow-sm group/tag transition-all">
                                                                        <Briefcase size={10} />
                                                                        {assignedProjects[0].name}
                                                                        <button 
                                                                            onClick={() => {
                                                                                 assignedProjects.forEach(ap => {
                                                                                     updateProject(ap.id, {
                                                                                         assignedPersonnel: (ap.assignedPersonnel || []).filter(id => id !== selectedPerson.id)
                                                                                     });
                                                                                });
                                                                                updatePersonnel(selectedPerson.id, { prevailingWage: false });
                                                                            }}
                                                                            className="ml-1 text-white/50 hover:text-white transition-colors"
                                                                            title="Unassign Project"
                                                                        >
                                                                            <X size={10} />
                                                                        </button>
                                                                    </span>
                                                                )}
                                                                
                                                                {/* Transfer / Assign Project Dropdown */}
                                                                <div className="relative group/add">
                                                                    <select 
                                                                        className="text-[10px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 outline-none appearance-none cursor-pointer pr-6 hover:bg-gray-100 hover:text-gray-600 transition-all"
                                                                        value=""
                                                                        onChange={(e) => {
                                                                             const newProjectId = e.target.value;
                                                                             if (!newProjectId) return;
                                                                             transferPersonnel(selectedPerson.id, newProjectId);
                                                                        }}
                                                                    >
                                                                        <option value="">
                                                                            {assignedProjects.length > 0 ? `+ ${t('personnel.transfer_project', 'Transfer Project')}` : `+ ${t('personnel.assign_project', 'Assign Project')}`}
                                                                        </option>
                                                                        {projects
                                                                            .filter(p => p.status === 'Active' && !assignedProjects.some(ap => ap.id === p.id))
                                                                            .map(p => (
                                                                                <option key={p.id} value={p.id}>{p.name} {p.prevailingWage ? '(PW)' : ''}</option>
                                                                            ))
                                                                        }
                                                                    </select>
                                                                    <Plus size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover/add:text-gray-600" />
                                                                </div>
                                                            </div>
                                                        ) : assignedProjects.length > 0 ? (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2.5 py-1 rounded-full border border-brand-teal/20 flex items-center gap-1.5 shadow-sm">
                                                                    <Briefcase size={10} /> {assignedProjects[0].name}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-400 italic px-2.5 py-1">{t('personnel.unassigned', 'Unassigned')}</span>
                                                        )}
                                                        {isValInProgress && (
                                                            <div className="w-full">
                                                                <p className="text-[10px] text-brand-teal animate-pulse mt-2 font-bold">
                                                                    {language === 'es' ? 'Validando calidad del rostro...' : 'Validating face quality...'}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {faceValSuccess && (
                                                            <div className="w-full">
                                                                <p className="text-[10px] text-emerald-600 mt-2 font-bold">
                                                                    ✓ {language === 'es' ? '¡Rostro detectado y verificado para acceso biométrico!' : 'Face detected and verified for Biometric clock-in!'}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {faceValError && (
                                                            <div className="w-full">
                                                                <p className="text-[10px] text-amber-600 mt-2 font-semibold">
                                                                    ⚠ {faceValError} ({language === 'es' ? 'guardada como foto de respaldo' : 'saved as fallback photo'})
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-3 shrink-0">
                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={handleSelectPerson.bind(null, selectedPerson)}
                                                            className="h-9 px-4 rounded-xl text-xs gap-1.5 border-gray-200 hover:bg-gray-50"
                                                        >
                                                            <X size={14} /> {t('common.cancel', 'Cancel')}
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            onClick={handleSave}
                                                            className={`h-9 px-5 rounded-xl text-xs font-bold gap-1.5 transition-all ${isSaved ? 'bg-emerald-500 hover:bg-emerald-500' : 'bg-brand-teal hover:bg-brand-teal/90'} text-white shadow-soft`}
                                                        >
                                                            {isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                                            {isSaved ? t('personnel.saved') : t('personnel.profile.save')}
                                                        </Button>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {selectedPerson.email && (
                                                            <a href={`mailto:${selectedPerson.email}`} className="p-2 rounded-xl bg-gray-100 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors text-gray-400" title={selectedPerson.email}>
                                                                <Mail size={16} />
                                                            </a>
                                                        )}
                                                        {selectedPerson.phoneNumber && (
                                                            <a href={`tel:${selectedPerson.phoneNumber}`} className="p-2 rounded-xl bg-gray-100 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors text-gray-400" title={selectedPerson.phoneNumber}>
                                                                <Phone size={16} />
                                                            </a>
                                                        )}
                                                        {selectedPerson.sharedFolderLink && (
                                                            <a href={selectedPerson.sharedFolderLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-gray-100 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors text-gray-400" title="Certs Folder">
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        )}
                                                        {isManager && (
                                                            <button
                                                                onClick={() => { deletePersonnel(selectedPerson.id); setSelectedPersonId(null); setEditDraft(null); }}
                                                                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                                                                title="Delete Personnel"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Form Body */}
                                <div className="p-6 flex-1 overflow-y-auto space-y-5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('personnel.edit_info')}</p>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.name')}</label>
                                        <Input value={editDraft.name || ''} onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.columns.position')}</label>
                                            <Input value={editDraft.position || ''} onChange={e => setEditDraft(d => d ? { ...d, position: e.target.value } : d)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><FolderGit2 size={14} className="text-brand-teal" /> {t('personnel.columns.id')}</label>
                                            <Input value={editDraft.employeeNumber || ''} onChange={e => setEditDraft(d => d ? { ...d, employeeNumber: e.target.value } : d)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">Email Address</label>
                                            <Input type="email" value={editDraft.email || ''} onChange={e => setEditDraft(d => d ? { ...d, email: e.target.value } : d)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">Reset Password (Optional)</label>
                                            <Input type="text" placeholder="Enter new password to override" value={editDraft.password || ''} onChange={e => setEditDraft(d => d ? { ...d, password: e.target.value } : d)} />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-sm font-semibold text-accent-greyDark">Phone Number</label>
                                            <Input value={editDraft.phoneNumber || ''} onChange={e => setEditDraft(d => d ? { ...d, phoneNumber: e.target.value } : d)} />
                                        </div>
                                    </div>

                                    {isHROrManager && (
                                        <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Shield size={14} className="text-brand-teal" /> {t('personnel.columns.role')}</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={editDraft.appRole || 'Tech'} onChange={e => setEditDraft(d => d ? { ...d, appRole: e.target.value as any } : d)}>
                                                    <option value="Tech">Tech</option>
                                                    <option value="Office">Office</option>
                                                    <option value="Supervisor">Supervisor</option>
                                                    <option value="Manager">Manager</option>
                                                    <option value="HR">HR</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><Activity size={14} className="text-brand-teal" /> {t('personnel.columns.status')}</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={editDraft.status || 'Active'} onChange={e => setEditDraft(d => d ? { ...d, status: e.target.value as any } : d)}>
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                            </div>
                                        </div>
                                        </>
                                    )}

                                    <div className="space-y-4 pt-2 border-t border-gray-100 mt-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Información Básica / General Info</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Sitio Asignado / Assigned Site</label>
                                                <select 
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                                    value={assignedProjects[0]?.id || ''}
                                                    onChange={async (e) => {
                                                        if (!selectedPerson) return;
                                                        const pId = e.target.value;
                                                        const pName = projects.find(p => p.id === pId)?.name || '';
                                                        
                                                        // Update project assignment in state/database
                                                        await transferPersonnel(selectedPerson.id, pId || null);
                                                        
                                                        // Sync the metadata siteAssigned value
                                                        setEditDraft(d => d ? {
                                                            ...d,
                                                            subsidiaryMetadata: {
                                                                ...d.subsidiaryMetadata,
                                                                siteAssigned: pName
                                                            }
                                                        } : d);
                                                    }}
                                                >
                                                    <option value="">{t('personnel.unassigned', 'Unassigned / Ninguno')}</option>
                                                    {projects
                                                        .filter(p => p.status === 'Active')
                                                        .map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.profile.dbo', 'Date of Birth')}</label>
                                                <Input type="date" value={editDraft.dbo || ''} onChange={e => {
                                                    const dob = e.target.value;
                                                    const today = new Date();
                                                    const birth = new Date(dob);
                                                    let calculatedAge = '';
                                                    if (!isNaN(birth.getTime())) {
                                                        let age = today.getFullYear() - birth.getFullYear();
                                                        const m = today.getMonth() - birth.getMonth();
                                                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                                                            age--;
                                                        }
                                                        calculatedAge = String(age);
                                                    }
                                                    setEditDraft(d => d ? {
                                                        ...d,
                                                        dbo: dob,
                                                        subsidiaryMetadata: {
                                                            ...d.subsidiaryMetadata,
                                                            birthDate: dob,
                                                            age: calculatedAge
                                                        }
                                                    } : d);
                                                }} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Edad / Age</label>
                                                <Input type="number" readOnly placeholder="Auto-calculated" value={editDraft.subsidiaryMetadata?.age || ''} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Género / Gender</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={editDraft.subsidiaryMetadata?.gender || ''} onChange={e => setEditDraft(d => d ? { ...d, subsidiaryMetadata: { ...d.subsidiaryMetadata, gender: e.target.value } } : d)}>
                                                    <option value="">Select...</option>
                                                    <option value="MASCULINO">Masculino / Male</option>
                                                    <option value="FEMENINO">Femenino / Female</option>
                                                    <option value="OTRO">Otro / Other</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Estado Civil / Marital Status</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal" value={editDraft.subsidiaryMetadata?.maritalStatus || ''} onChange={e => setEditDraft(d => d ? { ...d, subsidiaryMetadata: { ...d.subsidiaryMetadata, maritalStatus: e.target.value } } : d)}>
                                                    <option value="">Select...</option>
                                                    <option value="SOLTERO(A)">Soltero(a) / Single</option>
                                                    <option value="CASADO(A)">Casado(a) / Married</option>
                                                    <option value="DIVORCIADO(A)">Divorciado(a) / Divorced</option>
                                                    <option value="VIUDO(A)">Viudo(a) / Widowed</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Dirección Completa / Full Address</label>
                                                <Input placeholder="e.g. Calle 60 #123, Mérida" value={editDraft.subsidiaryMetadata?.addressFull || ''} onChange={e => setEditDraft(d => d ? { ...d, subsidiaryMetadata: { ...d.subsidiaryMetadata, addressFull: e.target.value } } : d)} />
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Correo Personal / Personal Email</label>
                                                <Input type="email" placeholder="personal.email@example.com" value={editDraft.subsidiaryMetadata?.personalEmail || ''} onChange={e => setEditDraft(d => d ? { ...d, subsidiaryMetadata: { ...d.subsidiaryMetadata, personalEmail: e.target.value } } : d)} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Contacto de Emergencia / Emergency Contact</label>
                                                <Input value={editDraft.emergencyContactName || ''} onChange={e => setEditDraft(d => d ? { ...d, emergencyContactName: e.target.value } : d)} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Teléfono de Emergencia / Emergency Phone</label>
                                                <Input value={editDraft.emergencyContactPhone || ''} onChange={e => setEditDraft(d => d ? { ...d, emergencyContactPhone: e.target.value } : d)} />
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-sm font-semibold text-accent-greyDark">Parentesco de Emergencia / Emergency Relationship</label>
                                                <Input placeholder="e.g. Esposa, Madre, Hermano" value={editDraft.subsidiaryMetadata?.emergencyContactRelationship || ''} onChange={e => setEditDraft(d => d ? { ...d, subsidiaryMetadata: { ...d.subsidiaryMetadata, emergencyContactRelationship: e.target.value } } : d)} />
                                            </div>
                                        </div>
                                    </div>

                                    {activeSubsidiary === 'US' && (
                                        <div className="space-y-4 pt-2 border-t border-gray-100 mt-2">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">US Onboarding Info</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-accent-greyDark">{t('personnel.onboarding_date')}</label>
                                                    <Input type="date" value={editDraft.onboardingDate || ''} onChange={e => setEditDraft(d => d ? { ...d, onboardingDate: e.target.value } : d)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-accent-greyDark flex items-center gap-2"><ExternalLink size={14} className="text-brand-teal" /> {t('personnel.certs_folder')}</label>
                                        <Input placeholder="e.g. OneDrive or Google Drive URL" value={editDraft.sharedFolderLink || ''} onChange={e => setEditDraft(d => d ? { ...d, sharedFolderLink: e.target.value } : d)} />
                                    </div>

                                    {renderCertsEditor(editDraft, (d) => setEditDraft(d))}

                                    {(userRole === 'HR' || userRole === 'Manager') && (
                                        activeSubsidiary === 'US' ? (
                                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                                                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                                                    <Shield size={14} /> {t('personnel.finance.title')}
                                                </h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.regular_hours')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.regularRate ?? 0} onChange={e => setEditDraft(d => d ? { ...d, regularRate: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.rainy_day')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.rainyDayRate ?? 0} onChange={e => setEditDraft(d => d ? { ...d, rainyDayRate: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.over_time')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.overtimeRate ?? 0} onChange={e => setEditDraft(d => d ? { ...d, overtimeRate: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.meal_days')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.mealAllowance ?? 0} onChange={e => setEditDraft(d => d ? { ...d, mealAllowance: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.gas_day')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.gasAllowance ?? 0} onChange={e => setEditDraft(d => d ? { ...d, gasAllowance: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.truck')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.truckAllowance ?? 0} onChange={e => setEditDraft(d => d ? { ...d, truckAllowance: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.lead_pay')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.leadPay ?? 0} onChange={e => setEditDraft(d => d ? { ...d, leadPay: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                    <div className="space-y-1 col-span-2">
                                                        <label className="text-[10px] font-bold text-amber-700/60 uppercase">{t('personnel.finance.per_diem', 'Per Diem')}</label>
                                                        <Input type="number" step="0.01" className="h-9 bg-white border-amber-200" value={editDraft.totalPerdiem ?? 0} onChange={e => setEditDraft(d => d ? { ...d, totalPerdiem: parseFloat(e.target.value) || 0 } : d)} />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <MexicoHRForm data={editDraft} onChange={(updates) => setEditDraft(d => d ? { ...d, ...updates } : d)} />
                                        )
                                    )}


                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                <User size={36} className="mb-3 opacity-30" />
                                <p className="text-sm font-medium text-accent-greyDark">{t('personnel.select_prompt')}</p>
                                <p className="text-xs mt-1">Click anyone from the list to view and edit their profile.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <OrgChartView />
            )}
            {/* Bulk Upload Modal */}
            <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-xl border border-gray-150">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Upload className="text-brand-teal w-5 h-5" />
                            Carga Masiva de Personal
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-slate-600 leading-normal">
                            Sube un archivo CSV utilizando la plantilla oficial de LATNOVVA para registrar múltiples colaboradores activos simultáneamente.
                        </p>
                        
                        <div className="bg-teal-50/70 border border-teal-150 rounded-2xl p-4 space-y-3">
                            <span className="text-xs text-slate-800 font-bold block">1. Archivos de Apoyo</span>
                            <p className="text-[11px] text-slate-600 leading-snug">
                                Descarga la plantilla CSV para capturar los datos y el archivo de texto con el manual de especificaciones y reglas en español:
                            </p>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="text-xs font-bold border-teal-200 text-brand-teal hover:bg-teal-100/60 rounded-xl flex items-center justify-center gap-1.5 h-9 bg-white shadow-xs">
                                    <FileSpreadsheet size={14} /> Plantilla (.csv)
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleDownloadInstructions} className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 h-9 bg-white shadow-xs">
                                    <FileText size={14} /> Instrucciones (.txt)
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Seleccionar Archivo CSV</label>
                            <Input 
                                type="file" 
                                accept=".csv" 
                                onChange={handleCSVUpload} 
                                disabled={isBulkUploading} 
                                className="h-10 text-xs cursor-pointer border-slate-200"
                            />
                        </div>

                        {isBulkUploading && (
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-teal" />
                                Importando colaboradores...
                            </div>
                        )}

                        {bulkFileError && (
                            <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3 font-medium">
                                Error: {bulkFileError}
                            </div>
                        )}

                        {bulkFileSuccess && (
                            <div className="text-xs text-teal-600 bg-teal-50 border border-teal-100 rounded-xl p-3 font-medium">
                                {bulkFileSuccess}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsBulkModalOpen(false)} className="w-full rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-bold text-sm">
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
