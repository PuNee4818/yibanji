export interface Checkin {
  streak_days: number;
  reward_eggs: number;
  reward_exp: number;
  checkin_date: string;
}
export interface Task {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  progress: number;
  target: number;
  reward_eggs: number;
  reward_exp: number;
  rewarded_at: string | null;
}
export interface Growth {
  today: string;
  week_start: string;
  wallet: { egg_balance: number; lifetime_earned_eggs: number; lifetime_spent_eggs: number };
  progress: { exp: number; level: number };
  today_checkin: Checkin | null;
  last_checkin: Checkin | null;
  streak_days: number;
  total_checkins: number;
  tasks: Task[];
}
export const levelNames = ['初识', '留笺', '知章', '执笔', '藏卷', '长伴'];

export const levelThresholds = [0, 50, 150, 400, 900, 1800] as const;
export const levelDescriptions = [
  '初次翻开，不妨多坐一会儿。',
  '在喜欢的一页，留个记号。',
  '有些句子，隔几天又想起。',
  '读到兴起，也写几行。',
  '心里有几篇，随时想重读。',
  '书放在手边，你也常来。',
];
export function normalizedLevel(value: number) {
  return Number.isInteger(value) ? Math.max(1, Math.min(6, value)) : 1;
}
export function levelBadge(value: number) {
  const level = normalizedLevel(value);
  const badge = document.createElement('span');
  badge.className = 'level-badge';
  badge.dataset.level = String(level);
  badge.textContent = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'][level - 1] + ' ' + levelNames[level - 1];
  badge.setAttribute('aria-label', '等级 ' + level + '，' + levelNames[level - 1]);
  badge.title = levelDescriptions[level - 1]!;
  return badge;
}
