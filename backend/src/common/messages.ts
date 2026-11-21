import { HttpException } from '@nestjs/common';

/**
 * Standard texts from Appendix A of the Development Master Plan, in the launch languages.
 * English is the source. Kiswahili is translated here; Dholuo falls back to English until the community reviewers'
 * translation is loaded (Section 3.1.5). The website and apps carry the full interface translations.
 */
export const LANGUAGES = ['en', 'sw', 'luo', 'ar', 'fr', 'pt', 'es', 'so', 'mg', 'gu', 'hi', 'bn', 'id', 'fil', 'vi', 'zh', 'ja', 'el', 'tr', 'ru'] as const;
export const LAUNCH_LANGUAGES = ['en', 'sw', 'luo'];
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', sw: 'Kiswahili', luo: 'Dholuo', ar: 'Arabic', fr: 'French', pt: 'Portuguese', es: 'Spanish', so: 'Somali', mg: 'Malagasy',
  gu: 'Gujarati', hi: 'Hindi', bn: 'Bengali', id: 'Indonesian', fil: 'Filipino', vi: 'Vietnamese', zh: 'Chinese', ja: 'Japanese', el: 'Greek', tr: 'Turkish', ru: 'Russian',
};

export const REPORT_REASONS = [
  { key: 'inappropriate', en: 'Inappropriate or offensive content', sw: 'Maudhui yasiyofaa au ya kuudhi' },
  { key: 'misinformation', en: 'False information or misinformation', sw: 'Taarifa za uongo au za kupotosha' },
  { key: 'harassment', en: 'Harassment, hate speech, or bullying', sw: 'Unyanyasaji, matamshi ya chuki au uonevu' },
  { key: 'privacy', en: 'Privacy violation (personal data shared without consent)', sw: 'Ukiukaji wa faragha (taarifa binafsi zimeshirikiwa bila idhini)' },
  { key: 'spam', en: 'Spam, scam, or impersonation', sw: 'Barua taka, ulaghai au kujifanya mtu mwingine' },
];
export const DELETION_REASONS = [
  { key: 'no_longer_use', en: 'I no longer use the platform', sw: 'Situmii tena jukwaa hili' },
  { key: 'privacy', en: 'Privacy concerns', sw: 'Wasiwasi kuhusu faragha' },
  { key: 'notifications', en: 'I receive too many notifications', sw: 'Ninapokea arifa nyingi mno' },
  { key: 'another_account', en: 'I have another account', sw: 'Nina akaunti nyingine' },
  { key: 'not_useful', en: 'I did not find the content useful', sw: 'Sikuona maudhui yakiwa ya manufaa' },
];
export const RULES = [
  { en: 'Share genuine experiences and accurate information related to maritime heritage.', sw: 'Shiriki matukio ya kweli na taarifa sahihi zinazohusu urithi wa majini.' },
  { en: 'Be respectful: no harassment, hate speech, threats or personal attacks.', sw: 'Heshimu wengine: hakuna unyanyasaji, matamshi ya chuki, vitisho wala mashambulizi binafsi.' },
  { en: 'Protect privacy: do not share other people’s personal data, contact details or images without their consent.', sw: 'Linda faragha: usishiriki taarifa binafsi, mawasiliano au picha za watu wengine bila idhini yao.' },
  { en: 'No misinformation, conspiracy theories or political campaigning.', sw: 'Hakuna taarifa za kupotosha, nadharia za njama wala kampeni za kisiasa.' },
  { en: 'Only post content you own or have permission to share, and credit sources where possible.', sw: 'Chapisha tu maudhui unayomiliki au uliyo na ruhusa ya kushiriki, na taja vyanzo inapowezekana.' },
];
export const MODERATION_NOTE = {
  en: 'Every story is reviewed by AI and given a GREEN, YELLOW or RED flag. RED stories are blocked and reviewed by human admins. Admins can also delete stories and lock or hide comments. If an admin deletes your story, you can select “Ask Why” to find out the reason.',
  sw: 'Kila hadithi hukaguliwa na AI na kupewa alama ya KIJANI, NJANO au NYEKUNDU. Hadithi NYEKUNDU huzuiwa na kukaguliwa na wasimamizi. Wasimamizi wanaweza pia kufuta hadithi na kufunga au kuficha maoni. Msimamizi akifuta hadithi yako, unaweza kuchagua “Uliza Sababu” ili kujua ni kwa nini.',
};
export const EMERGENCY_NUMBERS = ['999', '112'];

type Text = { en: string; sw?: string; luo?: string };
const M: Record<string, Text> = {
  sign_in_failed: { en: 'Sign-in was cancelled or could not be completed. Please try again.', sw: 'Kuingia kumeghairiwa au hakukukamilika. Tafadhali jaribu tena.' },
  sign_in_required: { en: 'Sign in to react, comment, save favourites or share your own story.', sw: 'Ingia ili kuitikia, kutoa maoni, kuhifadhi vipendwa au kushiriki hadithi yako.' },
  session_expired: { en: 'Your session has expired. Please sign in again.', sw: 'Kipindi chako kimeisha. Tafadhali ingia tena.' },
  forbidden: { en: 'You do not have permission to do this.', sw: 'Huna ruhusa ya kufanya hivi.' },
  profile_incomplete: { en: 'Finish setting up your profile first.', sw: 'Maliza kwanza kuandaa wasifu wako.' },
  not_found: { en: 'We could not find that.', sw: 'Hatukuweza kupata hicho.' },
  username_available: { en: 'Username available', sw: 'Jina la mtumiaji linapatikana' },
  username_taken: { en: 'This username is taken. Try another.', sw: 'Jina hili la mtumiaji limechukuliwa. Jaribu jingine.' },
  username_reserved: { en: 'This name is reserved and cannot be used.', sw: 'Jina hili limehifadhiwa na haliwezi kutumika.' },
  username_invalid: { en: 'Use 3 to 30 letters, numbers or underscores.', sw: 'Tumia herufi, nambari au mistari chini 3 hadi 30.' },
  profile_saved: { en: 'Profile saved.', sw: 'Wasifu umehifadhiwa.' },
  terms_required: { en: 'Accept the rules, privacy policy and terms, and confirm your age, to continue.', sw: 'Kubali kanuni, sera ya faragha na masharti, na uthibitishe umri wako ili kuendelea.' },
  account_suspended: { en: 'Your account is suspended until {date}.', sw: 'Akaunti yako imesimamishwa hadi {date}.' },
  account_deleted_restore: { en: 'Your account is scheduled for permanent deletion on {date}. Do you want to restore it?', sw: 'Akaunti yako imepangwa kufutwa kabisa tarehe {date}. Je, ungependa kuirejesha?' },
  account_restored: { en: 'Welcome back! Your account has been restored.', sw: 'Karibu tena! Akaunti yako imerejeshwa.' },
  account_removed: { en: 'This account has been removed.', sw: 'Akaunti hii imeondolewa.' },
  admin_registration_sent: { en: 'Registration sent. A Super Admin will review it, and you will be notified by email.', sw: 'Usajili umetumwa. Msimamizi Mkuu ataukagua, na utaarifiwa kwa barua pepe.' },
  admin_awaiting_approval: { en: 'Your registration is awaiting Super Admin approval.', sw: 'Usajili wako unasubiri idhini ya Msimamizi Mkuu.' },
  admin_wrong_login: { en: 'Incorrect email or password.', sw: 'Barua pepe au nenosiri si sahihi.' },
  mfa_wrong: { en: 'That code is incorrect or has expired. Try again.', sw: 'Msimbo huo si sahihi au umeisha muda. Jaribu tena.' },
  too_many_attempts: { en: 'Too many attempts. Sign-in is locked for {minutes} minutes, and the account owner has been alerted.', sw: 'Majaribio ni mengi mno. Kuingia kumefungwa kwa dakika {minutes}, na mwenye akaunti amearifiwa.' },
  password_changed: { en: 'Password changed.', sw: 'Nenosiri limebadilishwa.' },
  password_weak: { en: 'Use 8 to 128 characters, with at least one letter and one number.', sw: 'Tumia herufi 8 hadi 128, zikiwa na angalau herufi moja na nambari moja.' },
  password_breached: { en: 'This password has appeared in a known data breach. Choose a different one.', sw: 'Nenosiri hili limeonekana katika uvujaji wa data unaojulikana. Chagua jingine.' },
  authenticator_added: { en: 'Authenticator app added.', sw: 'Programu ya uthibitishaji imeongezwa.' },
  favourite_added: { en: 'Added to Favorites.', sw: 'Imeongezwa kwenye Vipendwa.' },
  favourite_removed: { en: 'Removed from Favorites.', sw: 'Imeondolewa kwenye Vipendwa.' },
  report_sent: { en: 'Report sent. You will receive a confirmation in INBOX.', sw: 'Ripoti imetumwa. Utapokea uthibitisho katika KIKASHA.' },
  report_empty: { en: 'Pick at least one reason or describe the issue.', sw: 'Chagua angalau sababu moja au eleza tatizo.' },
  comments_locked: { en: 'Comments and replies have been locked by an admin.', sw: 'Maoni na majibu yamefungwa na msimamizi.' },
  comments_hidden: { en: 'Comments have been hidden by an admin.', sw: 'Maoni yamefichwa na msimamizi.' },
  comment_held: { en: 'Your comment was not posted because it may break the rules. An admin will review it.', sw: 'Maoni yako hayakuchapishwa kwa sababu huenda yanakiuka kanuni. Msimamizi atayakagua.' },
  message_held: { en: 'Your message was not sent because it may break the rules. An admin will review it.', sw: 'Ujumbe wako haukutumwa kwa sababu huenda unakiuka kanuni. Msimamizi ataukagua.' },
  sensitive_notice: { en: 'This story describes loss of life and may be distressing.', sw: 'Hadithi hii inaeleza kupoteza maisha na inaweza kuhuzunisha.' },
  story_removed: { en: 'Your story {code} was removed by an admin.', sw: 'Hadithi yako {code} imeondolewa na msimamizi.' },
  ask_why_sent: { en: 'Your request has been sent to the admins. You will receive a reply in INBOX.', sw: 'Ombi lako limetumwa kwa wasimamizi. Utapokea jibu katika KIKASHA.' },
  draft_saved: { en: 'Draft saved.', sw: 'Rasimu imehifadhiwa.' },
  limit_images: { en: 'You can add up to 20 images.', sw: 'Unaweza kuongeza hadi picha 20.' },
  limit_files: { en: 'You can add 1 video, 1 audio file and up to 4 documents.', sw: 'Unaweza kuongeza video 1, faili 1 ya sauti na hadi hati 4.' },
  file_too_large: { en: 'This file is too large. The maximum for {kind} is {max} MB.', sw: 'Faili hili ni kubwa mno. Kiwango cha juu cha {kind} ni MB {max}.' },
  file_unsupported: { en: 'This file type is not supported.', sw: 'Aina hii ya faili haikubaliki.' },
  file_blocked: { en: 'This file was blocked because it may be harmful.', sw: 'Faili hili limezuiwa kwa sababu huenda lina madhara.' },
  story_empty: { en: 'Add text or at least one file before sending.', sw: 'Ongeza maandishi au angalau faili moja kabla ya kutuma.' },
  consent_required: { en: 'Confirm the storyteller’s consent before sending.', sw: 'Thibitisha idhini ya msimulizi kabla ya kutuma.' },
  review_in_progress: { en: 'Checking your story… This takes up to 3 minutes.', sw: 'Tunakagua hadithi yako… Hii huchukua hadi dakika 3.' },
  outcome_green: { en: 'Your story is live!', sw: 'Hadithi yako imechapishwa!' },
  outcome_yellow: { en: 'Your story is live, with a warning.', sw: 'Hadithi yako imechapishwa, pamoja na onyo.' },
  // Encouragement after a Contributor's first story and the first reactions to it (Section 11.5).
  first_story_live: { en: 'Your first story is live! Thank you for adding your memory to the archive.', sw: 'Hadithi yako ya kwanza imechapishwa! Asante kwa kuongeza kumbukumbu yako kwenye hifadhi.' },
  first_story_thanks: { en: 'Thank you for your first story. Every story helps others remember, and stay safe on the water.', sw: 'Asante kwa hadithi yako ya kwanza. Kila hadithi huwasaidia wengine kukumbuka, na kuwa salama majini.' },
  first_reaction: { en: '{name} reacted to your story: the first reaction to it. People are reading what you shared.', sw: '{name} ameonyesha hisia kwa hadithi yako: hiyo ni ya kwanza. Watu wanasoma ulichoshiriki.' },
  story_reaction: { en: '{name} reacted to your story', sw: '{name} ameonyesha hisia kwa hadithi yako' },
  outcome_red: { en: 'Your story was not posted.', sw: 'Hadithi yako haikuchapishwa.' },
  edit_under_review: { en: 'Your changes are being checked. The story will update when the review is complete.', sw: 'Mabadiliko yako yanakaguliwa. Hadithi itasasishwa ukaguzi ukikamilika.' },
  user_blocked: { en: '@{name} is blocked.', sw: '@{name} amezuiwa.' },
  user_muted: { en: '@{name} is muted.', sw: '@{name} amenyamazishwa.' },
  story_deleted: { en: 'Story deleted.', sw: 'Hadithi imefutwa.' },
  reminder_saved: { en: 'Reminder saved.', sw: 'Kikumbusho kimehifadhiwa.' },
  settings_saved: { en: 'Settings saved.', sw: 'Mipangilio imehifadhiwa.' },
  export_preparing: { en: 'We are preparing your data. You will be notified when it is ready.', sw: 'Tunaandaa data yako. Utaarifiwa ikiwa tayari.' },
  export_ready: { en: 'Your data is ready to download.', sw: 'Data yako iko tayari kupakuliwa.' },
  zip_preparing: { en: 'Preparing your download…', sw: 'Tunaandaa upakuaji wako…' },
  zip_ready: { en: 'Your download is ready.', sw: 'Upakuaji wako uko tayari.' },
  download_not_allowed: { en: 'The contributor has not allowed downloads of this story.', sw: 'Mchangiaji hajaruhusu upakuaji wa hadithi hii.' },
  account_deleted: { en: 'Your account has been deleted. Sign in within 30 days if you change your mind.', sw: 'Akaunti yako imefutwa. Ingia ndani ya siku 30 ukibadili nia.' },
  deletion_reason_required: { en: 'Pick a reason for deleting your account.', sw: 'Chagua sababu ya kufuta akaunti yako.' },
  feedback_sent: { en: 'Thank you for your feedback.', sw: 'Asante kwa maoni yako.' },
  general_error: { en: 'Something went wrong. Please try again.', sw: 'Hitilafu imetokea. Tafadhali jaribu tena.' },
  translation_unavailable: { en: 'Translation is not available right now. Please try again later.', sw: 'Tafsiri haipatikani kwa sasa. Tafadhali jaribu tena baadaye.' },
  already_exists: { en: 'That already exists.', sw: 'Hicho tayari kipo.' },
  blocked_interaction: { en: 'You cannot interact with this person.', sw: 'Huwezi kuwasiliana na mtu huyu.' },
  admin_story_deleted: { en: 'Story deleted. The Contributor has been notified.', sw: 'Hadithi imefutwa. Mchangiaji amearifiwa.' },
  admin_comments_locked: { en: 'Comments locked.', sw: 'Maoni yamefungwa.' },
  admin_comments_hidden: { en: 'Comments hidden.', sw: 'Maoni yamefichwa.' },
  reason_required: { en: 'Give a reason. It is shown to the people affected and kept in the audit log.', sw: 'Toa sababu. Huonyeshwa kwa wanaohusika na kuhifadhiwa katika kumbukumbu ya ukaguzi.' },
  override_warning: { en: 'Overrides are irreversible, feed into the AI review guidance and may weaken it. Override only when certain.', sw: 'Ubatilishaji hauwezi kutenduliwa, huingia katika mwongozo wa ukaguzi wa AI na unaweza kuudhoofisha. Batilisha tu ukiwa na uhakika.' },
  override_submitted: { en: 'Override submitted for approval.', sw: 'Ubatilishaji umewasilishwa ili uidhinishwe.' },
  override_approved: { en: 'Override approved. Story {code} is now published.', sw: 'Ubatilishaji umeidhinishwa. Hadithi {code} sasa imechapishwa.' },
  approval_recorded: { en: 'Your decision has been recorded.', sw: 'Uamuzi wako umerekodiwa.' },
  approval_own: { en: 'You proposed this, so you cannot vote on it.', sw: 'Wewe ndiye uliyependekeza hili, kwa hivyo huwezi kulipigia kura.' },
  warning_sent: { en: 'Warning sent to @{name}.', sw: 'Onyo limetumwa kwa @{name}.' },
  account_suspended_admin: { en: 'Account suspended for {days} days. The account holder has been notified.', sw: 'Akaunti imesimamishwa kwa siku {days}. Mwenye akaunti amearifiwa.' },
  deletion_proposed: { en: 'Deletion proposed. It takes effect when the approval rule is met.', sw: 'Ufutaji umependekezwa. Utaanza kutumika kanuni ya idhini ikitimizwa.' },
  report_dismissed: { en: 'Report dismissed. The reporter has been notified.', sw: 'Ripoti imetupiliwa mbali. Aliyeripoti amearifiwa.' },
  story_dropped: { en: 'Story dropped. The Contributor has been notified.', sw: 'Hadithi imeondolewa. Mchangiaji amearifiwa.' },
  submitted_for_approval: { en: 'Submitted for approval.', sw: 'Imewasilishwa ili iidhinishwe.' },
  announcement_published: { en: 'Announcement published.', sw: 'Tangazo limechapishwa.' },
  report_generating: { en: 'Generating report…', sw: 'Ripoti inatayarishwa…' },
  report_ready: { en: 'Your report is ready.', sw: 'Ripoti yako iko tayari.' },
  invitation_sent: { en: 'Invitation sent to {email}.', sw: 'Mwaliko umetumwa kwa {email}.' },
  registration_approved: { en: 'Registration approved. The admin has been notified.', sw: 'Usajili umeidhinishwa. Msimamizi amearifiwa.' },
  admin_removed: { en: '{name} has been removed.', sw: '{name} ameondolewa.' },
  last_super_admin: { en: 'You are the only Super Admin. The system must always have at least one Super Admin. Add another Super Admin first.', sw: 'Wewe ndiye Msimamizi Mkuu pekee. Mfumo lazima uwe na angalau Msimamizi Mkuu mmoja kila wakati. Ongeza Msimamizi Mkuu mwingine kwanza.' },
  super_admin_added: { en: 'Super Admin added.', sw: 'Msimamizi Mkuu ameongezwa.' },
  safety_notice: { en: 'This is not an emergency service. In an emergency, call 999 or 112.', sw: 'Hii si huduma ya dharura. Wakati wa dharura, piga 999 au 112.' },
  safety_sent: { en: 'Thank you. Your safety concern has been sent to the project team.', sw: 'Asante. Hoja yako ya usalama imetumwa kwa timu ya mradi.' },
  safety_empty: { en: 'Describe the concern before sending.', sw: 'Eleza hoja kabla ya kutuma.' },
  safety_acknowledged: { en: 'Concern acknowledged. The sender has been notified.', sw: 'Hoja imepokelewa. Aliyetuma amearifiwa.' },
  human_check_failed: { en: 'We could not confirm you are a person. Please try again.', sw: 'Hatukuweza kuthibitisha kuwa wewe ni mtu. Tafadhali jaribu tena.' },
  import_checked: { en: '{ready} of {total} items are ready. {attention} need attention.', sw: 'Vipengee {ready} kati ya {total} viko tayari. {attention} vinahitaji kuangaliwa.' },
  import_submitted: { en: 'Batch submitted for approval.', sw: 'Kundi limewasilishwa ili liidhinishwe.' },
  incident_saved: { en: 'Incident record saved.', sw: 'Rekodi ya tukio imehifadhiwa.' },
  resource_published: { en: 'Resource published.', sw: 'Nyenzo imechapishwa.' },
  action_done: { en: 'Done – removed from your pending actions.', sw: 'Imekamilika – imeondolewa kwenye mambo yanayosubiri.' },
  app_update_required: { en: 'A new version of the app is available. Please update to continue.', sw: 'Toleo jipya la programu linapatikana. Tafadhali sasisha ili kuendelea.' },
  rate_limited: { en: 'You are doing that too often. Wait a moment and try again.', sw: 'Unafanya hivyo mara nyingi mno. Subiri kidogo kisha ujaribu tena.' },
  invalid_input: { en: 'Some of the details are not valid.', sw: 'Baadhi ya maelezo si sahihi.' },
  video_too_long: { en: 'This video is too long. The maximum is {minutes} minutes.', sw: 'Video hii ni ndefu mno. Kiwango cha juu ni dakika {minutes}.' },
  consent_incomplete: { en: 'A testimony is published only when its consent record is complete and it has been validated with the storyteller.', sw: 'Ushuhuda huchapishwa tu rekodi yake ya idhini ikikamilika na ukiwa umethibitishwa na msimulizi.' },
  not_emergency: { en: 'This is not an emergency service.', sw: 'Hii si huduma ya dharura.' },
};

export function text(code: string, lang = 'en', vars: Record<string, unknown> = {}): string {
  const entry = M[code];
  const raw = entry ? ((entry as Record<string, string>)[lang] ?? entry.en) : code;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
export const hasMessage = (code: string) => code in M;

/** An error with a stable code; the errors filter turns it into a message in the reader's language. */
export class AppError extends HttpException {
  constructor(status: number, readonly code: string, readonly vars: Record<string, unknown> = {}, readonly details?: unknown) {
    super({ code, message: text(code, 'en', vars), details }, status);
  }
}
export const fail = (status: number, code: string, vars: Record<string, unknown> = {}, details?: unknown): never => { throw new AppError(status, code, vars, details); };
/** Date in a notice, e.g. 12 December 2026. */
export const longDate = (d: Date | string, lang = 'en') =>
  new Date(d).toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' });
