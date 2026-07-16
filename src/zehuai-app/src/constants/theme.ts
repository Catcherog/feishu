export const Colors = {
  primary: '#1A1A2E',
  primaryLight: '#2D2D44',
  primaryDark: '#0F0F1A',
  accent: '#C9A96E',
  accentLight: '#D4BC8E',
  accentDark: '#B08D4F',
  background: '#F8F6F3',
  surface: '#FFFFFF',
  surfaceWarm: '#FDFBF8',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B6B80',
  textTertiary: '#9E9EB0',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#1A1A2E',
  border: '#E8E4DF',
  borderLight: '#F0EDE8',
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  error: '#E53935',
  errorLight: '#FFEBEE',
  info: '#2196F3',
  infoLight: '#E3F2FD',
  statusPending: '#FF9800',
  statusActive: '#2196F3',
  statusComplete: '#4CAF50',
  statusArchived: '#9E9E9E',
  overlay: 'rgba(26, 26, 46, 0.5)',
  shadow: 'rgba(26, 26, 46, 0.08)',
  shadowDark: 'rgba(26, 26, 46, 0.16)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  number: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    fontVariant: ['tabular-nums'] as any,
  },
  numberSmall: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
    fontVariant: ['tabular-nums'] as any,
  },
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const PlatformColors: Record<string, string> = {
  '小红书': '#FF2442',
  '抖音': '#000000',
  '朋友圈': '#07C160',
  '微博': '#FF8200',
  'B站': '#00A1D6',
};

export const StatusColors: Record<string, { bg: string; text: string }> = {
  '待拍摄': { bg: Colors.warningLight, text: Colors.warning },
  '拍摄中': { bg: Colors.infoLight, text: Colors.info },
  '后期制作': { bg: '#F3E5F5', text: '#9C27B0' },
  '待交付': { bg: Colors.warningLight, text: Colors.warning },
  '已完成': { bg: Colors.successLight, text: Colors.success },
  '潜在客户': { bg: Colors.infoLight, text: Colors.info },
  '跟进中': { bg: Colors.warningLight, text: Colors.warning },
  '已成交': { bg: Colors.successLight, text: Colors.success },
  '已归档': { bg: '#F5F5F5', text: Colors.statusArchived },
  '待发布': { bg: Colors.warningLight, text: Colors.warning },
  '发布中': { bg: Colors.infoLight, text: Colors.info },
  '已发布': { bg: Colors.successLight, text: Colors.success },
  '已下架': { bg: '#F5F5F5', text: Colors.statusArchived },
};
