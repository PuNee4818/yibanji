export interface Checkin {streak_days:number;reward_eggs:number;reward_exp:number;checkin_date:string}
export interface Task {id:string;name:string;frequency:'daily'|'weekly';progress:number;target:number;reward_eggs:number;reward_exp:number;rewarded_at:string|null}
export interface Growth {today:string;week_start:string;wallet:{egg_balance:number;lifetime_earned_eggs:number;lifetime_spent_eggs:number};progress:{exp:number;level:number};today_checkin:Checkin|null;last_checkin:Checkin|null;streak_days:number;total_checkins:number;tasks:Task[]}
export const levelNames=['初读','常客','书友','墨客','藏书人','长驻'];
