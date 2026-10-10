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
