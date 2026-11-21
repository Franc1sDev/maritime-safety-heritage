/** One shared icon set (line icons on a 24-unit grid), so the website and apps look the same. */
const P: Record<string, string> = {
  stories: 'M3 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2M3 21c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2M12 3v9M12 4l6 7H6z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  about: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
  inbox: 'M3 6h18v12H3zM3 7l9 7 9-7',
  megaphone: 'M3 10v4h3l8 4V6l-8 4H3zM18 9a4 4 0 0 1 0 6M8 14v5h3',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  signin: 'M15 3h5v18h-5M10 8l4 4-4 4M3 12h11',
  heart: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
  heartbreak: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11zM12 7.2l-2 3.3 3 2-2 3.5',
  laugh: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM7 13a5 5 0 0 0 10 0zM8 9.5l2-1M16 9.5l-2-1',
  comment: 'M4 5h16v11H9l-5 4z',
  share: 'M14 4l6 6-6 6M20 10H10a6 6 0 0 0-6 6v2',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1',
  cite: 'M5 17c2 0 3-1.5 3-4V8H4v5h3M15 17c2 0 3-1.5 3-4V8h-4v5h3',
  download: 'M12 4v11M7 11l5 5 5-5M4 20h16',
  star: 'M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z',
  translate: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
  listen: 'M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  warning: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  pin: 'M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  rules: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  hide: 'M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.3 3.8M6.5 7.6A17 17 0 0 0 2 12s4 6 10 6c1.4 0 2.700-.3 3.8-.8M9.900 9.900a3 3 0 0 0 4.200 4.200',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4',
  close: 'M5 5l14 14M19 5L5 19',
  check: 'M4 12.5l5 5L20 6.500',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  timeline: 'M12 3v18M12 7h6M12 12H6M12 17h6M12 7.010a1 1 0 1 0 0-.020M12 12.010a1 1 0 1 0 0-.020M12 17.010a1 1 0 1 0 0-.020',
  collection: 'M4 6h16v14H4zM7 3h10M8 10h8M8 14h5',
  trending: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  people: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M17 11a3 3 0 1 0-1-5.800M18 14a6 6 0 0 1 4 6',
  incident: 'M12 2l3 6 6 1-4.500 4.300L17.500 20 12 17l-5.500 3 1-6.700L3 9l6-1z',
  video: 'M4 6h12v12H4zM16 10l5-3v10l-5-3z',
  audio: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.500a1 1 0 1 0 0-.020',
  document: 'M6 3h9l4 4v14H6zM14 3v5h5',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1.500L14.500 4h-5L9 6.500 7 8 5 7 3 11l2 1v0l-2 1 2 4 2-1 2 1.500.500 2.500h5l.500-2.500L17 16l2 1 2-4z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
  clip: 'M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.500 3.500 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7',
  send: 'M3 11l18-8-8 18-2-8z',
  book: 'M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z',
  upload: 'M12 20V9M7 13l5-5 5 5M4 4h16',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6zM12 14.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  follow: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M19 8v6M16 11h6',
  block: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM5 5l14 14',
  // preset avatars
  wave: 'M2 9c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 14c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 19c3 0 3-3 6-3s3 3 6 3 3-3 6-3',
  anchor: 'M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 7v14M8 11h8M4 14a8 8 0 0 0 16 0',
  dhow: 'M3 17h18l-3 4H6zM11 16V3l8 11H5',
  lighthouse: 'M9 21l1.500-13h3L15 21zM10 8V5l2-2 2 2v3M6 21h12M4 9l4 1M20 9l-4 1',
  fish: 'M3 12c3-5 9-6 13-2l4-3v10l-4-3c-4 4-10 3-13-2zM8 11.010a1 1 0 1 0 0-.020',
  lifebuoy: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15.500 8.500l-2 5-5 2 2-5z',
  canoe: 'M2 14c4 4 16 4 20 0-4 1-16 1-20 0zM12 3v10M9 6l3-3 3 3',
  shell: 'M12 21C6 21 3 16 3 12a9 9 0 0 1 18 0c0 4-3 9-9 9zM12 21V6M12 21L6 9M12 21l6-12',
  heron: 'M8 21v-6M12 21v-6M6 15c0-4 3-5 6-5 3 0 4-3 4-6l4 2-3 1c0 6-2 8-6 8z',
  turtle: 'M5 13a7 5 0 0 1 14 0zM19 13l3-1-2 3M5 13l-2 3M8 13l-1 4M16 13l1 4',
  sail: 'M4 18h16l-2 3H6zM12 17V3c5 3 7 8 7 13zM11 6c-3 2-5 5-6 10h6',
  anonymous: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0M9 7.500h6',
};
export type IconName = keyof typeof P;
export function Icon({ name, size, filled }: { name: string; size?: number; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={P[name] ?? P.about} />
    </svg>
  );
}
/** The platform mark: a lifebuoy over water, used wherever the project team speaks as "Admin". */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0b5fbf" />
      <circle cx="16" cy="14" r="7" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M5 23c2.200 0 2.200-1.800 4.400-1.800s2.200 1.800 4.400 1.800 2.200-1.800 4.400-1.800 2.200 1.800 4.400 1.800 2.200-1.800 4.400-1.800" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
