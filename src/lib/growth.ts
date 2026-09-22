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
  '刚刚翻开这本文集。',
  '读到喜欢的字句，留下一枚书签。',
  '在阅读与交流中，渐渐熟悉。',
  '写下自己的话，也认真倾听。',
  '读过的篇章，已成一座小小书房。',
  '纸上有旧友，书中有长伴。',
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
