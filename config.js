// Daybook settings. The publishable key is designed to be public:
// your data is protected by the security rules in the database, not by hiding this key.
// NEVER put the "secret" / "service_role" key or your database password in here.

export const SUPABASE_URL = 'https://bysbvqjeaivxqkersgvf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_48l_L3adMF5iPb9GDnpPug_gjn8uwAz';

// Freelance routine
export const WORK_TARGET_MINUTES = 180;   // weekly target (3 hours)
export const WORK_DAYS = [1, 6];          // planned sessions: 1 = Monday, 6 = Saturday
export const MINIMUM_MINUTES = 15;        // the bad-day minimum

// Gym
export const GYM_TARGET_PER_WEEK = 3;     // sessions per week
