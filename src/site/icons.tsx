/** Line icons used across the site (stroke = currentColor). */
const P: Record<string, React.ReactNode> = {
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /><path d="M4.5 5.5l2 2" /></>,
  book: <><rect x="5" y="3.5" width="12" height="17" rx="1.5" /><path d="M8 8h6M8 11.5h6M8 15h3.5" /><path d="M17 17.5l2.5 2.5" /></>,
  events: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 9.5h16M8.5 3v4M15.5 3v4" /><text x="12" y="17.6" textAnchor="middle" fontSize="6.4" fontFamily="Titillium Web, sans-serif" stroke="none" fill="currentColor">Sex</text></>,
  menus: <><path d="M3.5 12.5h17a8.5 8.5 0 0 1-17 0z" /><path d="M6.5 12.5c.5-4 3-6.5 5.5-6.5s5 2.5 5.5 6.5" /><path d="M9 12.5c.3-2.3 1.4-3.8 3-3.8s2.7 1.5 3 3.8" /><path d="M12 4v2" /></>,
  delivery: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><path d="M9 10.5l3-2.5 3 2.5V13H9z" /></>,
  instagram: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><circle cx="16.8" cy="7.2" r="0.6" fill="currentColor" /></>,
  facebook: <path d="M14 8.5h2.5V5H14c-2.2 0-3.5 1.5-3.5 3.6V11H8v3.3h2.5V21h3.3v-6.7h2.6l.5-3.3h-3.1V9.2c0-.4.3-.7.7-.7z" />,
  twitter: <path d="M20.5 7.2c-.6.3-1.3.5-2 .6.7-.4 1.3-1.1 1.5-1.9-.7.4-1.4.7-2.2.8a3.5 3.5 0 0 0-6 3.2A9.9 9.9 0 0 1 4.6 6.2a3.5 3.5 0 0 0 1.1 4.7c-.6 0-1.1-.2-1.6-.4 0 1.7 1.2 3.2 2.8 3.5-.5.1-1 .2-1.6.1.4 1.4 1.8 2.4 3.3 2.5A7 7 0 0 1 3.5 18a9.9 9.9 0 0 0 15.2-8.8c.7-.5 1.3-1.1 1.8-2z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 9.5h16M8.5 3v4M15.5 3v4" /></>,
  like: <path d="M7.5 20H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h2.5m0 10V10m0 10h9.2a2 2 0 0 0 2-1.6l1.2-6A2 2 0 0 0 17.9 10H14V6.2A2.2 2.2 0 0 0 11.8 4L7.5 10" />,
  fork: <><path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9" /><path d="M16.5 21V3c-2 1.3-3 4-3 7h3" /></>,
  glass: <><path d="M6 4h12l-6 8z" /><path d="M12 12v8M8.5 20h7" /><path d="M14 5.5l3-3" /></>,
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /></>,
}

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icon">
      {P[name]}
    </svg>
  )
}
