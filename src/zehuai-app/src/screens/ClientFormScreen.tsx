import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { createClient } from '../services/feishu';
import { scheduleClientFollowUpReminder } from '../services/notifications';
import { ClientStatus, CLIENT_STATUSES } from '../types';
import StatusBadge from '../components/StatusBadge';

type RootStackParamList = {
  ClientForm: undefined;
  ClientDetail: { clientId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'ClientForm'>;

const SOURCE_OPTIONS = ['小红书', '抖音', '转介绍', '其他'];

export default function ClientFormScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wechat, setWechat] = useState('');
  const [source, setSource] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<ClientStatus>('潜在客户');
  const [notes, setNotes] = useState('');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请填写客户姓名');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('提示', '请填写客户手机号');
      return;
    }
    if (!source) {
      Alert.alert('提示', '请选择客户来源');
      return;
    }

    setSaving(true);
    try {
      const recordId = await createClient({
        '客户姓名': name.trim(),
        '联系方式': phone.trim(),
        '微信号': wechat.trim(),
        '来源渠道': source,
        '客户状态': status,
        '标签': tags.trim(),
        '备注': notes.trim(),
      });

      if (recordId) {
        const today = new Date().toISOString();
        scheduleClientFollowUpReminder(recordId, name.trim(), today).catch(() => {});
        navigation.goBack();
      } else {
        Alert.alert('保存失败', '无法创建客户，请稍后重试');
      }
    } catch (err: any) {
      Alert.alert('保存失败', err?.message || '创建客户时出错');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <FormInput
              label="客户姓名 *"
              placeholder="请输入客户姓名"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <FormInput
              label="手机号 *"
              placeholder="请输入手机号"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <FormInput
              label="微信"
              placeholder="请输入微信号（选填）"
              value={wechat}
              onChangeText={setWechat}
            />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>来源 *</Text>
              <View style={styles.sourceOptions}>
                {SOURCE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.sourceOption,
                      source === option && styles.sourceOptionActive,
                    ]}
                    onPress={() => setSource(option)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sourceOptionText,
                        source === option && styles.sourceOptionTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <FormInput
              label="标签"
              placeholder="用逗号分隔，如：高意向,婚摄（选填）"
              value={tags}
              onChangeText={setTags}
            />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>客户状态</Text>
              <TouchableOpacity
                style={styles.statusSelector}
                onPress={() => setStatusModalVisible(true)}
                activeOpacity={0.7}
              >
                <StatusBadge status={status} size="medium" />
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>备注</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="补充客户信息、需求或跟进记录..."
                placeholderTextColor={Colors.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>保存</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={statusModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择客户状态</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {CLIENT_STATUSES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.statusOption,
                  item === status && styles.statusOptionActive,
                ]}
                onPress={() => {
                  setStatus(item);
                  setStatusModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <StatusBadge status={item} size="medium" />
                {item === status && (
                  <Ionicons name="checkmark" size={20} color={Colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceWarm,
    height: 48,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  sourceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sourceOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sourceOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sourceOptionText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  sourceOptionTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  notesInput: {
    height: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  statusSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceWarm,
    height: 48,
    paddingHorizontal: Spacing.md,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadows.sm,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...Typography.h4,
    color: Colors.textOnAccent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  statusOptionActive: {
    backgroundColor: Colors.accent + '15',
  },
});
