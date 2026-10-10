/* LAB06 · Piccole icone SVG monocromatiche condivise, senza emoji dipendenti dal sistema operativo. */
export function StudySoundIcon({ size = 27 }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" focusable="false">
    <path d="M11 5.25 6.3 9H3.5v6h2.8L11 18.75V5.25Z" />
    <path d="M15 9a4.7 4.7 0 0 1 0 6" />
    <path d="M17.7 6.5a8 8 0 0 1 0 11" />
  </svg>;
}
export function StudyBackIcon({ size = 27 }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
    <path d="m14.5 5-7 7 7 7" />
    <path d="M8 12h12" />
  </svg>;
}


/* LAB09 — Una sola famiglia di simboli monocromatici per tutte le tre schermate approvate.
   SVG inline: stabili offline, nessuna libreria, font o risorsa di rete. */
export function StudyIcon({ name, size = 25 }) {
  const props = { 'aria-hidden': 'true', viewBox: '0 0 24 24', width: size, height: size,
    fill: 'none', stroke: 'currentColor', strokeWidth: '1.75',
    strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false' };
  const drawings = {
    scanner: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /><path d="M7 12h10" /></>,
    book: <><path d="M12 20c-2.6-1.9-5.6-2.4-9-1.8V4.7c3.9-.7 6.7.1 9 2 2.3-1.9 5.1-2.7 9-2v14.5c-3.4-.6-6.4-.1-9 1.8Z"/><path d="M12 6.7V20"/></>,
    photo: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="16.5" cy="8.5" r="1.5"/><path d="m3 17 6-6 4 4 2-2 6 5"/></>,
    document: <><path d="M6 2.8h8l4.5 4.5V21H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z"/><path d="M14 3v5h4.5M8 12h7M8 15.7h7M8 19h4"/></>,
    pdf: <><path d="M6 2.8h8l4.5 4.5V21H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z"/><path d="M14 3v5h4.5M8 12h7M8 15h7M8 18h5"/></>,
    graduate: <><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5.1c4 2.9 8 2.9 12 0V11M22 9v6"/></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/></>,
    library: <><path d="M4 3h4v18H4zm6 0h4v18h-4zm6 0h4v18h-4z"/></>,
    flashcards: <><rect x="4" y="7" width="14" height="14" rx="2"/><path d="M8 4h10a3 3 0 0 1 3 3v10M6 11h10"/></>,
    quiz: <><path d="M6 3.5h9l3 3V21H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path d="M15 3.5v3h3M8 11h6M8 15h7M8 18.5h4"/></>,
    map: <><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="m11 7-5 9m7-9 5 9M7.3 18h9.4"/></>,
    oral: <><circle cx="12" cy="7.5" r="3.3"/><path d="M5 21v-2c0-4 3-6.3 7-6.3s7 2.3 7 6.3v2"/></>,
    units: <><rect x="4" y="5" width="12" height="16" rx="1.5"/><path d="M8 5V3h12v15h-4M7 10h6M7 14h6M7 18h4"/></>,
    coverage: <><path d="M12 2a10 10 0 1 0 10 10H12V2Z"/><path d="M15 2.5a9.5 9.5 0 0 1 6.5 6.5H15V2.5Z"/></>,
    compression: <><path d="M4 20v-5m5 5V9m5 11V5m5 15V3"/></>,
  };
  return <svg {...props}>{drawings[name] || drawings.book}</svg>;
}
