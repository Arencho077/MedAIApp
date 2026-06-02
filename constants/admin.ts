// 🔒 SECURITY: Admin check should be done server-side via RLS policies
// This client-side check is only for UI visibility, NOT for authorization
// Real authorization MUST be enforced in Supabase RLS policies

export const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || '';
