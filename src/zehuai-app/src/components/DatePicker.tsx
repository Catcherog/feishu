import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

interface DatePickerProps {
  label: string;
  value: string; // YYYY-MM-DD 格式
  onChange: (date: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DatePicker({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = '请选择日期',
}: DatePickerProps) {
  const [show, setShow] = useState(false);
  const selectedDate = parseDate(value);

  const handleConfirm = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setShow(false);
      if (date) {
        onChange(formatDate(date));
      }
    },
    [onChange]
  );

  const handlePress = () => setShow(true);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.inputButton} onPress={handlePress} activeOpacity={0.7}>
        <Text
          style={[styles.inputText, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      {show && (
        <>
          {Platform.OS === 'android' && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={handleConfirm}
            />
          )}
          {Platform.OS === 'ios' && (
            <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
              <View style={styles.iosOverlay}>
                <View style={styles.iosContainer}>
                  <View style={styles.iosHeader}>
                    <TouchableOpacity onPress={() => setShow(false)}>
                      <Text style={styles.iosCancelText}>取消</Text>
                    </TouchableOpacity>
                    <Text style={styles.iosTitle}>{label}</Text>
                    <View style={{ width: 40 }} />
                  </View>
                  <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    onChange={handleConfirm}
                    style={styles.iosPicker}
                  />
                </View>
              </View>
            </Modal>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    height: 50,
    paddingHorizontal: Spacing.lg,
  },
  inputText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  placeholder: {
    color: Colors.textTertiary,
  },
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iosContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xxl,
  },
  iosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iosCancelText: {
    ...Typography.body,
    color: Colors.accent,
  },
  iosTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  iosPicker: {
    height: 200,
  },
});
