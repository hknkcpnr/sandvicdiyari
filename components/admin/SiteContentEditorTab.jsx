'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import { DEFAULT_SITE_CONTENT } from '@/lib/siteContentDefaults';
import {
  getBrowserCache,
  setBrowserCache,
  invalidateBrowserCache,
  isBrowserCacheStale,
  fetchWithBrowserCache,
  CACHE_TTL_LONG
} from '@/lib/browserDataCache';
import { compressImageFile } from '@/lib/clientImageCompress';
import LiveStorefrontPreview from './LiveStorefrontPreview';

// Hazır Önerilen Gurme Manşet Görselleri
const HERO_IMAGE_PRESETS = [
  { label: 'Sandviç Banner (Önerilen)', url: '/images/hero_sandwich_banner.jpg', tag: 'Önerilen' },
  { label: 'Gurme Sandviç Menü', url: '/images/hero_banner.jpg', tag: 'Popüler' },
  { label: 'Özel Çekim Lezzet', url: '/images/sandwich_model.jpg', tag: 'Yeni' },
  { label: 'Kasap Köfte Ekmek', url: '/images/kasap_kofte_ekmek.jpg', tag: 'Klasik' },
  { label: 'Ayvalık Tostu', url: '/images/ayvalik_tostu.jpg', tag: 'Çıtır' },
  { label: 'Gurme Cheeseburger', url: '/images/cheeseburger.jpg', tag: 'Burger' },
];

const FEATURE_ICON_OPTIONS = [
  { value: 'fa-solid fa-bread-slice', label: '🍞 Taze Ekmek / Günlük Malzeme' },
  { value: 'fa-solid fa-fire-burner', label: '🍳 Sıcak Hazırlama / Tava' },
  { value: 'fa-solid fa-motorcycle', label: '🏍️ Hızlı & Sıcak Kurye' },
  { value: 'fa-solid fa-shield-heart', label: '🛡️ Hijyen & Gıda Güvenliği' },
  { value: 'fa-solid fa-seedling', label: '🌱 Taze / Günlük Malzeme' },
  { value: 'fa-solid fa-fire', label: '🔥 Odun Ateşi / Izgara' },
  { value: 'fa-solid fa-award', label: '🏆 Ödüllü Lezzet / Kalite' },
  { value: 'fa-solid fa-clock', label: '⏰ Gece Servisi / Hızlı Teslimat' },
  { value: 'fa-solid fa-thumbs-up', label: '👍 Müşteri Memnuniyeti' },
  { value: 'fa-solid fa-burger', label: '🍔 Zengin Menü Seçeneği' },
];

const SECTIONS = [
  {
    id: 'hero',
    title: 'Giriş Vitrini & Manşet',
    shortTitle: 'Giriş Vitrini',
    icon: 'fa-solid fa-panorama',
    desc: 'Ana karşılama görseli, başlıklar, Google puanı ve sipariş butonları.',
    getVisibility: (c) => c.hero?.visible !== false,
    setVisibility: (c, v) => ({ ...c, hero: { ...c.hero, visible: v } }),
  },
  {
    id: 'campaigns',
    title: 'Günün Kampanyaları',
    shortTitle: 'Kampanyalar',
    icon: 'fa-solid fa-fire',
    desc: 'İndirimli ve avantajlı menülerin listelendiği vitrin alanı.',
    getVisibility: (c) => c.campaignsSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, campaignsSection: { ...c.campaignsSection, visible: v } }),
  },
  {
    id: 'newMenus',
    title: 'En Yeni Menüler',
    shortTitle: 'Yeni Menüler',
    icon: 'fa-solid fa-burger',
    desc: 'En son çıkan lezzetlerin ve sandviç paketlerinin vitrin listesi.',
    getVisibility: (c) => c.newMenusSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, newMenusSection: { ...c.newMenusSection, visible: v } }),
  },
  {
    id: 'features',
    title: 'Neden Sandviç Diyarı?',
    shortTitle: 'Neden Biz?',
    icon: 'fa-solid fa-shield-heart',
    desc: 'Hijyen, hızlı kurye ve taze malzeme kalite kartları.',
    getVisibility: (c) => c.featuresSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, featuresSection: { ...c.featuresSection, visible: v } }),
  },
  {
    id: 'reviews',
    title: 'Müşteri Yorumları',
    shortTitle: 'Yorumlar & Puan',
    icon: 'fa-regular fa-star',
    desc: 'Müşterilerinizin paylaştığı gerçek değerlendirme vitrini.',
    getVisibility: (c) => c.reviewsSection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, reviewsSection: { ...c.reviewsSection, visible: v } }),
  },
  {
    id: 'story',
    title: 'Hikayemiz & Fotoğraf Galerisi',
    shortTitle: 'Hikayemiz & Galeri',
    icon: 'fa-solid fa-images',
    desc: 'Hakkımızda tanıtım yazıları ve fotoğraf galerisi (slider).',
    getVisibility: (c) => c.storySection?.visible !== false,
    setVisibility: (c, v) => ({ ...c, storySection: { ...c.storySection, visible: v } }),
  },
  {
    id: 'contact',
    title: 'İletişim & Şube',
    shortTitle: 'İletişim & Adres',
    icon: 'fa-solid fa-phone',
    desc: 'Şube açık adresi, telefon ve paket servis çalışma saatleri.',
    getVisibility: (c) => c.contactBar?.visible !== false,
    setVisibility: (c, v) => ({ ...c, contactBar: { ...c.contactBar, visible: v } }),
  },
];

export default function SiteContentEditorTab({ initialSubTab = 'hero', onSubTabChange }) {
  const dispatch = useDispatch();
  const initialCached = getBrowserCache('site_content_light') || getBrowserCache('site_content_full');
  const [content, setContent] = useState(initialCached?.data || DEFAULT_SITE_CONTENT);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storyImagesLoaded, setStoryImagesLoaded] = useState(
    Boolean(initialCached?.data && initialCached.data?.storySection?._imagesDeferred !== true)
  );
  const [loadingStoryImages, setLoadingStoryImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);
  const [uploadingTarget, setUploadingTarget] = useState(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [showUrlInput, setShowUrlInput] = useState(false);

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
  const storyFileInputRef = useRef(null);

  // Veriyi API'den hafif modda çek (galeri görselleri sadece Hikayemiz sekmesinde yüklenir)
  const fetchContent = async (force = false, { silent = false } = {}) => {
    const cached = getBrowserCache('site_content_light');
    if (!force && cached?.data && !isBrowserCacheStale('site_content_light', CACHE_TTL_LONG)) {
      setContent((prev) => ({
        ...cached.data,
        storySection:
          prev?.storySection?._imagesDeferred === false && cached.data?.storySection?._imagesDeferred === true
            ? prev.storySection
            : cached.data.storySection
      }));
      setHasUnsavedChanges(false);
      setIsRefreshing(false);
      return;
    }

    if (!silent) {
      setIsRefreshing(true);
    }
    try {
      const res = await fetchWithBrowserCache('site_content_light', '/api/site-content?scope=editorLight', {
        force: force === true,
        maxAgeMs: CACHE_TTL_LONG,
        persist: true,
        extract: (json) => json.data
      });
      if (res.ok && res.data) {
        setContent((prev) => ({
          ...res.data,
          storySection:
            prev?.storySection?._imagesDeferred === false && res.data?.storySection?._imagesDeferred === true
              ? prev.storySection
              : res.data.storySection
        }));
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Site içeriği yüklenemedi:', err);
    } finally {
      if (!silent) {
        setIsRefreshing(false);
      }
    }
  };

  const fetchStoryImages = async (force = false) => {
    setLoadingStoryImages(true);
    try {
      const res = await fetchWithBrowserCache('site_content_story_images', '/api/site-content?section=storyImages', {
        force: force === true,
        maxAgeMs: CACHE_TTL_LONG,
        persist: false,
        extract: (json) => json.data?.images || []
      });
      if (res.ok && Array.isArray(res.data)) {
        setContent((prev) => ({
          ...prev,
          storySection: {
            ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
            images: res.data,
            _imagesDeferred: false,
            _imageCount: res.data.length
          }
        }));
        setStoryImagesLoaded(true);
      }
    } catch (err) {
      console.error('Galeri fotoğrafları yüklenemedi:', err);
    } finally {
      setLoadingStoryImages(false);
    }
  };

  useEffect(() => {
    const cached = getBrowserCache('site_content_light');
    if (cached?.data) {
      setContent(cached.data);
      if (isBrowserCacheStale('site_content_light', CACHE_TTL_LONG)) {
        fetchContent(true, { silent: true });
      }
    } else {
      fetchContent(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'story' && !storyImagesLoaded) {
      fetchStoryImages(false);
    }
  }, [activeSubTab, storyImagesLoaded]);

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
        const savedImages = Array.isArray(json.data?.storySection?.images)
          ? json.data.storySection.images
          : [];
        const lightData = {
          ...json.data,
          storySection: {
            ...(json.data?.storySection || DEFAULT_SITE_CONTENT.storySection),
            images: [],
            _imagesDeferred: true,
            _imageCount: savedImages.length
          }
        };
        setContent(storyImagesLoaded ? json.data : lightData);
        setHasUnsavedChanges(false);
        invalidateBrowserCache('site_content_');
        setBrowserCache('site_content_light', lightData, { persist: true });
        if (storyImagesLoaded) {
          setBrowserCache('site_content_story_images', savedImages, { persist: false });
        }
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
      setStoryImagesLoaded(true);
      setHasUnsavedChanges(true);
    }
  };

  // Bilgisayardan Görsel Yükle (Yükleme öncesi otomatik sıkıştırma + /api/upload)
  const handleFileUpload = async (e, targetField) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingTarget(targetField);
    try {
      const compressedFile = await compressImageFile(file);
      const formData = new FormData();
      formData.append('file', compressedFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      const uploadedUrl = json.url || json.data?.url;
      if (json.success && uploadedUrl) {
        if (targetField === 'heroImage') {
          updateField((prev) => ({
            ...prev,
            hero: { ...prev.hero, image: uploadedUrl },
          }));
        } else if (targetField === 'featuresBgImage') {
          updateField((prev) => ({
            ...prev,
            featuresSection: { ...prev.featuresSection, bgImage: uploadedUrl },
          }));
        } else if (targetField === 'storySlideNew') {
          setStoryImagesLoaded(true);
          updateField((prev) => {
            const currentImages = Array.isArray(prev.storySection?.images)
              ? prev.storySection.images
              : DEFAULT_SITE_CONTENT.storySection.images;
            return {
              ...prev,
              storySection: {
                ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                _imagesDeferred: false,
                images: [
                  ...currentImages,
                  {
                    id: `st_${Date.now()}`,
                    url: uploadedUrl,
                    caption: file.name.replace(/\.[^/.]+$/, '') || 'Sandviç Diyarı Lezzet Durağı',
                  },
                ],
              },
            };
          });
        }
        dispatch(
          showMessageModal({
            title: 'Görsel Yüklendi! 📸',
            text: 'Yeni fotoğraf optimize edilerek sisteme aktarıldı. Kaydet butonuna basarak yayına alabilirsiniz.',
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

  // Neden Sandviç Diyarı Özellik Kartı Güncelleme
  const updateFeatureItem = (index, key, val) => {
    updateField((prev) => {
      const items = [...(prev.featuresSection?.items || DEFAULT_SITE_CONTENT.featuresSection.items)];
      items[index] = { ...items[index], [key]: val };
      return {
        ...prev,
        featuresSection: { ...prev.featuresSection, items },
      };
    });
  };

  const currentMeta = SECTIONS.find((s) => s.id === activeSubTab) || SECTIONS[0];
  const isCurrentVisible = currentMeta.getVisibility(content);
  const hero = content.hero || DEFAULT_SITE_CONTENT.hero;
  const campaigns = content.campaignsSection || DEFAULT_SITE_CONTENT.campaignsSection;
  const newMenus = content.newMenusSection || DEFAULT_SITE_CONTENT.newMenusSection;
  const features = content.featuresSection || DEFAULT_SITE_CONTENT.featuresSection;
  const reviews = content.reviewsSection || DEFAULT_SITE_CONTENT.reviewsSection;
  const story = content.storySection || DEFAULT_SITE_CONTENT.storySection;
  const contact = content.contactBar || DEFAULT_SITE_CONTENT.contactBar;

  const toggleCurrentVisibility = () => {
    updateField((prev) => currentMeta.setVisibility(prev, !isCurrentVisible));
  };

  return (
    <div className="space-y-3 w-full min-w-0 font-poppins animate-in fade-in duration-150">
      {/* 1. ÜST BÖLÜM GEÇİŞ SEKMELERİ (KOMPAKT YATAY PILL MENÜ) */}
      <div className="bg-white p-1.5 rounded-xl border border-stone-200/90 shadow-2xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max">
          {SECTIONS.map((sec) => {
            const isActive = activeSubTab === sec.id;
            const isVisible = sec.getVisibility(content);

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSubTabChange(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                }`}
              >
                <i className={`${sec.icon} ${isActive ? 'text-white' : 'text-stone-400'}`}></i>
                <span>{sec.shortTitle}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isVisible ? 'bg-emerald-400' : 'bg-stone-300'
                  }`}
                  title={isVisible ? 'Sitede Yayında' : 'Sitede Gizli'}
                ></span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. EYLEM & DURUM KONTROL ŞERİDİ */}
      <div className="bg-white p-3 rounded-xl border border-stone-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Sol: Başlık ve Açıklama */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 border border-brand-200/60 flex items-center justify-center text-sm shrink-0">
            <i className={currentMeta.icon}></i>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 truncate">
                {currentMeta.title}
              </h3>
              {isRefreshing && (
                <span className="text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                  <i className="fa-solid fa-arrows-rotate fa-spin text-[9px] text-brand-600"></i>
                  <span>Senkronize ediliyor</span>
                </span>
              )}
              {hasUnsavedChanges && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                  Değişiklik Var
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 truncate">{currentMeta.desc}</p>
          </div>
        </div>

        {/* Sağ: Görünürlük Switch + Önizleme + Kaydet */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
          {/* Bölüm Açık / Kapalı Toggle */}
          <button
            type="button"
            onClick={toggleCurrentVisibility}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              isCurrentVisible
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200'
            }`}
            title="Bölümü ana sayfada göster veya gizle"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isCurrentVisible ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
              }`}
            ></span>
            <span>{isCurrentVisible ? 'Yayında' : 'Gizli'}</span>
          </button>

          {/* Canlı Önizleme Aç/Kapa */}
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
              showLivePreview
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
            title="Canlı Önizleme Panelini Aç veya Kapat"
          >
            <i className="fa-solid fa-eye text-[11px]"></i>
            <span className="hidden sm:inline">Önizleme: {showLivePreview ? 'Açık' : 'Kapalı'}</span>
          </button>

          {/* Siteyi Aç */}
          <button
            type="button"
            onClick={() => window.open('/', '_blank')}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Müşteri Sitesini Yeni Sekmede Gör"
          >
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            <span className="hidden sm:inline">Siteyi Aç</span>
          </button>

          {/* Sıfırla */}
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Varsayılan Fabrika İçeriklerine Sıfırla"
          >
            <i className="fa-solid fa-rotate-left"></i>
          </button>

          {/* Kaydet */}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
            <span>{saving ? 'Kaydediliyor...' : hasUnsavedChanges ? 'Değişiklikleri Kaydet ✨' : 'Kaydet'}</span>
          </button>
        </div>
      </div>

      {/* Bölüm Gizli İse Bilgilendirme Uyarısı */}
      {!isCurrentVisible && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-eye-slash text-amber-600 text-base shrink-0"></i>
            <span>
              <strong>{currentMeta.title}</strong> şu anda müşteri ana sayfasında gizlenmiştir. Ziyaretçiler bu bölümü görmez.
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

      {/* 3. ANA STÜDYO DÜZENİ: SOLDA DÜZENLEME FORMU, SAĞDA ANLIK CANLI ÖNİZLEME */}
      <div className={`grid grid-cols-1 ${showLivePreview ? 'xl:grid-cols-12' : ''} gap-4 items-start`}>
        {/* SOL KOLON: SADE VE DÜZENLİ FORM ALANLARI */}
        <div className={`${showLivePreview ? 'xl:col-span-6' : 'w-full'} space-y-4`}>
          {/* ========================================================================= */}
          {/* 1. HERO BÖLÜMÜ */}
          {/* ========================================================================= */}
          {activeSubTab === 'hero' && (
            <div className="space-y-4">
              {/* Kart 1: Manşet Görseli Seçici */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-image text-brand-600"></i>
                    <span>Manşet Arka Plan Görseli</span>
                  </span>
                  <span className="text-[11px] text-stone-400">1920x1080 yatay görsel önerilir</span>
                </div>

                {/* Aktif Görsel & Yükleme Butonu */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-stone-50/80 p-3 rounded-2xl border border-stone-200/80">
                  <div className="w-full sm:w-48 h-28 rounded-xl overflow-hidden bg-stone-900 border border-stone-300 shrink-0 relative group">
                    <img
                      src={hero.image || '/images/hero_sandwich_banner.jpg'}
                      alt="Aktif Görsel"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-md">
                        Aktif Görsel
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <p className="text-xs font-semibold text-stone-700">
                      Ziyaretçileri karşılayan ana görsel. Kendi çekiminizi yükleyebilir veya aşağıdaki hazır gurme fotoğraflardan seçebilirsiniz.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => heroFileInputRef.current?.click()}
                        disabled={uploadingTarget === 'heroImage'}
                        className="bg-stone-900 hover:bg-black text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                      >
                        <i className={`fa-solid ${uploadingTarget === 'heroImage' ? 'fa-spinner fa-spin' : 'fa-arrow-up-from-bracket'}`}></i>
                        <span>{uploadingTarget === 'heroImage' ? 'Yükleniyor...' : 'Cihazdan Fotoğraf Yükle'}</span>
                      </button>
                      <input
                        ref={heroFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'heroImage')}
                      />

                      <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className="text-stone-600 hover:text-stone-900 bg-white border border-stone-300 hover:border-stone-400 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                      >
                        <i className="fa-solid fa-link text-[10px] mr-1"></i>
                        <span>{showUrlInput ? 'URL Kutusunu Kapat' : 'URL ile Bağla'}</span>
                      </button>
                    </div>

                    {showUrlInput && (
                      <input
                        type="text"
                        value={hero.image || ''}
                        onChange={(e) =>
                          updateField((prev) => ({
                            ...prev,
                            hero: { ...prev.hero, image: e.target.value },
                          }))
                        }
                        placeholder="Örnek: /images/hero_banner.jpg veya https://..."
                        className="w-full text-xs bg-white border border-stone-300 rounded-xl px-3 py-2 font-mono text-stone-900 mt-2"
                      />
                    )}
                  </div>
                </div>

                {/* Tek Tıkla Hazır Gurme Fotoğraflar */}
                <div>
                  <label className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider block mb-2">
                    Veya Hazır Gurme Fotoğraflardan Tek Tıkla Seçin:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                          className={`text-left rounded-xl overflow-hidden border-2 transition-all cursor-pointer relative ${
                            isCur
                              ? 'border-brand-600 ring-2 ring-brand-500/20 shadow-xs'
                              : 'border-stone-200 hover:border-stone-300 bg-white'
                          }`}
                        >
                          <div className="h-14 w-full bg-stone-100 overflow-hidden relative">
                            <img src={p.url} alt={p.label} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            {isCur && (
                              <span className="absolute top-1 right-1 bg-brand-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                                <i className="fa-solid fa-check"></i>
                              </span>
                            )}
                          </div>
                          <div className="p-1.5 bg-white text-center">
                            <span className="text-[11px] font-bold text-stone-800 block truncate">{p.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Kart 2: Başlıklar ve Sloganlar */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-heading text-brand-600"></i>
                    <span>Manşet Başlıkları &amp; Açıklaması</span>
                  </span>
                  <span className="text-[11px] text-stone-400">Giriş yazıları</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      1. Başlık (Beyaz Yazı)
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
                      className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      2. Başlık (Renkli Güçlü Vurgu)
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
                      className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold text-brand-600 focus:outline-none focus:border-stone-900 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Tanıtım Açıklama Cümlesi
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
                      className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl p-3 text-stone-800 focus:outline-none focus:border-stone-900 focus:bg-white resize-none transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
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
                      placeholder="Örnek: Torbalı / İzmir • Gece 03:00'e Kadar Paket Servis!"
                      className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-stone-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Kart 3: Google Puanı & Butonlar */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-star text-amber-500"></i>
                    <span>Google Puan Kartı &amp; Aksiyon Butonları</span>
                  </span>
                  <span className="text-[11px] text-stone-400">Güvenilirlik ve yönlendirme</span>
                </div>

                <div className="space-y-3.5">
                  {/* Google Puanı */}
                  <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                        <i className="fa-brands fa-google"></i>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-stone-800 block">Google Müşteri Puanı</span>
                        <span className="text-[11px] text-stone-400">Manşetin sol üstünde görünen güven rozeti</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                        className="w-24 text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold text-amber-700 text-center"
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
                        className="w-32 text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-stone-600 font-medium text-center"
                      />
                    </div>
                  </div>

                  {/* Buton 1: Menüyü Keşfet */}
                  <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-brand-500 shrink-0"></span>
                      <span className="text-xs font-bold text-stone-800">1. Buton (Menüye Yönlendirir)</span>
                    </div>

                    <div className="flex items-center gap-2">
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
                        className="text-xs bg-white border border-stone-300 rounded-lg px-3 py-1.5 font-bold w-36"
                      />
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
                  </div>

                  {/* Buton 2: Telefon */}
                  <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="text-xs font-bold text-stone-800">2. Buton (Telefonla Arama)</span>
                    </div>

                    <div className="flex items-center gap-2">
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
                        className="text-xs bg-white border border-stone-300 rounded-lg px-3 py-1.5 font-bold w-36"
                      />
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. GÜNÜN KAMPANYALARI BÖLÜMÜ */}
          {/* ========================================================================= */}
          {activeSubTab === 'campaigns' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-fire text-rose-500"></i>
                  <span>Günün Kampanyaları Vitrin Metinleri</span>
                </span>
                <span className="text-[11px] text-stone-400">İndirimli ürünler vitrini</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Küçük Üst Rozet Metni</label>
                  <input
                    type="text"
                    value={campaigns.badgeText || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        campaignsSection: { ...prev.campaignsSection, badgeText: e.target.value },
                      }))
                    }
                    placeholder="Örnek: Özel Fırsat Kataloğu"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Ana Bölüm Başlığı</label>
                  <input
                    type="text"
                    value={campaigns.title || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        campaignsSection: { ...prev.campaignsSection, title: e.target.value },
                      }))
                    }
                    placeholder="Örnek: Günün Kampanyalı Ürünleri"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">&quot;Tümünü Gör&quot; Yönlendirme Butonu</span>
                  <span className="text-[11px] text-stone-400">Ziyaretçiyi Menü sayfasına yönlendirir</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={campaigns.btnAllText || 'Tümünü Gör'}
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
                      checked={campaigns.btnAllVisible !== false}
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
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-burger text-amber-500"></i>
                  <span>En İyi Menüler Vitrini Ayarları</span>
                </span>
                <span className="text-[11px] text-stone-400">Yeni çıkan ve popüler lezzetler</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Küçük Üst Rozet Metni</label>
                  <input
                    type="text"
                    value={newMenus.badgeText || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        newMenusSection: { ...prev.newMenusSection, badgeText: e.target.value },
                      }))
                    }
                    placeholder="Avantajlı Paketler"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Ana Bölüm Başlığı</label>
                  <input
                    type="text"
                    value={newMenus.title || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        newMenusSection: { ...prev.newMenusSection, title: e.target.value },
                      }))
                    }
                    placeholder="En İyi Menülerimiz"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Gösterilecek Ürün Adedi</label>
                  <select
                    value={newMenus.itemCount || 3}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        newMenusSection: { ...prev.newMenusSection, itemCount: Number(e.target.value) },
                      }))
                    }
                    className="w-full text-xs bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer transition-all shadow-2xs"
                  >
                    <option value={3}>3 Adet Ürün (Tek Sıra)</option>
                    <option value={6}>6 Adet Ürün (İki Sıra)</option>
                    <option value={9}>9 Adet Ürün (Üç Sıra)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">&quot;Tümünü Gör&quot; Yönlendirme Butonu</span>
                  <span className="text-[11px] text-stone-400">Ziyaretçiyi Menü sayfasına yönlendirir</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newMenus.btnAllText || 'Tümünü Gör'}
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
                      checked={newMenus.btnAllVisible !== false}
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
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-shield-heart text-brand-600"></i>
                    <span>Bölüm Başlığı ve Arka Plan Görseli</span>
                  </span>
                  <span className="text-[11px] text-stone-400">Kalite ve hijyen güven alanı</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">Üst Rozet Metni</label>
                    <input
                      type="text"
                      value={features.badgeText || ''}
                      onChange={(e) =>
                        updateField((prev) => ({
                          ...prev,
                          featuresSection: { ...prev.featuresSection, badgeText: e.target.value },
                        }))
                      }
                      placeholder="Kalite Garantisi"
                      className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-stone-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">Ana Bölüm Başlığı</label>
                    <input
                      type="text"
                      value={features.title || ''}
                      onChange={(e) =>
                        updateField((prev) => ({
                          ...prev,
                          featuresSection: { ...prev.featuresSection, title: e.target.value },
                        }))
                      }
                      placeholder="Neden Sandviç Diyarı?"
                      className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-stone-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Karanlık Arka Plan Fotoğrafı</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={features.bgImage || ''}
                      onChange={(e) =>
                        updateField((prev) => ({
                          ...prev,
                          featuresSection: { ...prev.featuresSection, bgImage: e.target.value },
                        }))
                      }
                      placeholder="https://... veya /images/..."
                      className="flex-1 text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2 font-mono text-stone-800"
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

              {/* 3 Özellik Kartı Düzenleme */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(features.items || []).map((feat, idx) => (
                  <div key={feat.id || idx} className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                        Özellik #{idx + 1}
                      </span>
                      <i className={`${feat.icon || 'fa-solid fa-star'} text-brand-600 text-base`}></i>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-600 block mb-1">İkon Seçimi</label>
                      <select
                        value={feat.icon || 'fa-solid fa-seedling'}
                        onChange={(e) => updateFeatureItem(idx, 'icon', e.target.value)}
                        className="w-full text-xs bg-stone-50 hover:bg-white border border-stone-300 rounded-xl px-3 py-2 font-bold cursor-pointer transition-all"
                      >
                        {FEATURE_ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-600 block mb-1">Kart Başlığı</label>
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
                        className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl p-2.5 resize-none"
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
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-regular fa-star text-amber-500"></i>
                  <span>Müşteri Yorumları Vitrin Başlıkları</span>
                </span>
                <span className="text-[11px] text-stone-400">Onaylı müşteri yorumları vitrini</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Vitrin Ana Başlığı</label>
                  <input
                    type="text"
                    value={reviews.title || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        reviewsSection: { ...prev.reviewsSection, title: e.target.value },
                      }))
                    }
                    placeholder="Lezzet Severler Ne Diyor?"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Vitrin Alt Açıklama Cümlesi</label>
                  <input
                    type="text"
                    value={reviews.subtitle || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        reviewsSection: { ...prev.reviewsSection, subtitle: e.target.value },
                      }))
                    }
                    placeholder="Torbalı'da her gün yüzlerce sıcak siparişi lezzet tutkunlarıyla buluşturuyoruz."
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Soluk Arka Plan Fotoğrafı (URL)</label>
                <input
                  type="text"
                  value={reviews.bgImage || ''}
                  onChange={(e) =>
                    updateField((prev) => ({
                      ...prev,
                      reviewsSection: { ...prev.reviewsSection, bgImage: e.target.value },
                    }))
                  }
                  placeholder="https://... veya /images/..."
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2 font-mono text-stone-700"
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
                <i className="fa-solid fa-lightbulb text-amber-600 text-sm shrink-0"></i>
                <span>
                  <strong>İpucu:</strong> Müşteri yorumlarını paneldeki <strong>Yorumlar</strong> sekmesinden onaylayabilir veya reddedebilirsiniz. Onaylanan gerçek yorumlar burada otomatik olarak döner.
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. HİKAYEMİZ & GÖRSEL SLIDER YÖNETİMİ */}
          {/* ========================================================================= */}
          {activeSubTab === 'story' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div>
                  <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-images text-brand-600"></i>
                    <span>Hikayemiz Sayfası &amp; Fotoğraf Galerisi Sliderı</span>
                  </span>
                  <span className="text-[11px] text-stone-400">Hakkımızda yazısı ve kayan fotoğraflar</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={storyFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'storySlideNew')}
                  />
                  <button
                    type="button"
                    disabled={uploadingTarget === 'storySlideNew'}
                    onClick={() => storyFileInputRef.current?.click()}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <i
                      className={`fa-solid ${
                        uploadingTarget === 'storySlideNew' ? 'fa-spinner fa-spin' : 'fa-upload'
                      }`}
                    ></i>
                    <span>
                      {uploadingTarget === 'storySlideNew'
                        ? 'Yükleniyor...'
                        : '+ Cihazdan Yeni Fotoğraf'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateField((prev) => {
                        const currentImages = Array.isArray(prev.storySection?.images)
                          ? prev.storySection.images
                          : DEFAULT_SITE_CONTENT.storySection.images;
                        return {
                          ...prev,
                          storySection: {
                            ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                            images: [
                              ...currentImages,
                              {
                                id: `st_${Date.now()}`,
                                url: '/images/hero_sandwich_banner.jpg',
                                caption: 'Yeni Slider Görseli',
                              },
                            ],
                          },
                        };
                      })
                    }
                    className="bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <i className="fa-solid fa-plus text-brand-600"></i>
                    <span>+ URL ile Ekle</span>
                  </button>
                </div>
              </div>

              {/* Hikaye Başlık ve Açıklama Alanları */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Üst Rozet Yazısı</label>
                  <input
                    type="text"
                    value={story.badgeText ?? DEFAULT_SITE_CONTENT.storySection.badgeText}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        storySection: {
                          ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                          badgeText: e.target.value,
                        },
                      }))
                    }
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-semibold focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Hikayemiz Ana Başlığı</label>
                  <input
                    type="text"
                    value={story.title ?? DEFAULT_SITE_CONTENT.storySection.title}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        storySection: {
                          ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                          title: e.target.value,
                        },
                      }))
                    }
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">Hikayemiz Tanıtım Metni</label>
                  <textarea
                    rows={3}
                    value={story.description ?? DEFAULT_SITE_CONTENT.storySection.description}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        storySection: {
                          ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                          description: e.target.value,
                        },
                      }))
                    }
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium resize-none focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Hızlı Hazır Şablonlardan Slider'a Tek Tıkla Ekleme */}
              <div className="bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/80 space-y-2">
                <span className="text-[11px] font-extrabold text-stone-700 uppercase block">
                  Hazır Lezzet Fotoğraflarından Slider&apos;a Hızlı Ekle:
                </span>
                <div className="flex flex-wrap gap-2">
                  {HERO_IMAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() =>
                        updateField((prev) => {
                          const currentImages = Array.isArray(prev.storySection?.images)
                            ? prev.storySection.images
                            : DEFAULT_SITE_CONTENT.storySection.images;
                          return {
                            ...prev,
                            storySection: {
                              ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                              images: [
                                ...currentImages,
                                {
                                  id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                                  url: preset.url,
                                  caption: preset.label,
                                },
                              ],
                            },
                          };
                        })
                      }
                      className="inline-flex items-center gap-2 bg-white hover:bg-brand-50 border border-stone-200 hover:border-brand-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-700 cursor-pointer transition-all"
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        loading="lazy"
                        decoding="async"
                        className="w-6 h-6 rounded-md object-cover border border-stone-200"
                      />
                      <span>+ {preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mevcut Slider Fotoğrafları Listesi */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-stone-800 uppercase">
                    Aktif Slider Fotoğrafları (
                    {loadingStoryImages
                      ? story._imageCount ?? '...'
                      : (story.images || DEFAULT_SITE_CONTENT.storySection.images).length}{' '}
                    Adet)
                  </span>
                  <span className="text-[11px] text-stone-400">
                    Sitede sırayla otomatik kayarak gösterilir
                  </span>
                </div>

                {loadingStoryImages ? (
                  <div className="p-6 text-center bg-stone-50/80 border border-stone-200 rounded-2xl text-xs font-semibold text-stone-500 flex items-center justify-center gap-2">
                    <i className="fa-solid fa-arrows-rotate fa-spin text-brand-600"></i>
                    <span>Galeri fotoğrafları yükleniyor...</span>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(story.images || DEFAULT_SITE_CONTENT.storySection.images).map((slide, idx, arr) => (
                    <div
                      key={slide.id || idx}
                      className="flex items-start gap-3 p-3 rounded-2xl border border-stone-200/90 bg-stone-50/70"
                    >
                      <div className="relative w-24 h-20 rounded-xl overflow-hidden bg-stone-200 border border-stone-300 shrink-0">
                        <img
                          src={slide.url}
                          alt={slide.caption || `Slayt ${idx + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/images/kasap_sucuk_ekmek.jpg';
                          }}
                        />
                        <span className="absolute top-1 left-1 bg-stone-900/80 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <input
                          type="text"
                          value={slide.caption || ''}
                          onChange={(e) =>
                            updateField((prev) => {
                              const list = [...(prev.storySection?.images || DEFAULT_SITE_CONTENT.storySection.images)];
                              list[idx] = { ...list[idx], caption: e.target.value };
                              return {
                                ...prev,
                                storySection: {
                                  ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                                  images: list,
                                },
                              };
                            })
                          }
                          placeholder="Görsel başlığı..."
                          className="w-full text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold text-stone-800"
                        />

                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] text-stone-400 truncate font-mono">{slide.url}</span>
                          {arr.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                updateField((prev) => {
                                  const list = [...(prev.storySection?.images || DEFAULT_SITE_CONTENT.storySection.images)].filter((_, i) => i !== idx);
                                  return {
                                    ...prev,
                                    storySection: {
                                      ...(prev.storySection || DEFAULT_SITE_CONTENT.storySection),
                                      images: list,
                                    },
                                  };
                                })
                              }
                              className="text-rose-600 hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                              <span>Sil</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. İLETİŞİM, ŞUBE VE ÇALIŞMA SAATLERİ */}
          {/* ========================================================================= */}
          {activeSubTab === 'contact' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <span className="text-xs font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-phone text-emerald-600"></i>
                  <span>İletişim, Şube Adresi &amp; Çalışma Saatleri</span>
                </span>
                <span className="text-[11px] text-stone-400">Alt bilgi (Footer) ve iletişim alanı</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">Şube Açık Adresi</label>
                  <input
                    type="text"
                    value={contact.address || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        contactBar: { ...prev.contactBar, address: e.target.value },
                      }))
                    }
                    placeholder="Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı / İZMİR"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Birincil Sipariş Telefonu</label>
                  <input
                    type="text"
                    value={contact.phone1 || contact.phone || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        contactBar: { ...prev.contactBar, phone1: e.target.value, phone: e.target.value },
                      }))
                    }
                    placeholder="0552 104 55 35"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Paket Servis Çalışma Saatleri</label>
                  <input
                    type="text"
                    value={contact.workingHours || contact.workHours || ''}
                    onChange={(e) =>
                      updateField((prev) => ({
                        ...prev,
                        contactBar: {
                          ...prev.contactBar,
                          workingHours: e.target.value,
                          workHours: e.target.value,
                        },
                      }))
                    }
                    placeholder="Hergün 10:00 - 03:00 Gece Servisi"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-stone-900 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SAĞ KOLON: GERÇEK MÜŞTERİ SAYFASI İLE BİREBİR CANLI ÖNİZLEME */}
        {showLivePreview && (
          <LiveStorefrontPreview
            content={content}
            activeSubTab={activeSubTab}
            isCurrentVisible={isCurrentVisible}
          />
        )}
      </div>
    </div>
  );
}
