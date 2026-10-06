export const ACCESSIBILITY_PRESETS = {
  standard: {
    label: 'Standard',
    phone: { fontScale: 1, lineHeight: 1.72, letterSpacing: 0, wordSpacing: 0, paragraphSpacing: 1, maxWidth: 760, background: 'white', font: 'system', readingGuide: false, strongTerms: true },
    print: { fontScale: 1, lineHeight: 1.58, letterSpacing: 0, wordSpacing: 0, marginScale: 1, background: 'white', font: 'system', strongTerms: true },
  },
  dyslexia: {
    label: 'Dislessia',
    phone: { fontScale: 1.16, lineHeight: 1.92, letterSpacing: 0.02, wordSpacing: 0.08, paragraphSpacing: 1.25, maxWidth: 680, background: 'cream', font: 'sans', readingGuide: true, strongTerms: true },
    print: { fontScale: 1.1, lineHeight: 1.78, letterSpacing: 0.015, wordSpacing: 0.06, marginScale: 1.08, background: 'cream', font: 'sans', strongTerms: true },
  },
  readable: {
    label: 'Alta leggibilità',
    phone: { fontScale: 1.24, lineHeight: 1.95, letterSpacing: 0.015, wordSpacing: 0.05, paragraphSpacing: 1.3, maxWidth: 640, background: 'white', font: 'sans', readingGuide: false, strongTerms: true },
    print: { fontScale: 1.16, lineHeight: 1.82, letterSpacing: 0.01, wordSpacing: 0.04, marginScale: 1.12, background: 'white', font: 'sans', strongTerms: true },
  },
};

export const DEFAULT_ACCESSIBILITY = {
  enabled: false,
  quickPreset: 'dyslexia',
  advancedEnabled: false,
  phone: { ...ACCESSIBILITY_PRESETS.standard.phone },
  print: { ...ACCESSIBILITY_PRESETS.standard.print },
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_ACCESSIBILITY));
}

function storageKey(profileId) {
  return `studybook:accessibility:${profileId || 'default'}`;
}

export function loadAccessibility(profileId = 'default') {
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw);
    return {
      ...cloneDefaults(),
      ...parsed,
      phone: { ...DEFAULT_ACCESSIBILITY.phone, ...(parsed.phone || {}) },
      print: { ...DEFAULT_ACCESSIBILITY.print, ...(parsed.print || {}) },
    };
  } catch {
    return cloneDefaults();
  }
}

export function saveAccessibility(profileId, settings) {
  const normalized = {
    ...DEFAULT_ACCESSIBILITY,
    ...settings,
    phone: { ...DEFAULT_ACCESSIBILITY.phone, ...(settings?.phone || {}) },
    print: { ...DEFAULT_ACCESSIBILITY.print, ...(settings?.print || {}) },
  };
  try { localStorage.setItem(storageKey(profileId), JSON.stringify(normalized)); } catch { /* noop */ }
  return normalized;
}

export function applyQuickPreset(settings, presetId = 'dyslexia') {
  const preset = ACCESSIBILITY_PRESETS[presetId] || ACCESSIBILITY_PRESETS.dyslexia;
  return {
    ...settings,
    enabled: true,
    quickPreset: presetId,
    phone: { ...preset.phone, ...(settings?.advancedEnabled ? settings.phone : {}) },
    print: { ...preset.print, ...(settings?.advancedEnabled ? settings.print : {}) },
  };
}

export function readerCssVariables(settings) {
  const phone = settings?.enabled ? settings.phone : ACCESSIBILITY_PRESETS.standard.phone;
  const backgrounds = { white: '#ffffff', cream: '#fffdf2', blue: '#f4f8ff', gray: '#f5f5f7' };
  return {
    '--reader-font-scale': String(phone.fontScale || 1),
    '--reader-line-height': String(phone.lineHeight || 1.72),
    '--reader-letter-spacing': `${Number(phone.letterSpacing || 0)}em`,
    '--reader-word-spacing': `${Number(phone.wordSpacing || 0)}em`,
    '--reader-paragraph-spacing': `${Number(phone.paragraphSpacing || 1)}rem`,
    '--reader-max-width': `${Number(phone.maxWidth || 760)}px`,
    '--reader-background': backgrounds[phone.background] || backgrounds.white,
  };
}
