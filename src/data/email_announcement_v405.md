# COMUNICADO OFICIAL DE OPERACIONES Y TECNOLOGÍA
**Para:** Todo el equipo LATNOVVA (Oficinas Mérida y CDMX)  
**De:** Dirección de Operaciones & Equipo de Desarrollo Tecnológico  
**Fecha:** 8 de Septiembre de 2026  
**Asunto:** [RESUELTO] Incidencia en Sistema de Registro de Asistencia – Actualización a Versión 4.0.5 y Acreditación de Jornada

---

Estimado equipo de LATNOVVA,

Queremos informarles sobre las incidencias presentadas durante la mañana del día de hoy en el portal de registro de asistencia y checador, así como las soluciones definitivas que han sido desplegadas en producción.

### 1. ¿Qué ocurrió? (Causa Raíz)
Durante el despliegue de la funcionalidad de **Face ID** para todo el personal de oficina, la concurrencia simultánea en los dispositivos generó una sobrecarga severa en el motor de procesamiento biométrico y en la descarga en segundo plano de los modelos de visión artificial. Esto provocó:
* Lentitud extrema o bloqueos en la pantalla de "Analizando estructura facial..." (en algunos casos demorando varios minutos).
* Retrasos en la sincronización de proyectos (menú desplegable vacío o carga demorada).
* Inconsistencias en la geolocalización de la oficina de Mérida que mostraba a colaboradores fuera de la geocerca.

### 2. Solución Implementada – Versión 4.0.5
Hemos liberado y desplegado de inmediato la **Versión 4.0.5** de LATNOVVA ServOps Portal con las siguientes mejoras:
1. **Face ID Ultrarrápido y Manos Libres:**
   * El tiempo de verificación facial se ha reducido drásticamente de varios minutos a **menos de 400 milisegundos**.
   * **Auto-captura y Auto-confirmación:** Una vez centrado tu rostro por 1.2 segundos, el sistema valida y registra automáticamente tu entrada/salida sin requerir botones adicionales.
   * **Botón de contingencia permanente:** En caso de cualquier falla de iluminación o conectividad, se mantiene siempre disponible el acceso para registrar la checada con foto de respaldo sin interrupciones.
2. **Selección de Proyecto Flexible:**
   * Tu proyecto u oficina asignada se autoselecciona de manera inmediata al iniciar.
   * Si estás laborando temporalmente en otra sede (por ejemplo, colaborador de CDMX laborando en Mérida o viceversa), el menú desplegable te permite seleccionar libremente cualquier oficina o proyecto activo.
3. **Geocerca de Oficina Mérida Actualizada:**
   * Se actualizaron con total precisión las coordenadas de la oficina de Mérida (Itzimná) y su radio de cobertura (500m), eliminando cualquier falso reporte de distancia.

---

### 3. Acreditación Automática de Jornada de Hoy (08:00 a 18:00 hrs)
Conscientes de que los problemas técnicos impidieron a la mayoría registrar su inicio de labores a tiempo:

> **Todas las jornadas del día de hoy (8 de septiembre de 2026) han sido autocreadas y acreditadas de 08:00 a 18:00 hrs (10 horas estándar completas) con estatus APROBADO para todo el personal regular.**

* Aquellos colaboradores que registraron salida posterior o tuvieron horas adicionales registradas, conservan el total de tiempo efectivamente trabajado.
* **Si requieres alguna corrección o ajuste específico sobre tu jornada de hoy, por favor ponte en contacto directo con Jacqueline Martínez del equipo de Recursos Humanos (`jacqueline.martinez@latnovva.com`).**

---

### 4. Instrucciones para el Colaborador
Para asegurarte de que tu dispositivo esté operando con la versión corregida:
1. Abre el portal en tu navegador o aplicación instalada.
2. Verifica en la esquina inferior que aparezca la **Versión 4.0.5**.
3. Si aún ves la versión 4.0.4 o anterior, simplemente actualiza la página (**Ctrl + F5** en PC o deslizar hacia abajo para recargar en tu celular / cerrar y reabrir la app).

Agradecemos profundamente su paciencia y comprensión durante la resolución de esta contingencia.

Atentamente,  
**Equipo de Tecnología y Recursos Humanos**  
LATNOVVA
