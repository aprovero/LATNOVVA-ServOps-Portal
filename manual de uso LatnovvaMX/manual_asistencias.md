# Manual de Usuario: Módulo de Asistencias (Attendance & Overrides)
## Portal LATNOVVA ServiceTool (Roles Administrativos: HR y Manager)

Este manual detalla el funcionamiento del módulo de **Asistencias (Attendance)** en el portal **LATNOVVA MX**. Este módulo es una herramienta administrativa y de supervisión crítica.

> [!IMPORTANT]
> **Acceso restringido:** Este módulo está disponible exclusivamente para usuarios con roles de **HR (Recursos Humanos)** y **Manager (Gerente)**. Los colaboradores con roles de *Tech* (Técnicos) u *Office* (Oficina) no tienen acceso a esta sección en su panel.

---

## 📊 1. Panel de Métricas y KPIs (Attendance Dashboard)

En la parte superior del módulo de Asistencias encontrarás una sección de tarjetas de indicadores clave (KPIs) en tiempo real para el día actual.

### ¿Qué representa cada tarjeta?
- **Empleados Activos:** La cantidad total de colaboradores registrados con estatus activo en la sucursal de México.
- **Presentes Hoy:** El total de colaboradores que han registrado su entrada hoy (incluyendo tanto registros "On Site" en sitio como "Home Office" en casa), incluso si ya marcaron su salida.
- **En Vacaciones:** Colaboradores que cuentan con un registro de vacaciones aprobado para la fecha de hoy.
- **Incapacidad:** Personal ausente hoy debido a incapacidades médicas justificadas.
- **Home Office:** Colaboradores trabajando de manera remota el día de hoy.
- **Ausentes Hoy:** Personal programado para laborar hoy que no ha registrado marca de entrada.
- **Marcajes Incompletos:** Registros que presentan una entrada sin salida (u omitieron algún registro obligatorio) en fechas pasadas.
- **Conflictos:** Alertas críticas cuando un empleado tiene marcas de asistencia en un día registrado con justificación de ausencia (ej. marcas en días de vacaciones o incapacidad).
- **Horas Extras Hoy:** Suma total de las horas extras acumuladas por el personal durante el día de hoy.

### Interactividad de las tarjetas:
Al hacer clic sobre cualquiera de estas tarjetas, el sistema aplicará de manera automática un filtro rápido sobre la cuadrícula inferior para mostrarte únicamente a los colaboradores que corresponden a dicho indicador.

````carousel
![Dashboard de Asistencias - Indicadores](./images/attendance_dashboard.png)
<!-- slide -->
<!-- INSTRUCCIÓN DE IMAGEN: Toma una captura de pantalla de la fila superior de tarjetas (KPI Cards) y los filtros en la pantalla de Asistencias (Desktop) -->
````

---

## 🔍 2. Barra de Filtros y Búsqueda

Ubicada justo debajo del panel de métricas, te permite depurar y localizar registros específicos con total flexibilidad.

- **Buscar Colaborador:** Campo de texto libre para buscar personal escribiendo su nombre.
- **Filtrar por Proyecto:** Menú desplegable para ver únicamente al personal asignado o que realizó marcas de asistencia en un proyecto específico durante el rango de fechas seleccionado.
- **Contrato Empleado:** Filtro de estatus contractual (*Solo Activos*, *Solo Bajas*, o *Todos*).
- **Rango de Fechas (Desde / Hasta):** Calendarios interactivos para elegir la ventana de tiempo que deseas auditar. Por defecto, carga la semana laboral actual (Lunes a Domingo).

### Botones de Acción Rápidos (Quick Flags Toggles):
- **Presente Ahora:** Muestra únicamente a los colaboradores que se encuentran con un turno activo en este momento (tienen entrada registrada pero aún no marcan su salida).
- **Conflictos:** Filtra filas que presenten inconsistencias (marcas vs justificaciones de ausencia).
- **Marcajes Incompletos:** Muestra personas con marcas incompletas en el rango seleccionado.
- **Horas Extras:** Aísla a los colaboradores que han acumulado horas extraordinarias por encima de la jornada estándar.

---

## 📅 3. Cuadrícula de Asistencia Estilo Hoja de Cálculo (Spreadsheet Grid)

El núcleo del módulo muestra a tus colaboradores organizados en filas y los días del rango seleccionado en columnas.

### Columnas Fijas (Lado izquierdo):
- **Estado:** Indica si el colaborador es un empleado activo en nómina (Activo) o una baja.
- **Nombre:** Nombre completo del trabajador.
- **Proyecto:** Nombre o código del proyecto principal asignado al colaborador.

### Celdas Diarias y Códigos de Color:
Cada celda representa un día y muestra de forma visual la situación de asistencia del colaborador a través de colores y códigos:

| Estatus Visual | Significado en México | Color de Celda |
| :--- | :--- | :--- |
| **Horas (Ej. 08:00 / 17:30)** | Presente / Laborado (Entrada y Salida registradas) | Verde Esmeralda claro |
| **Vacation** / **Vacaciones** | Periodo vacacional aprobado | Morado/Indigo claro |
| **Sick Leave** / **Incapacidad** | Incapacidad médica | Rojo suave |
| **Home Office** | Trabajo desde casa | Púrpura claro |
| **Leave** / **Permiso** | Permiso personal con goce | Rosa claro |
| **Unpaid** / **Permiso S/G** | Permiso sin goce de sueldo | Gris |
| **Training** / **Capacitación** | Capacitación o adiestramiento | Azul |
| **Holiday** / **Feriado** | Día feriado oficial | Amarillo claro |
| **Off** / **Descanso** | Día de descanso programado (Fin de semana) | Gris muy tenue |
| **Absent** / **Falta** | Falta injustificada | Rojo brillante |
| **Missing** / **Reg. Faltante**| Marcación incompleta (ej. falta salida) | Naranja/Ámbar suave |
| **Conflict** / **Conflicto** | Conflicto de registro (asistencia en día inactivo) | Ámbar intenso |
| *(Vacío)* / **Blank** | Fechas futuras sin programar o periodos previos | Blanco |

### Indicadores Especiales en Celda:
- **Insignia `+Xh` (Esquina superior derecha):** Indica que el empleado trabajó horas extras ese día (ej. `+2h`).
- **Punto de Exclamación `!` (Esquina inferior derecha):** Alerta de conflicto detectado.
- **Signo de Interrogación `?` (Esquina inferior derecha):** Alerta de marca incompleta (falta salida).

````carousel
![Cuadrícula de Asistencias (Spreadsheet Grid)](./images/attendance_grid.png)
<!-- slide -->
<!-- INSTRUCCIÓN DE IMAGEN: Captura la cuadrícula de asistencia mostrando las filas de empleados, sus proyectos asignados y las celdas de colores con los diferentes estados -->
````

---

## 🗂️ 4. Cajón Lateral de Detalle Diario (Day Detail Panel)

Al hacer clic en cualquier celda de la cuadrícula, se abrirá un panel deslizable desde el lado derecho que te permite visualizar el desglose del día auditado y realizar gestiones manuales.

### ¿Qué información muestra?
1. **Datos Generales:** Nombre del colaborador, fecha seleccionada y proyecto correspondiente.
2. **Desglose de Turnos (Shifts):** Si el colaborador realizó marcas, verás la hora de entrada, hora de salida, duración del almuerzo y horas totales trabajadas.
3. **Auditoría GPS:** Si el registro se realizó mediante la PWA móvil con GPS, mostrará las coordenadas exactas de entrada y salida, con un enlace directo que abre Google Maps para ver la geolocalización en el mapa. También mostrará la firma del colaborador.

### Acciones de Edición Administrativa:
El panel lateral contiene dos pestañas o acordeones interactivos para realizar ajustes autorizados por Recursos Humanos:

### A. Justificaciones y Ausencias (HR Overrides)
Se utiliza para registrar incidencias de nómina y ausencias programadas.
- **Tipo de Incidencia:** Permite seleccionar entre *Vacation* (Vacaciones), *Sick Leave* (Incapacidad), *Home Office*, *Personal Leave* (Permiso con goce), *Unpaid Leave* (Permiso sin goce), *Training* (Capacitación), o *Suspension* (Suspensión de labores).
- **Rango de Fechas:** Puedes aplicar la incidencia para un solo día o para un rango (ej. incapacidad de 3 días).
- **Notas/Comentarios:** Justificación del movimiento.
- Al guardar, la cuadrícula se actualizará pintando los días seleccionados con el color correspondiente a la incidencia.

### B. Correcciones Manuales (Manual Corrections)
Permite a Recursos Humanos o al Gerente corregir un error de marca del empleado (por ejemplo, si el empleado olvidó marcar su salida).
- **Hora de Entrada (Time In) y Hora de Salida (Time Out):** Ajusta los horarios en formato digital.
- **Saltear Almuerzo (Skip Lunch):** Casilla para omitir el descuento automático de 1 hora de comida.
- **Razón del Cambio (Correction Reason):** **Es obligatorio escribir una justificación** para poder guardar los cambios. Esto asegura el cumplimiento de las políticas de auditoría interna de LATNOVVA.

````carousel
![Panel Lateral de Detalle Diario](./images/day_detail_panel.png)
<!-- slide -->
<!-- INSTRUCCIÓN DE IMAGEN: Abre la barra lateral haciendo clic sobre la celda de un empleado y toma captura del panel deslizable mostrando el desglose, las coordenadas GPS, la firma y los formularios de Justificación y Corrección Manual -->
````

---

## 📥 5. Sincronización y Exportación

En la esquina superior derecha del panel de Asistencias, cuentas con herramientas de comunicación con la base de datos y reporteador:

1. **Botón Sincronizar (Icono de flechas circulares):** Actualiza el listado con los registros más recientes que los colaboradores en campo hayan subido a la base de datos central en Supabase.
2. **Botón Exportar CSV (Exportar):** Descarga un archivo compatible con Excel que incluye la hoja de cálculo con todos los colaboradores filtrados, sus días de asistencia detallados, conteo de incidencias y acumulado de horas ordinarias y extras trabajadas en el periodo.

---

## 💡 Consejos para la Gestión de Incidencias (Tips para HR)

> [!TIP]
> **1. Resolución de Conflictos (Punto de Exclamación Rojo `!`):**
> Si ves un conflicto, abre el detalle del día. Verás que el empleado tiene una justificación registrada (ej. Vacaciones) pero aun así acudió al sitio y registró asistencia. Decide con el supervisor si se debe anular la justificación o pagar el día trabajado.
> 
> **2. Registros en Home Office:**
> Cuando un empleado trabaje bajo modalidad Home Office, el sistema registrará sus horas pero las asociará internamente al proyecto asignado en su ficha de personal para fines de costo de nómina, permitiéndote al mismo tiempo visualizar en el panel de asistencias que laboró desde su hogar de forma remota.
