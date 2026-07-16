import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { createProject } from '../services/feishu';
import { useClients } from '../hooks/useFeishuData';
import { scheduleProjectDeadlineReminder } from '../services/notifications';
import { ProjectStatus, ProjectType } from '../types';
import { getInitialStage, getStagesByType } from '../constants/projectStages';
import { RootStackParamList } from '../navigation/AppNavigator';
import DatePicker from '../components/DatePicker';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PROJECT_TYPE_OPTIONS: { label: string; value: ProjectType }[] = [
  { label: '客片', value: 'client' },
  { label: '创作片', value: 'creative' },
];

export default function ProjectFormScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { data: clients } = useClients();

  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('creative');
  const [clientId, setClientId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('待拍摄');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);

  const statusOptions = useMemo<{ label: string; value: ProjectStatus }[]>(
    () => getStagesByType(projectType).map((s) => ({ label: s, value: s as ProjectStatus })),
    [projectType]
  );

  const handleTypeChange = (type: ProjectType) => {
    setProjectType(type);
    setStatus(getInitialStage(type) as ProjectStatus);
    setStatusOpen(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入项目名称');
      return;
    }

    setSaving(true);
    const fields: Record<string, unknown> = {
      '项目名称': name.trim(),
      '项目类型': projectType,
      '拍摄档期': scheduledDate.trim(),
      '拍摄地点': location.trim(),
      '项目状态': status,
      '精修交付时间': deadline.trim(),
      '备注': notes.trim(),
    };
    if (clientId) {
      fields['关联客户ID'] = clientId;
    }

    const recordId = await createProject(fields);
    setSaving(false);

    if (recordId) {
      if (deadline.trim()) {
        scheduleProjectDeadlineReminder(recordId, name.trim(), deadline.trim()).catch(() => {});
      }
      Alert.alert('创建成功', '项目已创建', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('创建失败', '请稍后重试');
    }
  };

  const clientOptions = [
    { label: '请选择客户', value: '' },
    ...clients.map((c) => ({ label: c.name, value: c.id })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>项目类型 *</Text>
            <View style={styles.segmentedControl}>
              {PROJECT_TYPE_OPTIONS.map((opt) => {
                const active = projectType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => handleTypeChange(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <FormInput
            label="项目名称 *"
            value={name}
            onChangeText={setName}
            placeholder="请输入项目名称"
          />

          <FormDropdown
            label="关联客户"
            value={clientId}
            options={clientOptions}
            onSelect={setClientId}
            open={clientOpen}
            setOpen={setClientOpen}
          />

          <DatePicker
            label="拍摄档期"
            value={scheduledDate}
            onChange={setScheduledDate}
            placeholder="请选择拍摄档期"
          />

          <FormInput
            label="拍摄地点"
            value={location}
            onChangeText={setLocation}
            placeholder="请输入拍摄地点"
          />

          <FormDropdown
            label="项目状态"
            value={status}
            options={statusOptions}
            onSelect={(v) => setStatus(v)}
            open={statusOpen}
            setOpen={setStatusOpen}
          />

          <DatePicker
            label="精修交付时间"
            value={deadline}
            onChange={setDeadline}
            placeholder="请选择精修交付时间"
          />

          <FormInput
            label="备注"
            value={notes}
            onChangeText={setNotes}
            placeholder="请输入备注"
            multiline
            numberOfLines={3}
          />

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
    </SafeAreaView>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

function FormDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
  open,
  setOpen,
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onSelect: (value: T) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label || '';

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}
          numberOfLines={1}
        >
          {value ? selectedLabel : '请选择'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textTertiary}
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownOptions}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.dropdownOption,
                opt.value === value && styles.dropdownOptionActive,
              ]}
              onPress={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  opt.value === value && styles.dropdownOptionTextActive,
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
              {opt.value === value && (
                <Ionicons name="checkmark" size={16} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
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
    ...Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    height: 50,
    paddingHorizontal: Spacing.lg,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 88,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  dropdownButton: {
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
  dropdownText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  dropdownPlaceholder: {
    color: Colors.textTertiary,
  },
  dropdownOptions: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownOptionActive: {
    backgroundColor: Colors.accent + '10',
  },
  dropdownOptionText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  dropdownOptionTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    height: 50,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
  },
  segmentText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: Colors.textOnAccent,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...Typography.h4,
    color: Colors.textOnAccent,
  },
});
