export type PackageType = 'subscription' | 'lifetime';

export type PackageName =
  | 'basic_sub_month'
  | 'explorer_sub_month'
  | 'unlimited_sub_month'
  // FUTURE: add your pay-per-scan packages here
  | 'basic_25_lifetime'
  | 'explorer_100_lifetime';

export interface PackageConfig {
  type: PackageType;
  credits: number | 'unlimited';
  durationInDays?: number; // only for subscription
}

export const PACKAGE_CONFIG: Record<PackageName, PackageConfig> = {
  // ===== CURRENT MONTHLY SUBSCRIPTIONS =====
  basic_sub_month: {
    type: 'subscription',
    credits: 20,
    durationInDays: 30,
  },
  explorer_sub_month: {
    type: 'subscription',
    credits: 50,
    durationInDays: 30,
  },
  unlimited_sub_month: {
    type: 'subscription',
    credits: 'unlimited',
    durationInDays: 30,
  },

  // ===== FUTURE PAY-PER-SCAN (no expiry) =====
  // You can change names & credit amounts later
  basic_25_lifetime: {
    type: 'lifetime',
    credits: 25,
  },
  explorer_100_lifetime: {
    type: 'lifetime',
    credits: 100,
  },
};