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

  return (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* Logos */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 }}>
        <View style={styles.logoContainer}>
            <Image src="/latnovva-logo.png" style={{ height: 40, objectFit: 'contain' }} />
        </View>
        <View style={styles.logoContainer}>
            {client?.logo ? (
                <Image src={client.logo} style={{ height: 40, objectFit: 'contain' }} />
            ) : (
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14 }}>{client?.name || report.clientId}</Text>
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
          <View style={styles.col3}>
            <Text style={styles.label}>Weather</Text>
            <Text style={styles.value}>{report.weather.temp}°C, {report.weather.condition}</Text>
          </View>
          <View style={styles.col3}>
            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>
              {report.location ? `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}` : 'N/A'}
            </Text>
          </View>
          <View style={styles.col3}>
            <Text style={styles.label}>Schedule</Text>
            <Text style={styles.value}>
              {report.schedule?.arrival || '-'} to {report.schedule?.departure || '-'} ({report.schedule?.shift})
            </Text>
          </View>
        </View>
      </View>

      {/* Labor Section */}
      {validLabor.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Labor Allocation</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellBold}>Role</Text>
              <Text style={styles.tableCellBold}>Quantity</Text>
              <Text style={styles.tableCellBold}>Hours/Ea</Text>
              <Text style={styles.tableCellBold}>Total Hours</Text>
            </View>
            {validLabor.map((l, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={styles.tableCell}>{l.role} {l.isOutsourced ? '(Sub)' : ''}</Text>
                <Text style={styles.tableCell}>{l.qty}</Text>
                <Text style={styles.tableCell}>{l.hours}</Text>
                <Text style={styles.tableCell}>{l.qty * l.hours}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Equipment Section */}
      {report.equipment && report.equipment.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Equipment Verified</Text>
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
        <Text style={styles.sectionTitle}>4. Field Notes & Observations</Text>
        <View style={styles.notesBox}>
          <Text style={styles.value}>{report.notes || 'No remarks provided.'}</Text>
        </View>
      </View>

      {/* Tools Used */}
      {validTools.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tools Used</Text>
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
          <Text style={styles.sectionTitle}>Quality & Safety Checklists</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>Item</Text>
              <Text style={styles.tableCellBold}>Status</Text>
            </View>
            {report.checklists.map((chk, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{chk.item}</Text>
                <Text style={styles.tableCell}>{chk.status}</Text>
              </View>
            ))}
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
          <Text style={styles.sectionTitle}>5. Custom Modules</Text>
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
