import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import i18n from '../../i18n';

const clean = (text: any): string => {
  if (typeof text !== 'string') return String(text || '');
  return text.replace(/[^\x00-\x7F]/g, '').trim();
};

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#333',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#eee',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f766e', // brand-teal
    color: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCell: {
    padding: 3,
    fontSize: 6,
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  tableCellHeader: {
    padding: 3,
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
});

export interface EditableNominaRow {
  id: string;
  personnelId: string;
  name: string;
  status: string;
  nss: string;
  curp: string;
  rfc: string;
  hireDate: string;
  project: string;
  role: string;
  payrollType: string;
  dailyRate: string;
  monthlyRate: string;
  daysWorked: string;
  normalHours: string;
  overtimeHours: string;
  grossPay: string;
  isr: string;
  imss: string;
  infonavit: string;
  aguinaldo: string;
  sueldoNeto: string;
}

interface PrintableNominaProps {
  rows: EditableNominaRow[];
  projectName: string;
  startDate: string;
  endDate: string;
}

export const PrintableNomina = ({ rows, projectName, startDate, endDate }: PrintableNominaProps) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const latnovvaLogoUrl = `${origin}/latnovva-logo.png`;
  const ssLogoUrl = `${origin}/S&S-logo.png`;

  const totalGross = rows.reduce((acc, row) => acc + (parseFloat(row.grossPay) || 0), 0);
  const totalNet = rows.reduce((acc, row) => acc + (parseFloat(row.sueldoNeto) || 0), 0);

  // Column widths as percentages
  const colWidths = {
    name: '10%',
    status: '4%',
    reg: '5%',
    curp: '6%',
    rfc: '6%',
    hireDate: '5%',
    project: '6%',
    role: '5%',
    payrollType: '5%',
    rate: '4%',
    monthly: '4%',
    days: '4%',
    normal: '4%',
    overtime: '4%',
    gross: '5%',
    isr: '4%',
    imss: '4%',
    infonavit: '4%',
    aguinaldo: '4%',
    net: '6%'
  };

  return (
    <Document title={`Nomina_${startDate}_to_${endDate}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image src={latnovvaLogoUrl} style={{ height: 24, objectFit: 'contain' }} />
            <View style={{ width: 1, height: 16, backgroundColor: '#e5e7eb', marginLeft: 10, marginRight: 10 }} />
            <Image src={ssLogoUrl} style={{ height: 24, objectFit: 'contain' }} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>{i18n.t('nomina.title')}</Text>
            <Text style={styles.subtitle}>{i18n.t('nomina.period')} {startDate} - {endDate}</Text>
            <Text style={styles.subtitle}>{i18n.t('nomina.project')}: {projectName}</Text>
          </View>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, { width: colWidths.name }]}>{i18n.t('nomina.columns.name').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.status }]}>{i18n.t('nomina.columns.status').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.reg }]}>{i18n.t('nomina.columns.nss').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.curp }]}>{i18n.t('nomina.columns.curp').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.rfc }]}>{i18n.t('nomina.columns.rfc').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.hireDate }]}>{i18n.t('nomina.columns.hire_date').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.project }]}>{i18n.t('nomina.columns.project').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.role }]}>{i18n.t('nomina.columns.role').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.payrollType }]}>{i18n.t('nomina.columns.payroll_type').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.rate }]}>{i18n.t('nomina.columns.daily_rate').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.monthly }]}>{i18n.t('nomina.columns.monthly_rate').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.days }]}>{i18n.t('nomina.columns.days_worked').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.normal }]}>{i18n.t('nomina.columns.normal_hours').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.overtime }]}>{i18n.t('nomina.columns.overtime_hours').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.gross }]}>{i18n.t('nomina.columns.gross_pay').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.isr }]}>{i18n.t('nomina.columns.isr').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.imss }]}>{i18n.t('nomina.columns.imss').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.infonavit }]}>{i18n.t('nomina.columns.infonavit').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.aguinaldo }]}>{i18n.t('nomina.columns.aguinaldo').toUpperCase()}</Text>
            <Text style={[styles.tableCellHeader, { width: colWidths.net }]}>{i18n.t('nomina.columns.net_pay').toUpperCase()}</Text>
          </View>

          {/* Table Rows */}
          {rows.map((row, i) => {
            return (
              <View style={styles.tableRow} key={i}>
                <Text style={[styles.tableCell, { width: colWidths.name }]}>{clean(row.name)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.status }]}>{clean(row.status)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.reg }]}>{clean(row.nss)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.curp }]}>{clean(row.curp)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.rfc }]}>{clean(row.rfc)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.hireDate }]}>{clean(row.hireDate)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.project }]}>{clean(row.project)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.role }]}>{clean(row.role)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.payrollType }]}>{clean(row.payrollType)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.rate }]}>{clean(row.dailyRate)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.monthly }]}>{clean(row.monthlyRate)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.days }]}>{clean(row.daysWorked)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.normal }]}>{clean(row.normalHours)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.overtime }]}>{clean(row.overtimeHours)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.gross }]}>{clean(row.grossPay)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.isr }]}>{clean(row.isr)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.imss }]}>{clean(row.imss)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.infonavit }]}>{clean(row.infonavit)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.aguinaldo }]}>{clean(row.aguinaldo)}</Text>
                <Text style={[styles.tableCell, { width: colWidths.net, fontFamily: 'Helvetica-Bold' }]}>{clean(row.sueldoNeto)}</Text>
              </View>
            );
          })}
          
          {/* Footer Totals */}
          <View style={[styles.tableRow, { backgroundColor: '#f8fafc' }]}>
             <Text style={[styles.tableCell, { width: '70%', fontFamily: 'Helvetica-Bold', textAlign: 'right' }]}>{i18n.t('nomina.total_general')}</Text>
             <Text style={[styles.tableCell, { width: '30%', fontFamily: 'Helvetica-Bold', textAlign: 'right' }]}>{i18n.t('nomina.bruto')} ${totalGross.toFixed(2)}  |  {i18n.t('nomina.neto')} ${totalNet.toFixed(2)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
