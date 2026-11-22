'use client';

import { useState, useEffect, useRef } from 'react';
import { PANEL_THEMES, getSavedTheme, applyPanelTheme } from '@/lib/themeColors';

/**
 * Panel Renk Teması Seçici Bileşeni
 * @param {Object} props
 * @param {'dropdown' | 'grid'} [props.variant='grid'] - 'dropdown' (header için) veya 'grid' (ayarlar sayfası için)
 * @param {Function} [props.onThemeChanged]
 */
export default function ThemeColorPicker({ variant = 'grid', onThemeChanged }) {
  const [currentThemeId, setCurrentThemeId] = useState('amber');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const saved = getSavedTheme();
    setCurrentThemeId(saved);

    const handleThemeChange = (e) => {
      if (e.detail?.id) {
        setCurrentThemeId(e.detail.id);
      }
    };
    window.addEventListener('sandwich_panel_theme_changed', handleThemeChange);
    return () => window.removeEventListener('sandwich_panel_theme_changed', handleThemeChange);
  }, []);

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectTheme = (themeId) => {
    setCurrentThemeId(themeId);
    applyPanelTheme(themeId);
    if (onThemeChanged) onThemeChanged(themeId);
    if (variant === 'dropdown') setIsOpen(false);
  };

  const activeThemeObj = PANEL_THEMES.find((t) => t.id === currentThemeId) || PANEL_THEMES[0];

  // MOBİL AÇILIR MENÜ İÇİ KOMPAKT RENK SEÇİCİ (INLINE)
  if (variant === 'inline') {
    return (
      <div className="space-y-2 font-poppins">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-stone-700 flex items-center gap-1.5">
            <i className="fa-solid fa-palette text-amber-500 text-xs"></i>
            Arayüz Rengi
          </span>
          <span className="text-[10px] font-bold text-stone-500">{activeThemeObj.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PANEL_THEMES.map((theme) => {
            const isSelected = theme.id === currentThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectTheme(theme.id)}
                title={theme.name}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer border-2 ${
                  isSelected
                    ? 'border-stone-900 scale-110 shadow-sm'
                    : 'border-white shadow-xs hover:scale-105'
                }`}
                style={{ backgroundColor: theme.colorHex }}
              >
                {isSelected && <i className="fa-solid fa-check text-[10px] text-white drop-shadow"></i>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // HEADER İÇİN KOMPAKT AÇILIR MENÜ (DROPDOWN)
  if (variant === 'dropdown') {
    return (
      <div className="relative font-poppins" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={`Arayüz Renk Teması: ${activeThemeObj.name}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-100/90 hover:bg-stone-200/90 border border-stone-200/90 transition-all cursor-pointer text-xs font-bold text-stone-700 shadow-2xs active:scale-95"
        >
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white"
            style={{ backgroundColor: activeThemeObj.colorHex }}
          ></span>
          <span className="hidden sm:inline text-[11px] font-extrabold">{activeThemeObj.name}</span>
          <i className="fa-solid fa-palette text-[11px] text-stone-400"></i>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl p-2.5 border border-stone-200 shadow-xl z-50 animate-in fade-in duration-150 space-y-1.5">
            <div className="px-2 py-1 border-b border-stone-100 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-stone-900 flex items-center gap-1.5">
                <i className="fa-solid fa-palette text-amber-500"></i> Arayüz Renk Paleti
              </span>
              <span className="text-[10px] text-stone-400 font-medium">Anında Değişir</span>
            </div>

            <div className="space-y-1">
              {PANEL_THEMES.map((theme) => {
                const isSelected = theme.id === currentThemeId;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-stone-900 text-white shadow-2xs'
                        : 'hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs border-2 border-white"
                        style={{ backgroundColor: theme.colorHex }}
                      ></span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate leading-tight">
                          {theme.name}
                        </span>
                        <span className={`text-[10px] block truncate leading-tight ${isSelected ? 'text-stone-300' : 'text-stone-400'}`}>
                          {theme.desc}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <i className="fa-solid fa-check text-xs text-amber-400 mr-1"></i>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // AYARLAR SAYFASI İÇİN GENİŞ IZGARA KARTLARI (GRID)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {PANEL_THEMES.map((theme) => {
        const isSelected = theme.id === currentThemeId;
        return (
          <div
            key={theme.id}
            onClick={() => handleSelectTheme(theme.id)}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
              isSelected
                ? 'border-stone-900 bg-stone-900 text-white shadow-xs scale-[1.02]'
                : 'border-stone-200/90 hover:border-stone-300 bg-white text-stone-900 hover:shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="w-5 h-5 rounded-full shrink-0 shadow-sm border-2 border-white"
                style={{ backgroundColor: theme.colorHex }}
              ></span>
              {isSelected ? (
                <span className="text-[10px] font-extrabold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  Aktif Tema
                </span>
              ) : (
                <span className="text-[10px] font-bold text-stone-400">Seç</span>
              )}
            </div>

            <div className="space-y-0.5">
              <span className={`text-xs font-extrabold block truncate ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                {theme.name}
              </span>
              <span className={`text-[11px] block truncate leading-tight ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                {theme.desc}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
