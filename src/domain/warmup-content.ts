export const warmupDays = [1, 4, 7, 10, 13, 16, 19] as const;
export type WarmupDay = (typeof warmupDays)[number];
