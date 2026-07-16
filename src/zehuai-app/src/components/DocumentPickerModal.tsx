import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { DocumentRef } from '../types';
import { listFolderContents, copyTemplate } from '../services/feishu';

interface DocumentPickerModalProps {
  visible: boolean;
  onClose: () => void;
  folderToken?: string;
  targetFolderToken?: string;
  onCreated?: (doc: { fileToken: string; url: string }) => void;
}

export default function DocumentPickerModal({
  visible,
  onClose,
  folderToken,
  targetFolderToken,
  onCreated,
}: DocumentPickerModalProps) {
  const [templates, setTemplates] = useState<DocumentRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!folderToken) return;
    setLoading(true);
    try {
      const files = await listFolderContents(folderToken);
      setTemplates(files.filter(f => f.type !== 'folder'));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [folderToken]);

  useEffect(() => {
    if (visible && folderToken) {
      loadTemplates();
    }
  }, [visible, folderToken, loadTemplates]);

  const handleSelectTemplate = async (template: DocumentRef) => {
    setCreating(true);
    try {
      const result = await copyTemplate(
        template.token,
        template.type,
        undefined,
        targetFolderToken,
      );
      Alert.alert('创建成功', '文档已从模板创建');
      onCreated?.(result);
      onClose();
    } catch {
      Alert.alert('创建失败', '无法从模板创建文档，请重试');
    } finally {
      setCreating(false);
    }
  };

  const getDocIcon = (type: string): string => {
    switch (type) {
      case 'docx': return 'document-text-outline';
      case 'sheet': return 'grid-outline';
      case 'bitable': return 'calculator-outline';
      default: return 'document-outline';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>从模板创建</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={styles.loadingText}>加载模板列表...</Text>
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>暂无可用模板</Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={(item) => item.token}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.templateItem}
                  onPress={() => handleSelectTemplate(item)}
                  disabled={creating}
                  activeOpacity={0.7}
                >
                  <View style={styles.templateIcon}>
                    <Ionicons name={getDocIcon(item.type) as any} size={22} color={Colors.accent} />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.templateType}>{item.type.toUpperCase()}</Text>
                  </View>
                  {creating ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '70%',
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.section,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.section,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  templateType: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
