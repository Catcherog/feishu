import { ClientProjectStage, CreativeProjectStage, ProjectType } from '../types';

export const CLIENT_PROJECT_STAGES: ClientProjectStage[] = [
  '获客建档', '策划确认', '拍摄执行', '选片确认',
  '修图交付', '成片交付', '分发发布', '复盘归档'
];

export const CREATIVE_PROJECT_STAGES: CreativeProjectStage[] = [
  '待拍摄', '拍摄中', '后期制作', '待交付', '已完成'
];

export function getStagesByType(type: ProjectType): string[] {
  return type === 'client' ? CLIENT_PROJECT_STAGES : CREATIVE_PROJECT_STAGES;
}

export function getInitialStage(type: ProjectType): string {
  return type === 'client' ? '获客建档' : '待拍摄';
}

export function getNextStage(type: ProjectType, currentStage: string): string | null {
  const stages = getStagesByType(type);
  const currentIndex = stages.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex >= stages.length - 1) return null;
  return stages[currentIndex + 1];
}

export function getStageIndex(type: ProjectType, stage: string): number {
  const stages = getStagesByType(type);
  return stages.indexOf(stage) + 1; // 1-based
}

export function isLastStage(type: ProjectType, stage: string): boolean {
  const stages = getStagesByType(type);
  return stages.indexOf(stage) === stages.length - 1;
}
