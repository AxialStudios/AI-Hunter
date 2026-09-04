import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../constants/theme';
import { useProStatus } from '../../context/ProContext';

const FEATURES = [
  { label: 'Core game',               free: true,  pro: true,  freeText: 'Unlimited',     proText: 'Unlimited'    },
  { label: 'Daily puzzle',            free: true,  pro: true,  freeText: '5 pairs/day',   proText: '5 pairs/day'  },
  { label: 'First tell per image',    free: true,  pro: true                                                       },
  { label: 'All tells + annotations', free: false, pro: true                                                       },
  { label: 'No ads',                  free: false, pro: true                                                       },
  { label: 'Personal analytics',      free: false, pro: true                                                       },
  { label: 'Streak protection',       free: false, pro: true,  proText: 'Coming soon'                              },
  { label: 'New AI model packs',      free: false, pro: true,  proText: 'Early access'                             },
];

function Cell({ val, text }) {
  if (text) return <Text style={styles.cellText}>{text}</Text>;
  if (val)  return <Feather name="check" size={16} color={colors.correct} />;
  return     <Feather name="minus" size={16} color="#333" />;
}

export default function PaywallScreen({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { setIsPro } = useProStatus();

  function handleSubscribe(plan) {
    console.log('Subscribe tapped —', plan, '— RevenueCat to be wired');
    Alert.alert('Pro activated (dev mode)', `${plan} plan selected`, [
      { text: 'OK', onPress: () => { setIsPro(true); onClose?.(); } },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <Text style={styles.eyebrow}>AI HUNTER PRO</Text>
          <Text style={styles.heading}>Upgrade to Pro</Text>
          <Text style={styles.subheading}>Stay sharp in a world where you can't trust what you see.</Text>

          {/* Feature table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={styles.tableFeatureCol} />
              <View style={styles.tableValCol}><Text style={styles.colLabel}>Free</Text></View>
              <View style={styles.tableValCol}><Text style={[styles.colLabel, styles.colLabelPro]}>Pro</Text></View>
            </View>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                <View style={styles.tableFeatureCol}>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
                <View style={styles.tableValCol}>
                  <Cell val={f.free} text={f.freeText} />
                </View>
                <View style={styles.tableValCol}>
                  <Cell val={f.pro} text={f.proText} />
                </View>
              </View>
            ))}
          </View>

          {/* Pricing */}
          <TouchableOpacity style={styles.btnAnnual} onPress={() => handleSubscribe('Annual')} activeOpacity={0.85}>
            <View>
              <Text style={styles.btnAnnualLabel}>Annual — $29.99/year</Text>
              <Text style={styles.btnAnnualSub}>Best value · $2.50/month</Text>
            </View>
            <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>BEST</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnMonthly} onPress={() => handleSubscribe('Monthly')} activeOpacity={0.85}>
            <Text style={styles.btnMonthlyText}>Monthly — $4.99/month</Text>
          </TouchableOpacity>

          <Text style={styles.legalNote}>Cancel anytime. Restores purchases on same Apple ID.</Text>

        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.bg },
  scroll:   { paddingHorizontal: 24, paddingBottom: 24 },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  eyebrow:    { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2, textAlign: 'center', marginTop: 16 },
  heading:    { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center', marginTop: 8 },
  subheading: { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22, marginBottom: 28 },

  table:           { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 24 },
  tableHeader:     { flexDirection: 'row', backgroundColor: '#111', paddingVertical: 10 },
  tableRow:        { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 2 },
  tableRowAlt:     { backgroundColor: '#0D0D0D' },
  tableFeatureCol: { flex: 1, paddingLeft: 14, justifyContent: 'center' },
  tableValCol:     { width: 64, alignItems: 'center', justifyContent: 'center' },
  colLabel:        { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary, textAlign: 'center' },
  colLabelPro:     { color: '#a78bfa' },
  featureLabel:    { fontSize: 13, fontFamily: fonts.regular, color: colors.textPrimary },
  cellText:        { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },

  btnAnnual:      { backgroundColor: '#7c3aed', borderRadius: radius.pill, paddingVertical: 16, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  btnAnnualLabel: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
  btnAnnualSub:   { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  bestBadge:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bestBadgeText:  { fontSize: 10, fontFamily: fonts.bold, color: '#fff', letterSpacing: 1 },

  btnMonthly:     { borderWidth: 1, borderColor: '#2A2A2A', borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  btnMonthlyText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },

  legalNote: { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary, textAlign: 'center' },
});
