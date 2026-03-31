import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Report, useStore } from '../../store/useStore';

// Register fonts if needed (using default for now, but good practice for branding)
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf', fontWeight: 700 }, // Bold
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'flex-end',
  },
  reportTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0D8A8A', // brand-teal
  },
  reportSubtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f8fafc',
    padding: 4,
    marginBottom: 8,
    color: '#1f2937',
    borderLeftWidth: 3,
    borderLeftColor: '#0D8A8A',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  col2: {
    width: '50%',
    paddingRight: 10,
  },
  col3: {
    width: '33.33%',
    paddingRight: 10,
  },
  col4: {
    width: '25%',
    paddingRight: 5,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    color: '#666',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 10,
    marginTop: 2,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#eee',
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 4,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  tableCellBold: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  notesBox: {
    borderWidth: 1,
    borderColor: '#eee',
    padding: 8,
    minHeight: 60,
    marginTop: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#999',
  },
  signatureBox: {
    width: '30%',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 4,
    marginTop: 30,
    alignItems: 'center',
  },
  signatureText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  signatureImage: {
    height: 30,
    marginBottom: 5,
  }
});

interface PrintableReportTemplateProps {
  report: Report;
}

export const PrintableReportTemplate = ({ report }: PrintableReportTemplateProps) => {
  const state = useStore.getState();
  const client = state.clients.find(c => c.id === report.clientId);
  const project = state.projects.find(p => p.id === report.projectId);
  
  const validLabor = (report.labor || []).filter(l => {
      if (!l.personnelId) return true;
      const person = state.personnel.find(p => p.id === l.personnelId);
      if (!person || !person.certifications) return true;
      const hasExpired = person.certifications.some(cert => cert.expirationDate && new Date(cert.expirationDate) < new Date());
      return !hasExpired;
  });

  const validTools = (report.usedTools || []).filter(toolId => {
      const tool = state.tools.find(t => t.id === toolId);
      if (!tool) return false;
      const isExpired = new Date(tool.certificationExpiry) < new Date();
      return !isExpired;
  });
  
  const getPersonName = (idOrName?: string) => {
    if (!idOrName) return 'System / Unknown';
    const person = state.personnel.find(p => p.id === idOrName);
    return person ? person.name : idOrName;
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleString();
    } catch (e) {
        return isoString;
    }
  };

  const documentTitle = `${project?.codeName ? `${project.codeName} - ` : ''}LATNOVVA Report ${report.id}`;

  return (
  <Document title={documentTitle}>
    <Page size="A4" style={styles.page}>
      
      {/* Logos */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 }}>
        {/* Left: COR + LATNOVVA */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image src="/cor-logo.png" style={{ height: 26, objectFit: 'contain' }} />
            <View style={{ width: 1, height: 20, backgroundColor: '#ccc', marginHorizontal: 8 }} />
            <Image src="/latnovva-logo.png" style={{ height: 22, objectFit: 'contain' }} />
        </View>
        {/* Right: Client logo or name */}
        <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
            {client?.logo ? (
                <Image src={client.logo} style={{ height: 35, objectFit: 'contain' }} />
            ) : (
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#333', textAlign: 'right' }}>
                  {client?.name || report.clientId || 'Client Info Missing'}
                </Text>
            )}
        </View>
      </View>

      {/* Header Title & Meta */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportTitle}>Daily Field Report</Text>
          <Text style={styles.reportSubtitle}>ID: {report.id} | Date: {report.date}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 8, color: '#666' }}>Created: {formatDateTime(report.createdAt)} by {getPersonName(report.createdBy)}</Text>
          {report.updatedAt && (
             <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Last Edited: {formatDateTime(report.updatedAt)} by {getPersonName(report.updatedBy)}</Text>
          )}
        </View>
      </View>

      {/* Project & General Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. General Information</Text>
        <View style={styles.row}>
          <View style={styles.col2}>
            <Text style={styles.label}>Project Name</Text>
            <Text style={styles.value}>{report.projectName}</Text>
          </View>
          <View style={styles.col2}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{report.state}</Text>
          </View>
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={styles.col2}>
            <Text style={styles.label}>Weather</Text>
            <Text style={styles.value}>{report.weather.temp}°C, {report.weather.condition}</Text>
          </View>
          <View style={styles.col2}>
            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>
              {report.location ? `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}` : 'N/A'}
            </Text>
          </View>
        </View>
        {report.schedule && (
          <View style={[styles.row, { marginTop: 8 }]}>
            <View style={styles.col2}>
              <Text style={styles.label}>Shift</Text>
              <Text style={styles.value}>{report.schedule.shift}</Text>
            </View>
            <View style={styles.col2}>
              <Text style={styles.label}>Working Hours</Text>
              <Text style={styles.value}>
                {report.schedule.arrival || 'N/A'} - {report.schedule.departure || 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Labor Section */}
      {validLabor.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Labor Allocation</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>Personnel</Text>
              <Text style={styles.tableCellBold}>Time In / Out</Text>
              <Text style={styles.tableCellBold}>Hours</Text>
            </View>
            {validLabor.map((l, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={[styles.tableCell, { flex: 2 }]}>
                  {getPersonName(l.personnelId)} {l.isOutsourced ? '(Outsourced)' : ''}
                </Text>
                <Text style={styles.tableCell}>{l.timeIn || '—'} - {l.timeOut || '—'}</Text>
                <Text style={styles.tableCell}>{l.hours}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Project Progress */}
      {report.activityLogs && report.activityLogs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Project Progress Updates</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>Task / Activity</Text>
              <Text style={styles.tableCellBold}>Prior %</Text>
              <Text style={styles.tableCellBold}>Added Today</Text>
              <Text style={styles.tableCellBold}>Current Total</Text>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>Notes</Text>
            </View>
            {report.activityLogs.map((log, i) => {
              let taskName = log.customTaskName || 'Unknown Task';
              if (log.scopeId && log.activityId && project) {
                 const scope = project.scopes.find(s => s.id === log.scopeId);
                 const activity = scope?.activities.find(a => a.id === log.activityId);
                 if (activity) {
                     taskName = `${scope?.name} - ${activity.title}`;
                 }
              }
              const total = (log.priorProgress || 0) + (log.progressReported || 0);
              return (
                <View style={styles.tableRow} key={i}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{taskName}</Text>
                  <Text style={styles.tableCell}>{log.priorProgress || 0}%</Text>
                  <Text style={styles.tableCell}>+{log.progressReported || 0}%</Text>
                  <Text style={styles.tableCell}>{total}%</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{log.notes || '-'}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Equipment Section */}
      {report.equipment && report.equipment.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Equipment Verified</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellBold}>Type</Text>
              <Text style={styles.tableCellBold}>Serial Number</Text>
              <Text style={styles.tableCellBold}>Status</Text>
            </View>
            {report.equipment.map((eq, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={styles.tableCell}>{eq.type}</Text>
                <Text style={styles.tableCell}>{eq.serialNumber}</Text>
                <Text style={styles.tableCell}>{eq.scanned ? 'Verified OCR' : 'Manual Entry'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Field Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Field Notes & Observations</Text>
        <View style={styles.notesBox}>
          <Text style={styles.value}>{report.notes || 'No remarks provided.'}</Text>
        </View>
      </View>

      {/* Tools Used */}
      {validTools.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Tools Used</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellBold}>Tool Name</Text>
              <Text style={styles.tableCellBold}>Model</Text>
              <Text style={styles.tableCellBold}>Serial Number</Text>
            </View>
            {validTools.map((toolId, i) => {
              const tool = state.tools.find(t => t.id === toolId);
              if (!tool) return null;
              return (
                <View style={styles.tableRow} key={i}>
                  <Text style={styles.tableCell}>{tool.name}</Text>
                  <Text style={styles.tableCell}>{tool.model}</Text>
                  <Text style={styles.tableCell}>{tool.serialNumber}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Checklists */}
      {report.checklists && report.checklists.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Quality & Safety Checklists</Text>
          {report.checklists.map((group, gi) => (
            <View key={gi} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#333' }}>{group.title}</Text>
                {group.locked && (
                  <Text style={{ fontSize: 8, color: '#006B5E', backgroundColor: '#e6f4f1', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>LOCKED</Text>
                )}
              </View>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCellBold, { flex: 2 }]}>Item</Text>
                  <Text style={styles.tableCellBold}>Status</Text>
                </View>
                {group.items.map((chk, i) => (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{chk.item}</Text>
                    <Text style={styles.tableCell}>{chk.status}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Attached Forms / Sub-Reports */}
      {report.subReportIds && report.subReportIds.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Attached Forms & Sub-Reports</Text>
          <View style={styles.table}>
             <View style={styles.tableHeader}>
                 <Text style={[styles.tableCellBold, { flex: 3 }]}>Form Title</Text>
                 <Text style={styles.tableCellBold}>Reference ID</Text>
             </View>
             {report.subReportIds.map((srId, i) => {
               const sr = state.subReportInstances.find((s: any) => s.id === srId);
               if (!sr) return null;
               return (
                 <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>{sr.templateName}</Text>
                    <Text style={styles.tableCell}>{sr.id}</Text>
                 </View>
               );
             })}
          </View>
        </View>
      )}

      {/* Occurrences */}
      {report.occurrences && report.occurrences.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Occurrences & Events</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellBold}>Time</Text>
              <Text style={[styles.tableCellBold, { flex: 3 }]}>Description</Text>
            </View>
            {report.occurrences.map((occ, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={styles.tableCell}>{occ.time}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{occ.description}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Media / Photos */}
      {report.media && report.media.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Attached Media & Photos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {report.media.map((m, i) => (
              <View key={i} style={{ width: '48%', marginBottom: 15, marginRight: i % 2 === 0 ? '4%' : 0 }}>
                {m.url && (m.url.startsWith('data:image') || m.url.startsWith('http')) ? (
                  <Image src={m.url} style={{ height: 150, objectFit: 'cover', backgroundColor: '#f0f0f0' }} />
                ) : (
                   <View style={{ height: 150, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }}>
                     <Text style={{ fontSize: 8, color: '#999' }}>Image not available</Text>
                   </View>
                )}
                {m.caption ? (
                  <Text style={{ fontSize: 9, marginTop: 4, color: '#555', fontStyle: 'italic' }}>{m.caption}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Custom Sections */}
      {report.customSections && report.customSections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Custom Modules</Text>
          {report.customSections.map((sec, i) => (
             <View key={i} style={{ marginBottom: 10 }}>
                <Text style={styles.label}>{sec.title}</Text>
                <Text style={styles.value}>{sec.content}</Text>
             </View>
          ))}
        </View>
      )}

      {/* Signatures */}
      <View style={[styles.section, { marginTop: 40 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {report.signatures?.map((sig, i) => (
            <View style={styles.signatureBox} key={i}>
              {sig.blob && sig.blob.startsWith('data:image') && (
                  <Image src={sig.blob} style={styles.signatureImage} />
              )}
              <Text style={styles.signatureText}>{sig.role}</Text>
              <Text style={{ fontSize: 7, color: '#666', marginTop: 2 }}>{sig.signedBy}</Text>
              <Text style={{ fontSize: 6, color: '#999', marginTop: 1 }}>{new Date(sig.timestamp).toLocaleDateString()}</Text>
            </View>
          ))}
          {(!report.signatures || report.signatures.length === 0) && (
              <Text style={{ fontSize: 10, color: '#999', fontStyle: 'italic' }}>No signatures applied.</Text>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>LATNOVVA Service operations</Text>
        <Text style={styles.footerText}>Generated automatically from ServiceTool</Text>
      </View>

    </Page>
  </Document>
  );
};
