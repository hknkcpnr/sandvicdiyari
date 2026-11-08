'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import { DEFAULT_SITE_CONTENT } from '@/lib/siteContentDefaults';

// Hızlı Hazır Manşet Görselleri
const HERO_IMAGE_PRESETS = [
  { label: 'Sandviç Banner (Önerilen)', url: '/images/hero_sandwich_banner.jpg', tag: 'Önerilen' },
  { label: 'Gurme Sandviç Menü', url: '/images/hero_banner.jpg', tag: 'Popüler' },
  { label: 'Özel Çekim Lezzet', url: '/images/sandwich_model.jpg', tag: 'Yeni' },
  { label: 'Kasap Köfte Ekmek', url: '/images/kasap_kofte_ekmek.jpg', tag: 'Klasik' },
  { label: 'Ayvalık Tostu', url: '/images/ayvalik_tostu.jpg', tag: 'Çıtır' },
  { label: 'Gurme Cheeseburger', url: '/images/cheeseburger.jpg', tag: 'Burger' },
];

const FEATURE_ICON_OPTIONS = [
  { value: 'fa-solid fa-seedling', label: '🌱 Taze / Günlük Malzeme' },
  { value: 'fa-solid fa-motorcycle', label: '🏍️ Hızlı & Sıcak Kurye' },
  { value: 'fa-solid fa-shield-heart', label: '🛡️ Hijyen & Gıda Güvenliği' },
  { value: 'fa-solid fa-fire', label: '🔥 Odun Ateşi / Izgara' },
  { value: 'fa-solid fa-award', label: '🏆 Ödüllü Lezzet / Kalite' },
  { value: 'fa-solid fa-clock', label: '⏰ Gece Servisi / Hızlı Teslimat' },
  { value: 'fa-solid fa-thumbs-up', label: '👍 Müşteri Memnuniyeti' },
  { value: 'fa-solid fa-burger', label: '🍔 Zengin Menü Seçeneği' },
];

const SECTION_METAS = {
  hero: {
    id: 'hero',
    title: 'Manşet & Hero (Ana Giriş)',
    icon: 'fa-solid fa-panorama',
    desc: 'Sitenin en üstündeki karşılama görseli, ana sloganlar ve sipariş / arama butonları.',
    getVisibility: (c) => c.hero?.visible !== false,
    setVisibility: (c, v) => ({ ...c, hero: { ...c.hero, visible: v } }),
  },
  campaigns: {
    id: 'campaigns',
    title: 'Günün Kampanyaları Vitrini',
    icon: 'fa-solid fa-fire',
    desc: 'İndirimli ve avantajlı menülerin listelendiği kampanya bölümü.',
    getVisibility: (c) => c.campaignsSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, campaignsSection: { ...c.campaignsSection, visible: v } }),
  },
  newMenus: {
    id: 'newMenus',
    title: 'En Yeni Menüler Vitrini',
    icon: 'fa-solid fa-burger',
    desc: 'En son çıkan lezzetlerin ve sandviçlerin vitrin listesi.',
    getVisibility: (c) => c.newMenusSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, newMenusSection: { ...c.newMenusSection, visible: v } }),
  },
  features: {
    id: 'features',
    title: 'Neden Sandwich Diyarı?',
    icon: 'fa-solid fa-shield-heart',
    desc: 'Hijyen, hızlı kurye ve taze malzeme gibi kalite özellikleriniz.',
    getVisibility: (c) => c.featuresSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, featuresSection: { ...c.featuresSection, visible: v } }),
  },
  reviews: {
    id: 'reviews',
    title: 'Müşteri Yorumları & Puan',
    icon: 'fa-regular fa-star',
    desc: 'Müşterilerinizin paylaştığı gerçek değerlendirme vitrini.',
    getVisibility: (c) => c.reviewsSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, reviewsSection: { ...c.reviewsSection, visible: v } }),
  },
  contact: {
    id: 'contact',
    title: 'İletişim, Şube Adresi & Saatler',
    icon: 'fa-solid fa-phone',
    desc: 'Alt bilgi alanındaki şube açık adresi, telefon ve çalışma saatleri.',
    getVisibility: (c) => c.contactBar?.visible !== false,
    setVisibility: (c, v) => ({ ...c, contactBar: { ...c.contactBar, visible: v } }),
  },
};

export default function SiteContentEditorTab({ initialSubTab = 'hero', onSubTabChange }) {
  const dispatch = useDispatch();
  const [content, setContent] = useState(DEFAULT_SITE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);
  const [uploadingTarget, setUploadingTarget] = useState(null);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSubTabChange = (tabId) => {
    setActiveSubTab(tabId);
    if (onSubTabChange) onSubTabChange(tabId);
  };

  const heroFileInputRef = useRef(null);
  const featuresFileInputRef = useRef(null);

  // Veriyi API'den çek
  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site-content');
      const json = await res.json();
      if (json.success && json.data) {
        setContent(json.data);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Site içeriği yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const updateField = (updater) => {
    setContent(updater);
    setHasUnsavedChanges(true);
  };

  // Değişiklikleri Kaydet
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      const json = await res.json();
      if (json.success) {
        setContent(json.data);
        setHasUnsavedChanges(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem('sandwich_site_content_updated', String(Date.now()));
        }
        dispatch(
          showMessageModal({
            title: 'Vitrin Başarıyla Güncellendi! ✨',
            text: 'Müşteri ana sayfası tasarım ve içerik değişiklikleri anında yayına alındı.',
            type: 'success',
          })
        );
      } else {
        alert(json.error || 'Kaydedilemedi.');
      }
    } catch (err) {
      alert('Sunucu bağlantı hatası oluştu.');
    } finally {
      setSaving(false);
    }
  };

  // Varsayılana Sıfırla
  const handleResetToDefaults = () => {
    if (confirm('Tüm müşteri sayfası metinleri ve görselleri varsayılan fabrika tasarımına döndürülsün mü?')) {
      setContent(DEFAULT_SITE_CONTENT);
      setHasUnsavedChanges(true);
    }
  };

  // Bilgisayardan Görsel Yükle (API /api/upload)
  const handleFileUpload = async (e, targetField) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingTarget(targetField);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        if (targetField === 'heroImage') {
          updateField((prev) => ({
            ...prev,
            hero: { ...prev.hero, image: json.data.url },
          }));
        } else if (targetField === 'featuresBgImage') {
          updateField((prev) => ({
            ...prev,
            featuresSection: { ...prev.featuresSection, bgImage: json.data.url },
          }));
        }
        dispatch(
          showMessageModal({
            title: 'Görsel Yüklendi! 📸',
            text: 'Yeni fotoğraf başarıyla sisteme aktarıldı.',
            type: 'success',
          })
        );
      } else {
        alert(json.error || 'Görsel yüklenemedi.');
      }
    } catch (err) {
      alert('Görsel yükleme hatası: ' + err.message);
    } finally {
      setUploadingTarget(null);
      e.target.value = '';
    }
  };

  // Neden Sandwich Diyarı Özellik Kartı Güncelleme
  const updateFeatureItem = (index, key, val) => {
    updateField((prev) => {
      const items = [...(prev.featuresSection?.items || [])];
      items[index] = { ...items[index], [key]: val };
      return {
        ...prev,
        featuresSection: { ...prev.featuresSection, items },
      };
    });
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-stone-500 font-medium bg-white rounded-3xl border border-stone-200/80 shadow-xs">
        <i className="fa-solid fa-arrows-rotate fa-spin text-3xl text-brand-600 mb-3 block"></i>
        <span>Müşteri sayfası tasarım ve vitrin verileri yükleniyor...</span>
      </div>
    );
  }

  const currentMeta = SECTION_METAS[activeSubTab] || SECTION_METAS.hero;
  const isCurrentVisible = currentMeta.getVisibility(content);
  const hero = content.hero || DEFAULT_SITE_CONTENT.hero;

  const toggleCurrentVisibility = () => {
    updateField((prev) => currentMeta.setVisibility(prev, !isCurrentVisible));
  };

  return (
    <div className="space-y-4 w-full min-w-0 font-poppins animate-in fade-in duration-150">
      {/* 1. SADE VE ANLAŞILIR TEK KONTROL BARI */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Sol Taraf: Bölüm Seçici ve Görünürlük Düğmesi */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-sm font-bold shadow-2xs">
              <i className={currentMeta.icon}></i>
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">
                Düzenlenen Bölüm
              </span>
              <span className="text-xs font-bold text-stone-900 block truncate">
                {currentMeta.title}
              </span>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <select
              value={activeSubTab}
              onChange={(e) => handleSubTabChange(e.target.value)}
              className="app-select w-full bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 text-stone-900 text-xs font-bold rounded-2xl px-4 py-2.5 cursor-pointer focus:outline-none focus:ring-3 focus:ring-brand-500/15 transition-all shadow-xs"
            >
              <option value="hero">🌟 Manşet &amp; Hero (Ana Karşılama)</option>
              <option value="campaigns">🔥 Günün Kampanyaları Vitrini</option>
              <option value="newMenus">🍔 En Yeni Menüler Vitrini</option>
              <option value="features">🛡️ Neden Sandwich Diyarı?</option>
              <option value="reviews">⭐ Müşteri Yorumları Vitrini</option>
              <option value="contact">📞 İletişim, Şube Adresi &amp; Saatler</option>
            </select>
          </div>

          {/* Tek Tıkla Bölüm Görünürlük Switch Butonu */}
          <button
            type="button"
            onClick={toggleCurrentVisibility}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
              isCurrentVisible
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200'
            }`}
            title="Bölümü sitede aç veya gizle"
          >
            <span className={`w-2 h-2 rounded-full ${isCurrentVisible ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`}></span>
            <span>{isCurrentVisible ? 'Bölüm Açık (Sitede Yayında)' : 'Bölüm Kapalı (Gizli)'}</span>
          </button>
        </div>

        {/* Sağ Taraf: Eylem Butonları */}
        <div className="flex items-center gap-2 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
          <button
            type="button"
            onClick={() => window.open('/', '_blank')}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Müşteri Arayüzünü Yeni Sekmede Aç"
          >
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            <span>Siteyi Aç</span>
          </button>

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-stone-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Varsayılan Fabrika Ayarlarına Dön"
          >
            <i className="fa-solid fa-rotate-left mr-1"></i>
            <span>Sıfırla</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="bg-stone-900 hover:bg-black disabled:opacity-50 text-white font-extrabold px-4 sm:px-5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check text-emerald-400'}`}></i>
            <span>{saving ? 'Kaydediliyor...' : hasUnsavedChanges ? 'Değişiklikleri Kaydet' : 'Kaydet'}</span>
          </button>
        </div>
      </div>

      {/* Bölüm Kapalı İse Bilgilendirme Kutusu */}
      {!isCurrentVisible && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-eye-slash text-amber-600 text-base"></i>
            <span>
              <strong>{currentMeta.title}</strong> şu anda müşteri ana sayfasında gizlenmiştir. Ziyaretçiler bu bölümü görmeyecektir.
            </span>
          </div>
          <button
            type="button"
            onClick={toggleCurrentVisibility}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shrink-0 cursor-pointer transition-colors"
          >
            Bölümü Yayına Al
          </button>
        </div>
      )}

      {/* 2. SEÇİLİ BÖLÜM FORMU */}

      {/* ========================================================================= */}
      {/* 1. HERO BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeSubTab === 'hero' && (
        <div className="space-y-4">
          {/* Kart A: Başlıklar ve Sloganlar */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
              <i className="fa-solid fa-heading text-brand-600"></i>
              <span>Ana Başlıklar ve Slogan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Birinci Başlık (Beyaz Metin)
                </label>
                <input
                  type="text"
                  value={hero.titlePrimary || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, titlePrimary: e.target.value },
                    }))
                  }
                  placeholder="Örnek: Acıktın mı?"
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold text-stone-900 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  İkinci Başlık (Renkli &amp; Vurgulu Metin)
                </label>
                <input
                  type="text"
                  value={hero.titleSecondary || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, titleSecondary: e.target.value },
                    }))
                  }
                  placeholder="Örnek: Sandviç Diyarı Torbalı'da!"
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold text-brand-600 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Açıklama Cümlesi
                </label>
                <textarea
                  rows={2}
                  value={hero.description || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description: e.target.value },
                    }))
                  }
                  placeholder="Özel ekmeklerle hazırlanan sandviçlerimizle lezzet kapınızda..."
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl p-3 text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Üst Küçük Rozet Metni
                </label>
                <input
                  type="text"
                  value={hero.badgeText || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, badgeText: e.target.value },
                    }))
                  }
                  placeholder="Örnek: Gece 03:00'e Kadar Paket Servis!"
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Google Puanı ve Yorum Sayısı
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={hero.googleRatingScore || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, googleRatingScore: e.target.value },
                      }))
                    }
                    placeholder="4.9 / 5.0"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 font-bold text-amber-700"
                  />
                  <input
                    type="text"
                    value={hero.googleRatingCount || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, googleRatingCount: e.target.value },
                      }))
                    }
                    placeholder="(2,400+ Yorum)"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Kart B: Arka Plan Fotoğrafı */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
              <i className="fa-solid fa-image text-brand-600"></i>
              <span>Manşet Arka Plan Fotoğrafı</span>
            </h3>

            {/* Seçili Fotoğraf ve Yükleme Butonu */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <div className="w-full sm:w-44 h-24 rounded-xl overflow-hidden bg-stone-900 border border-stone-300 shrink-0 relative">
                <img
                  src={hero.image || '/images/hero_sandwich_banner.jpg'}
                  alt="Aktif Görsel"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                  Aktif
                </span>
              </div>

              <div className="flex-1 w-full space-y-2">
                <input
                  type="text"
                  value={hero.image || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, image: e.target.value },
                    }))
                  }
                  placeholder="Görsel dosya yolu (/images/...) veya bağlantı (https://...)"
                  className="w-full text-xs bg-white border border-stone-300 rounded-xl px-3 py-2 font-mono text-stone-900"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => heroFileInputRef.current?.click()}
                    disabled={uploadingTarget === 'heroImage'}
                    className="bg-stone-900 hover:bg-black text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <i className={`fa-solid ${uploadingTarget === 'heroImage' ? 'fa-spinner fa-spin' : 'fa-arrow-up-from-bracket'}`}></i>
                    <span>{uploadingTarget === 'heroImage' ? 'Yükleniyor...' : 'Bilgisayardan Yeni Fotoğraf Yükle'}</span>
                  </button>
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'heroImage')}
                  />
                </div>
              </div>
            </div>

            {/* Hazır Fotoğraf Seçenekleri */}
            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2">
                Veya Hazır Gurme Fotoğraflardan Seçin:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {HERO_IMAGE_PRESETS.map((p) => {
                  const isCur = hero.image === p.url;
                  return (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() =>
                        updateField((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, image: p.url },
                        }))
                      }
                      className={`text-left rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isCur ? 'border-brand-600 ring-2 ring-brand-500/20' : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="h-14 w-full bg-stone-100 overflow-hidden">
                        <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-1 bg-white text-center">
                        <span className="text-[10px] font-bold text-stone-800 block truncate">{p.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Kart C: Hızlı Butonlar */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
              <i className="fa-solid fa-arrow-pointer text-brand-600"></i>
              <span>Manşet Üstü Aksiyon Butonları</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">Menüye Git Butonu (Birincil)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-stone-700">
                    <input
                      type="checkbox"
                      checked={hero.btnMenuVisible !== false}
                      onChange={(e) =>
                        updateField((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, btnMenuVisible: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span>Aktif</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={hero.btnMenuText || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, btnMenuText: e.target.value },
                    }))
                  }
                  placeholder="Menüyü Keşfet"
                  className="w-full text-xs bg-white border border-stone-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">Telefon / Sipariş Butonu (İkincil)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-stone-700">
                    <input
                      type="checkbox"
                      checked={hero.btnPhoneVisible !== false}
                      onChange={(e) =>
                        updateField((prev) => ({
                          ...prev,
                          hero: { ...prev.hero, btnPhoneVisible: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span>Aktif</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={hero.btnPhoneText || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, btnPhoneText: e.target.value },
                    }))
                  }
                  placeholder="0552 104 55 35"
                  className="w-full text-xs bg-white border border-stone-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GÜNÜN KAMPANYALARI BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeSubTab === 'campaigns' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
            <i className="fa-solid fa-fire text-rose-500"></i>
            <span>Günün Kampanyaları Vitrini Metinleri</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Küçük Üst Rozet Metni</label>
              <input
                type="text"
                value={content.campaignsSection?.badgeText || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    campaignsSection: { ...prev.campaignsSection, badgeText: e.target.value },
                  }))
                }
                placeholder="Örnek: Özel Fırsat Kataloğu"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Ana Bölüm Başlığı</label>
              <input
                type="text"
                value={content.campaignsSection?.title || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    campaignsSection: { ...prev.campaignsSection, title: e.target.value },
                  }))
                }
                placeholder="Örnek: Günün Kampanyalı Ürünleri"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold"
              />
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800">&quot;Tümünü Gör&quot; Yönlendirme Butonu</span>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={content.campaignsSection?.btnAllText || 'Tümünü Gör'}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    campaignsSection: { ...prev.campaignsSection, btnAllText: e.target.value },
                  }))
                }
                className="text-xs bg-white border border-stone-300 rounded-xl px-3 py-1.5 font-medium w-36"
              />
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={content.campaignsSection?.btnAllVisible !== false}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      campaignsSection: { ...prev.campaignsSection, btnAllVisible: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span>Aktif</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. EN YENİ MENÜLER BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeSubTab === 'newMenus' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
            <i className="fa-solid fa-burger text-amber-500"></i>
            <span>En İyi Menüler Vitrini Ayarları</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Küçük Üst Rozet Metni</label>
              <input
                type="text"
                value={content.newMenusSection?.badgeText || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    newMenusSection: { ...prev.newMenusSection, badgeText: e.target.value },
                  }))
                }
                placeholder="Avantajlı Paketler"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Ana Bölüm Başlığı</label>
              <input
                type="text"
                value={content.newMenusSection?.title || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    newMenusSection: { ...prev.newMenusSection, title: e.target.value },
                  }))
                }
                placeholder="En İyi Menülerimiz"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Gösterilecek Ürün Adedi</label>
              <select
                value={content.newMenusSection?.itemCount || 3}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    newMenusSection: { ...prev.newMenusSection, itemCount: Number(e.target.value) },
                  }))
                }
                className="app-select w-full text-xs bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 rounded-2xl px-4 py-2.5 font-bold cursor-pointer transition-all shadow-2xs"
              >
                <option value={3}>3 Adet Ürün (Tek Sıra)</option>
                <option value={6}>6 Adet Ürün (İki Sıra)</option>
                <option value={9}>9 Adet Ürün (Üç Sıra)</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800">&quot;Tümünü Gör&quot; Yönlendirme Butonu</span>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={content.newMenusSection?.btnAllText || 'Tümünü Gör'}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    newMenusSection: { ...prev.newMenusSection, btnAllText: e.target.value },
                  }))
                }
                className="text-xs bg-white border border-stone-300 rounded-xl px-3 py-1.5 font-medium w-36"
              />
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={content.newMenusSection?.btnAllVisible !== false}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      newMenusSection: { ...prev.newMenusSection, btnAllVisible: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span>Aktif</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. NEDEN BİZ? BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeSubTab === 'features' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
              <i className="fa-solid fa-shield-heart text-brand-600"></i>
              <span>Bölüm Başlığı ve Arka Plan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Üst Rozet Metni</label>
                <input
                  type="text"
                  value={content.featuresSection?.badgeText || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      featuresSection: { ...prev.featuresSection, badgeText: e.target.value },
                    }))
                  }
                  placeholder="Kalite Garantisi"
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Ana Bölüm Başlığı</label>
                <input
                  type="text"
                  value={content.featuresSection?.title || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      featuresSection: { ...prev.featuresSection, title: e.target.value },
                    }))
                  }
                  placeholder="Neden Sandwich Diyarı?"
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Karanlık Arka Plan Fotoğrafı</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={content.featuresSection?.bgImage || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      featuresSection: { ...prev.featuresSection, bgImage: e.target.value },
                    }))
                  }
                  placeholder="https://... veya /images/..."
                  className="flex-1 text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2 font-mono"
                />
                <button
                  type="button"
                  onClick={() => featuresFileInputRef.current?.click()}
                  disabled={uploadingTarget === 'featuresBgImage'}
                  className="bg-stone-900 hover:bg-black text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <i className={`fa-solid ${uploadingTarget === 'featuresBgImage' ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                  <span>Yükle</span>
                </button>
                <input
                  ref={featuresFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'featuresBgImage')}
                />
              </div>
            </div>
          </div>

          {/* 3 Özellik Kartı */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(content.featuresSection?.items || []).map((feat, idx) => (
              <div key={feat.id || idx} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    Özellik #{idx + 1}
                  </span>
                  <i className={`${feat.icon || 'fa-solid fa-star'} text-brand-600 text-lg`}></i>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">İkon Seçimi</label>
                  <select
                    value={feat.icon || 'fa-solid fa-seedling'}
                    onChange={(e) => updateFeatureItem(idx, 'icon', e.target.value)}
                    className="app-select w-full text-xs bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 rounded-2xl px-3.5 py-2 font-bold cursor-pointer transition-all shadow-2xs"
                  >
                    {FEATURE_ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">Başlık</label>
                  <input
                    type="text"
                    value={feat.title || ''}
                    onChange={(e) => updateFeatureItem(idx, 'title', e.target.value)}
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">Açıklama Metni</label>
                  <textarea
                    rows={2}
                    value={feat.desc || ''}
                    onChange={(e) => updateFeatureItem(idx, 'desc', e.target.value)}
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl p-2.5"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MÜŞTERİ YORUMLARI BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeSubTab === 'reviews' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
            <i className="fa-regular fa-star text-amber-500"></i>
            <span>Müşteri Değerlendirmeleri Vitrin Başlıkları</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Vitrin Ana Başlığı</label>
              <input
                type="text"
                value={content.reviewsSection?.title || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    reviewsSection: { ...prev.reviewsSection, title: e.target.value },
                  }))
                }
                placeholder="Lezzet Severler Ne Diyor?"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Vitrin Alt Açıklama Cümlesi</label>
              <input
                type="text"
                value={content.reviewsSection?.subtitle || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    reviewsSection: { ...prev.reviewsSection, subtitle: e.target.value },
                  }))
                }
                placeholder="Torbalı'da her gün yüzlerce sıcak siparişi lezzet tutkunlarıyla buluşturuyoruz."
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. İLETİŞİM, ŞUBE VE ÇALIŞMA SAATLERİ */}
      {/* ========================================================================= */}
      {activeSubTab === 'contact' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
            <i className="fa-solid fa-phone text-emerald-600"></i>
            <span>İletişim, Şube Adresi &amp; Çalışma Saatleri</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-stone-700 block mb-1">Şube Açık Adresi</label>
              <input
                type="text"
                value={content.contactBar?.address || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    contactBar: { ...prev.contactBar, address: e.target.value },
                  }))
                }
                placeholder="Tepeköy Mah. İsmetpaşa Cad. No:14/A Torbalı / İzmir"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Telefon / Sipariş Hattı (Görünen)</label>
              <input
                type="text"
                value={content.contactBar?.phone || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    contactBar: { ...prev.contactBar, phone: e.target.value },
                  }))
                }
                placeholder="0552 104 55 35"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Paket Servis Çalışma Saatleri</label>
              <input
                type="text"
                value={content.contactBar?.workHours || ''}
                onChange={(e) =>
                  updateField((prev) => ({
                    ...prev,
                    contactBar: { ...prev.contactBar, workHours: e.target.value },
                  }))
                }
                placeholder="Her Gün: 11:00 - 03:00"
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
