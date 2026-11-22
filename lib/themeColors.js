export const PANEL_THEMES = [
  {
    id: 'amber',
    name: 'Kehribar & Sandviç',
    desc: 'Orijinal Sıcak Kehribar',
    colorHex: '#d97706',
    previewBg: 'bg-amber-500',
    activeClass: 'from-amber-500 to-amber-600',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    ringClass: 'ring-amber-500',
  },
  {
    id: 'emerald',
    name: 'Zümrüt Yeşili',
    desc: 'Taze & Doğal Lezzet',
    colorHex: '#059669',
    previewBg: 'bg-emerald-600',
    activeClass: 'from-emerald-500 to-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ringClass: 'ring-emerald-500',
  },
  {
    id: 'indigo',
    name: 'Derin İndigo',
    desc: 'Modern & Şık Görünüm',
    colorHex: '#4f46e5',
    previewBg: 'bg-indigo-600',
    activeClass: 'from-indigo-500 to-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    ringClass: 'ring-indigo-500',
  },
  {
    id: 'rose',
    name: 'Asil Yakut',
    desc: 'Dinamik & Sıcak Kırmızı',
    colorHex: '#e11d48',
    previewBg: 'bg-rose-600',
    activeClass: 'from-rose-500 to-rose-600',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    ringClass: 'ring-rose-500',
  },
  {
    id: 'sky',
    name: 'Okyanus Mavisi',
    desc: 'Ferah & Berrak Gökyüzü',
    colorHex: '#0284c7',
    previewBg: 'bg-sky-600',
    activeClass: 'from-sky-500 to-sky-600',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    ringClass: 'ring-sky-500',
  },
  {
    id: 'purple',
    name: 'Lüks Ametist',
    desc: 'Zarif & Özel Mor',
    colorHex: '#7c3aed',
    previewBg: 'bg-purple-600',
    activeClass: 'from-purple-500 to-purple-600',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    ringClass: 'ring-purple-500',
  },
  {
    id: 'dark',
    name: 'Karbon Titanyum',
    desc: 'Karanlık & Minimalist',
    colorHex: '#18181b',
    previewBg: 'bg-stone-900',
    activeClass: 'from-stone-800 to-stone-900',
    badgeClass: 'bg-stone-100 text-stone-900 border-stone-300',
    ringClass: 'ring-stone-800',
  },
];

export function getSavedTheme() {
  if (typeof window === 'undefined') return 'amber';
  try {
    return localStorage.getItem('sandwich_panel_theme') || 'amber';
  } catch {
    return 'amber';
  }
}

export function applyPanelTheme(themeId) {
  if (typeof window === 'undefined') return;
  const targetTheme = PANEL_THEMES.find((t) => t.id === themeId) || PANEL_THEMES[0];
  try {
    localStorage.setItem('sandwich_panel_theme', targetTheme.id);
    document.documentElement.setAttribute('data-panel-theme', targetTheme.id);
    document.documentElement.style.setProperty('--panel-accent-color', targetTheme.colorHex);

    // Tüm açık bileşenleri bilgilendir
    window.dispatchEvent(
      new CustomEvent('sandwich_panel_theme_changed', { detail: targetTheme })
    );
  } catch (e) {}
}
