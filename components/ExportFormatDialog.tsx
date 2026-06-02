import React, { useMemo } from 'react';
import { View, Modal, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

interface ExportFormatDialogProps {
  visible: boolean;
  onClose: () => void;
  onSelectFormat: (encrypted: boolean) => void;
  title?: string;
}

export default function ExportFormatDialog({
  visible, onClose, onSelectFormat, title = 'Export Format',
}: ExportFormatDialogProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View entering={ZoomIn.duration(300)} style={styles.dialog}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="download-outline" size={24} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>Choose how to export your data</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Plain text option */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => onSelectFormat(false)}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
                <Ionicons name="document-text-outline" size={22} color="#34D399" />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Plain Text</Text>
                <Text style={styles.optionDesc}>
                  Readable JSON — anyone with the file can see the data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.icon} />
            </TouchableOpacity>
          </Animated.View>

          {/* Encrypted option */}
          <Animated.View entering={FadeInDown.delay(180).duration(300)}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => onSelectFormat(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(129,140,248,0.15)' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#818CF8" />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Encrypted (E2EE)</Text>
                <Text style={styles.optionDesc}>
                  Protected with your passphrase — only you can read it
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.icon} />
            </TouchableOpacity>
          </Animated.View>

          {/* Info */}
          <View style={styles.infoPill}>
            <Ionicons name="information-circle" size={14} color={colors.accent} />
            <Text style={styles.infoText}>
              Encrypted exports require your E2EE passphrase to import
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(8, 12, 20, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    dialog: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 24,
      padding: 22,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 20,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 12,
      color: colors.icon,
      marginTop: 2,
      fontWeight: '500',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 10,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionContent: { flex: 1 },
    optionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
      marginBottom: 3,
    },
    optionDesc: {
      fontSize: 12,
      color: colors.icon,
      lineHeight: 17,
      fontWeight: '500',
    },
    infoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.glassLight,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: colors.icon,
      fontWeight: '500',
      lineHeight: 17,
    },
  });
}
