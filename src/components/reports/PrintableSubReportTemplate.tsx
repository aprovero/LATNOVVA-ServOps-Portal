import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { SubReportInstance, useStore } from '../../store/useStore';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
  },
  logoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#006B5E', // brand teal
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f5f5f5',
    padding: 6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 10,
  },
  col2: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#555',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    color: '#333',
  },
  metaText: {
    fontSize: 8,
    color: '#888',
  }
});

interface PrintableSubReportTemplateProps {
  subReport: SubReportInstance;
}

export const PrintableSubReportTemplate = ({ subReport }: PrintableSubReportTemplateProps) => {
  const state = useStore.getState();
  const project = state.projects.find(p => p.id === subReport.projectId);
  const client = state.clients.find(c => c.id === project?.clientId);
  const template = state.subReportTemplates.find(t => t.id === subReport.templateId);

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
        
        {/* Logos & Header */}
        <View style={styles.logoContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image src="/latnovva-logo.png" style={{ height: 30, objectFit: 'contain' }} />
            </View>
            <View>
                {client?.logo ? (
                    <Image src={client.logo} style={{ height: 35, objectFit: 'contain' }} />
                ) : (
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12 }}>{client?.name || 'Customer'}</Text>
                )}
            </View>
        </View>

        {/* Titles */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <View style={{ flex: 2 }}>
                <Text style={styles.title}>{subReport.templateName}</Text>
                <Text style={styles.subtitle}>
                    Project: {project?.name || 'Unknown Project'} {project?.codeName ? `(${project.codeName})` : ''}
                </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', paddingTop: 4 }}>
                <Text style={styles.metaText}>Sub-Report ID: {subReport.id}</Text>
                <Text style={styles.metaText}>Parent Report: {subReport.parentReportId}</Text>
                <Text style={[styles.metaText, { marginTop: 4 }]}>Issued: {formatDateTime(subReport.createdAt)}</Text>
                {subReport.updatedAt && (
                   <Text style={styles.metaText}>Updated: {formatDateTime(subReport.updatedAt)}</Text>
                )}
            </View>
        </View>

        {/* Form Fields */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Form Data</Text>
            {!template ? (
                <Text style={styles.value}>Warning: Original Template Definition not found.</Text>
            ) : (
                template.fields.map((field) => {
                    const val = subReport.values[field.id];
                    
                    if (field.type === 'picture' && val) {
                        return (
                            <View key={field.id} style={{ marginBottom: 15 }} wrap={false}>
                                <Text style={styles.label}>{field.name}</Text>
                                <Image src={val} style={{ height: 180, objectFit: 'contain', marginTop: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#eee', padding: 2 }} />
                            </View>
                        );
                    }

                    return (
                        <View key={field.id} style={[styles.row, { marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#fafafa' }]} wrap={false}>
                           <View style={{ width: '40%' }}>
                               <Text style={styles.label}>{field.name}</Text>
                               {field.type === 'checkbox' && (
                                   <Text style={{ fontSize: 7, color: '#aaa', marginTop: 1 }}>(Pass / Fail / NA)</Text>
                               )}
                           </View>
                           <View style={{ width: '60%' }}>
                               <Text style={[styles.value, { fontFamily: val && field.type === 'checkbox' ? 'Helvetica-Bold' : 'Helvetica' }]}>
                                   {val ? String(val) : '—'}
                               </Text>
                           </View>
                        </View>
                    );
                })
            )}
        </View>

      </Page>
    </Document>
  );
};
