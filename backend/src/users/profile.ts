/** Shared pieces for showing people: who they are to others, and the reserved-identity rule. */

/** SQL for the public card of a person: `u` is the users alias, `ap` the admin_profiles alias (LEFT JOIN). */
export const personSql = (u: string, ap: string) => `CASE WHEN ${u}.id IS NULL THEN NULL ELSE jsonb_build_object(
  'id', ${u}.id, 'role', CASE WHEN ${u}.role = 'contributor' THEN 'contributor' ELSE 'admin' END, 'username', ${u}.username,
  'name', CASE WHEN ${u}.role <> 'contributor' THEN coalesce(${ap}.admin_name, 'Admin')
               WHEN ${u}.use_provider_identity AND ${u}.provider_name <> '' THEN ${u}.provider_name ELSE ${u}.username END,
  'avatar', CASE WHEN ${u}.role <> 'contributor' THEN 'logo'
                 WHEN ${u}.use_provider_identity AND ${u}.provider_picture <> '' THEN ${u}.provider_picture
                 WHEN ${u}.photo_media_id IS NOT NULL THEN 'media:' || ${u}.photo_media_id
                 WHEN ${u}.avatar <> '' THEN 'avatar:' || ${u}.avatar ELSE 'avatar:wave' END,
  'badge', CASE WHEN ${u}.role <> 'contributor' THEN 'ADMIN' END) END`;

/** Company stories appear under "Admin" with the platform logo. */
export const COMPANY_PERSON = { id: null, role: 'admin', username: null, name: 'Admin', avatar: 'logo', badge: 'ADMIN' };
export const ANONYMOUS_PERSON = { id: null, role: 'contributor', username: null, name: 'Anonymous', avatar: 'avatar:anonymous', badge: null };

export const AVATARS = ['wave', 'anchor', 'dhow', 'lighthouse', 'fish', 'lifebuoy', 'compass', 'canoe', 'shell', 'heron', 'turtle', 'sail'];

const RESERVED = ['admin', 'administrator', 'superadmin', 'moderator', 'mod', 'support', 'staff', 'official', 'system', 'maritime', 'rememberingthewaters', 'anonymous', 'root', 'help', 'team'];
/** No Contributor may use "Admin" or close variants (adm1n, a_d_m_i_n, …) as a username. */
export function usernameProblem(name: string): 'username_invalid' | 'username_reserved' | null {
  if (!/^[A-Za-z0-9_]{3,30}$/.test(name)) return 'username_invalid';
  const plain = name.toLowerCase().replace(/[_]/g, '').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[4@]/g, 'a').replace(/3/g, 'e').replace(/5/g, 's');
  if (plain.includes('admin') || plain.includes('adrnin') || RESERVED.includes(plain)) return 'username_reserved';
  return null;
}

export const DEFAULT_SETTINGS = {
  highContrast: false, textSize: 'medium', reducedMotion: false, lowData: false, wifiOnly: false, readReceipts: true,
  notifications: {
    engagement: { inApp: true, push: true, email: false }, messages: { inApp: true, push: true, email: false },
    announcements: { inApp: true, push: true, email: false }, reminders: { inApp: true, push: true, email: false },
  },
  quietHours: { from: '', to: '' },
};
export const mergeSettings = (stored: any) => ({
  ...DEFAULT_SETTINGS, ...(stored ?? {}),
  notifications: Object.fromEntries(Object.entries(DEFAULT_SETTINGS.notifications).map(([k, v]) => [k, { ...v, ...(stored?.notifications?.[k] ?? {}) }])),
  quietHours: { ...DEFAULT_SETTINGS.quietHours, ...(stored?.quietHours ?? {}) },
});
