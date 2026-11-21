'use client';

import { useState, useEffect, useRef } from 'react';
import UsersRolesTab from './UsersRolesTab';
import MysqlOrmTab from './MysqlOrmTab';
import SiteContentEditorTab from './SiteContentEditorTab';
import { playKitchenBellSound } from './KitchenPosBell';
import { DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS } from '@/lib/notificationDefaults';
import { BANNER_THEMES } from '@/components/CustomerAnnouncementBanner';

export const DEFAULT_ADMIN_SETTINGS = {
  fontSize: 'medium', // 'small' | 'medium' | 'large'
  density: 'comfortable', // 'comfortable' | 'compact'
  soundEnabled: true,
  soundType: 'chime', // 'chime' | 'bell' | 'beep' | 'custom_*'
  soundVolume: 80, // 0 - 100
  customSounds: [],
  autoRefreshInterval: 60, // seconds: 8, 15, 30, 60, 0
  storeName: 'Sandviç Diyarı',
  storeAddress: 'Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı/İZMİR',
  storePhone: '0232 856 81 21 / 0552 104 55 35',
  receiptFooter: 'Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz! Afiyet Olsun - sandwichdiyari.com',
  showPricesOnReceipt: true,
  showPhoneOnReceipt: true,
};

const SETTINGS_PAGES = {
  appearance: {
    id: 'appearance',
    title: 'Yazı Boyutu & Panel Arayüzü',
    badge: 'Arayüz & Tipografi',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: 'fa-solid fa-text-height',
    desc: 'Panel metinleri, sipariş kartları ve ürün tablolarının yazı boyutunu ve yoğunluğunu yönetin.',
  },
  site_content: {
    id: 'site_content',
    title: 'Müşteri Sayfası & Vitrin Düzenleri',
    badge: 'Vitrin & Sayfa Tasarımı',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: 'fa-solid fa-paintbrush',
    desc: 'Müşteri ana sayfasındaki manşet slider, afiş, kampanyalar ve vitrin bölümlerini özelleştirin.',
  },
  users: {
    id: 'users',
    title: 'Kullanıcılar & Rol Modelleri',
    badge: 'Yetkilendirme & Personel',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: 'fa-solid fa-user-shield',
    desc: 'Yönetici personelleri, departman yetkileri ve müşteri hesaplarını anlık yönetin.',
  },
  sound: {
    id: 'sound',
    title: 'Müşteri Bildirimleri & POS Ses Ayarları',
    badge: 'Bildirim Merkezi & Ses',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: 'fa-solid fa-bell',
    desc: 'Müşteri sayfasındaki bildirim zilini, üst duyuru bandını, canlı kampanya bildirimlerini ve mutfak zil sesini yönetin.',
  },
  receipt: {
    id: 'receipt',
    title: 'Fiş & Adisyon Baskı Şablonu',
    badge: 'Termal Yazıcı',
    badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
    icon: 'fa-solid fa-receipt',
    desc: 'Yazıcıdan çıkacak müşteri adisyon ve paket servis fişindeki işletme adı, telefon ve alt notları düzenleyin.',
  },
  system: {
    id: 'system',
    title: 'Sistem & Veri Yedekleme',
    badge: 'JSON Yedek & Sistem',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    icon: 'fa-solid fa-box-archive',
    desc: 'Tüm sistem verilerini, personelleri ve ayarları tek tıkla bilgisayarınıza güvenle yedekleyin.',
  },
  api: {
    id: 'api',
    title: 'PostgreSQL 16 ORM & Güvenlik',
    badge: 'PostgreSQL 16 & Prisma',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'fa-solid fa-database',
    desc: 'PostgreSQL 16 veritabanı bağlantısı, Prisma ORM sorguları ve SQL injection güvenlik testleri.',
  },
};

export default function SettingsTab({
  currentSettings,
  onSaveSettings,
  onExportBackup,
  currentAdmin,
  initialSubTab = 'appearance',
  onSubTabChange,
  showToast,
}) {
  const [settings, setSettings] = useState(currentSettings || DEFAULT_ADMIN_SETTINGS);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'appearance' | 'users' | 'sound' | 'receipt' | 'system'

  // Müşteri Sayfası Bildirim Merkezi Ayarları (Supabase Senkron)
  const [custNotifSettings, setCustNotifSettings] = useState(DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS);
  const [isSavingCustNotif, setIsSavingCustNotif] = useState(false);

  // Yeni Canlı Duyuru / Kampanya Bildirimi Formu
  const [bcastTitle, setBcastTitle] = useState('');
  const [bcastMessage, setBcastMessage] = useState('');
  const [bcastType, setBcastType] = useState('campaign');
  const [bcastTargetPage, setBcastTargetPage] = useState('kampanyalar');
  const [bcastAlsoMembers, setBcastAlsoMembers] = useState(true);
  const [isPublishingBcast, setIsPublishingBcast] = useState(false);

  // Özel Bildirim Sesi Ekleme State'leri
  const [newSoundLabel, setNewSoundLabel] = useState('');
  const [newSoundUrl, setNewSoundUrl] = useState('');
  const [newSoundFileName, setNewSoundFileName] = useState('');
  const [soundUploadError, setSoundUploadError] = useState('');
  const audioFileInputRef = useRef(null);

  useEffect(() => {
    try {
      const savedInt = localStorage.getItem('sd_bell_interval');
      const parsedLocalInt = savedInt !== null && savedInt !== '' ? parseInt(savedInt, 10) : null;

      const savedCustom = localStorage.getItem('sd_custom_bell_sounds');
      const parsedCustom = savedCustom ? JSON.parse(savedCustom) : null;

      setSettings((prev) => ({
        ...prev,
        ...(Array.isArray(parsedCustom) && parsedCustom.length > 0 && (!Array.isArray(prev.customSounds) || prev.customSounds.length === 0)
          ? { customSounds: parsedCustom }
          : {}),
        ...(parsedLocalInt !== null && !Number.isNaN(parsedLocalInt) && parsedLocalInt >= 0
          ? { autoRefreshInterval: parsedLocalInt }
          : {})
      }));
    } catch {}

    fetch('/api/notifications?includePosSounds=1', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j?.data?.settings) {
          setCustNotifSettings(j.data.settings);
          const remoteInt = j.data.settings.posSoundInterval;
          const localIntRaw = typeof window !== 'undefined' ? localStorage.getItem('sd_bell_interval') : null;
          const localInt = localIntRaw !== null && localIntRaw !== '' ? parseInt(localIntRaw, 10) : null;
          const effectiveInt =
            typeof remoteInt === 'number' && remoteInt >= 0
              ? remoteInt
              : localInt !== null && !Number.isNaN(localInt)
              ? localInt
              : 60;

          setSettings((prev) => ({
            ...prev,
            ...(Array.isArray(j.data.settings.customSounds) && j.data.settings.customSounds.length > 0
              ? { customSounds: j.data.settings.customSounds }
              : {}),
            ...(j.data.settings.posSoundType ? { soundType: j.data.settings.posSoundType } : {}),
            ...(typeof j.data.settings.posSoundVolume === 'number'
              ? { soundVolume: j.data.settings.posSoundVolume }
              : {}),
            autoRefreshInterval: effectiveInt
          }));
          try {
            if (Array.isArray(j.data.settings.customSounds) && j.data.settings.customSounds.length > 0) {
              localStorage.setItem('sd_custom_bell_sounds', JSON.stringify(j.data.settings.customSounds));
            }
            localStorage.setItem('sd_bell_interval', String(effectiveInt));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handleCustNotifChange = (key, value) => {
    setCustNotifSettings((prev) => ({ ...prev, [key]: value }));
    setSavedSuccess(false);
  };

  const handlePublishBroadcast = async (e) => {
    e.preventDefault();
    if (!bcastTitle.trim() || !bcastMessage.trim()) {
      alert('Lütfen bildirim başlığı ve mesajını giriniz.');
      return;
    }

    setIsPublishingBcast(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_broadcast',
          title: bcastTitle.trim(),
          message: bcastMessage.trim(),
          type: bcastType,
          targetPage: bcastTargetPage,
          alsoSendToMembers: bcastAlsoMembers
        })
      });
      const json = await res.json();
      if (json?.success && json?.data?.settings) {
        setCustNotifSettings(json.data.settings);
        setBcastTitle('');
        setBcastMessage('');
        try {
          localStorage.setItem('sandwich_notifications_updated', String(Date.now()));
        } catch (err) {}
        if (showToast) {
          showToast('Canlı bildirim müşteri sayfasında yayınlandı! 🔔', 'success');
        }
      } else {
        alert(json?.error || 'Bildirim yayınlanamadı.');
      }
    } catch (err) {
      alert('Sunucu bağlantı hatası oluştu.');
    } finally {
      setIsPublishingBcast(false);
    }
  };

  const handleDeleteBroadcast = async (id) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_broadcast', id })
      });
      const json = await res.json();
      if (json?.success && json?.data?.settings) {
        setCustNotifSettings(json.data.settings);
        try {
          localStorage.setItem('sandwich_notifications_updated', String(Date.now()));
        } catch (err) {}
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSubTabSwitch = (tabId) => {
    setActiveSubTab(tabId);
    if (onSubTabChange) onSubTabChange(tabId);
  };

  useEffect(() => {
    if (currentSettings) {
      const savedInt = typeof window !== 'undefined' ? localStorage.getItem('sd_bell_interval') : null;
      const parsedLocalInt = savedInt !== null && savedInt !== '' ? parseInt(savedInt, 10) : null;
      setSettings((prev) => ({
        ...DEFAULT_ADMIN_SETTINGS,
        ...prev,
        ...currentSettings,
        autoRefreshInterval:
          parsedLocalInt !== null && !Number.isNaN(parsedLocalInt)
            ? parsedLocalInt
            : typeof prev.autoRefreshInterval === 'number'
            ? prev.autoRefreshInterval
            : typeof currentSettings.autoRefreshInterval === 'number'
            ? currentSettings.autoRefreshInterval
            : 60,
        customSounds:
          Array.isArray(currentSettings.customSounds) && currentSettings.customSounds.length > 0
            ? currentSettings.customSounds
            : prev.customSounds || [],
        soundType: currentSettings.soundType || prev.soundType || 'chime'
      }));
    }
  }, [currentSettings]);

  const syncSoundSettingsEverywhere = async (
    nextCustomSounds,
    nextSoundType,
    nextVolume = settings.soundVolume || 80,
    nextInterval = typeof settings.autoRefreshInterval === 'number' ? settings.autoRefreshInterval : 60,
    includeHeavyAudioInPost = false
  ) => {
    const cleanInterval = Number.isFinite(Number(nextInterval)) ? Number(nextInterval) : 60;
    const cleanVolume = Number.isFinite(Number(nextVolume)) ? Number(nextVolume) : 80;
    const nextSettingsObj = {
      ...settings,
      customSounds: nextCustomSounds,
      soundType: nextSoundType,
      soundVolume: cleanVolume,
      autoRefreshInterval: cleanInterval
    };
    setSettings(nextSettingsObj);
    setCustNotifSettings((prev) => ({
      ...prev,
      customSounds: nextCustomSounds,
      posSoundType: nextSoundType,
      posSoundVolume: cleanVolume,
      posSoundInterval: cleanInterval
    }));

    if (typeof window !== 'undefined') {
      window.__sdCustomBellSounds = nextCustomSounds;
      // 1. Always write lightweight keys first so QuotaExceededError never blocks sd_bell_sound or sd_bell_interval!
      try {
        localStorage.setItem('sd_bell_sound', nextSoundType);
        localStorage.setItem('sd_bell_volume', String(cleanVolume / 100));
        localStorage.setItem('sd_bell_interval', String(cleanInterval));
        const { customSounds: _omitHeavyAudio, ...liteAdminSettings } = nextSettingsObj;
        localStorage.setItem('sandwich_admin_settings', JSON.stringify(liteAdminSettings));
      } catch {}

      // 2. Write customSounds array; if 5MB localStorage quota is exceeded, store only the active/newest sound in localStorage
      if (includeHeavyAudioInPost) {
        try {
          localStorage.setItem('sd_custom_bell_sounds', JSON.stringify(nextCustomSounds));
        } catch {
          try {
            const activeOnly = nextCustomSounds.filter((s) => s.id === nextSoundType);
            const fallbackSlice = activeOnly.length > 0 ? activeOnly : nextCustomSounds.slice(-1);
            localStorage.removeItem('sd_custom_bell_sounds');
            localStorage.setItem('sd_custom_bell_sounds', JSON.stringify(fallbackSlice));
          } catch {}
        }
      }
    }

    if (onSaveSettings) {
      const { customSounds: _omit, ...liteForParent } = nextSettingsObj;
      onSaveSettings(liteForParent);
    }

    try {
      // Only send heavy base64 customSounds when adding/deleting a sound file so Vercel 4.5MB body limit never blocks interval/volume updates!
      const { customSounds: _omitFromCust, ...liteCustNotif } = custNotifSettings;
      const postSettingsPayload = {
        ...liteCustNotif,
        posSoundType: nextSoundType,
        posSoundVolume: cleanVolume,
        posSoundInterval: cleanInterval,
        ...(includeHeavyAudioInPost ? { customSounds: nextCustomSounds.slice(-2) } : {})
      };

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          settings: postSettingsPayload
        })
      });
      const json = await res.json();
      if (json?.success && json?.data?.settings) {
        setCustNotifSettings((prev) => ({
          ...prev,
          ...json.data.settings,
          posSoundInterval: cleanInterval
        }));
        try {
          localStorage.setItem('sd_pos_bell_updated', String(Date.now()));
        } catch {}
      }
    } catch (err) {
      console.error('Ses ayarları sunucuya kaydedilemedi:', err);
    }
  };

  // Müşteri Sayfası Bildirim Ayarlarını Bağımsız Kaydet (Panel POS seslerinden tamamen ayrı)
  const handleSaveCustomerNotifOnly = async () => {
    setIsSavingCustNotif(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          settings: {
            ...custNotifSettings,
            customSounds: Array.isArray(settings.customSounds) ? settings.customSounds : custNotifSettings.customSounds || [],
            posSoundType: settings.soundType || custNotifSettings.posSoundType || 'chime',
            posSoundVolume: settings.soundVolume || custNotifSettings.posSoundVolume || 80
          }
        })
      });
      const json = await res.json();
      if (json?.success && json?.data?.settings) {
        setCustNotifSettings(json.data.settings);
        try {
          localStorage.setItem('sandwich_notifications_updated', String(Date.now()));
        } catch {}
        if (showToast) {
          showToast('Müşteri sayfası bildirim ayarları güncellendi!', 'success');
        }
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Müşteri bildirim ayarları kaydedilemedi:', err);
    } finally {
      setIsSavingCustNotif(false);
    }
  };

  // Ayar Değişikliği
  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSavedSuccess(false);
  };

  // Ayarları Kaydet
  const handleSave = async () => {
    const customList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
    const activeSoundType =
      customList.length > 0 && (!settings.soundType || settings.soundType === 'chime')
        ? customList[customList.length - 1].id
        : settings.soundType || 'chime';

    const activeInterval =
      typeof settings.autoRefreshInterval === 'number' ? settings.autoRefreshInterval : 60;

    await syncSoundSettingsEverywhere(
      customList,
      activeSoundType,
      settings.soundVolume || 80,
      activeInterval
    );

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Ses Testi (Web Audio API & Özel Ses Dosyaları)
  const handlePlaySoundTest = (overrideSoundId = null, overrideList = null) => {
    const list = overrideList || settings.customSounds || [];
    const activeType =
      overrideSoundId ||
      (list.length > 0 && (!settings.soundType || settings.soundType === 'chime')
        ? list[list.length - 1].id
        : settings.soundType || 'chime');
    const vol = (settings.soundVolume || 80) / 100;
    playKitchenBellSound(activeType, vol, list);
  };

  // Cihazdan Ses Dosyası Seçme (.mp3, .wav, .ogg, .m4a) -> Seçildiği anda otomatik listeye ekler ve aktif ses yapar!
  const handleAudioFileSelect = (e) => {
    setSoundUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      setSoundUploadError('Lütfen geçerli bir ses dosyası (.mp3, .wav, .ogg, .m4a) seçin.');
      return;
    }

    if (file.size > 3.5 * 1024 * 1024) {
      setSoundUploadError('Ses dosyası boyutu en fazla 3.5 MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl.startsWith('data:')) {
        const autoLabel =
          newSoundLabel.trim() || file.name.replace(/\.[^/.]+$/, '').slice(0, 40) || 'Özel Bildirim Sesi';
        const newSound = {
          id: `custom_${Date.now()}`,
          label: autoLabel,
          desc: `Dosya: ${file.name}`,
          audioUrl: dataUrl,
          createdAt: new Date().toISOString()
        };

        // Yeni ses eklendiğinde önceki sesin çalmaya devam etmemesi için yeni sesi aktif yap
        const currentList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
        const nextList = [...currentList, newSound];

        setNewSoundLabel('');
        setNewSoundUrl('');
        setNewSoundFileName('');
        if (audioFileInputRef.current) audioFileInputRef.current.value = '';

        syncSoundSettingsEverywhere(
          nextList,
          newSound.id,
          settings.soundVolume || 80,
          typeof settings.autoRefreshInterval === 'number' ? settings.autoRefreshInterval : 60,
          true
        );
        handlePlaySoundTest(newSound.id, nextList);
        if (showToast) {
          showToast(`"${autoLabel}" bildirim sesi olarak eklendi ve aktif edildi! 🔊`, 'success');
        }
      }
    };
    reader.onerror = () => {
      setSoundUploadError('Ses dosyası okunamadı.');
    };
    reader.readAsDataURL(file);
  };

  // Yeni Özel Bildirim Sesi Ekle
  const handleAddCustomSound = () => {
    setSoundUploadError('');
    const label = newSoundLabel.trim() || newSoundFileName.replace(/\.[^/.]+$/, '') || 'Özel Bildirim Sesi';
    const url = newSoundUrl.trim();

    if (!url) {
      setSoundUploadError('Lütfen cihazınızdan bir ses dosyası seçin veya geçerli bir ses URL adresi girin.');
      return;
    }

    const newSound = {
      id: `custom_${Date.now()}`,
      label,
      desc: newSoundFileName ? `Dosya: ${newSoundFileName}` : 'Özel Ses Bağlantısı',
      audioUrl: url,
      createdAt: new Date().toISOString()
    };

    const currentList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
    const nextList = [...currentList, newSound];

    setNewSoundLabel('');
    setNewSoundUrl('');
    setNewSoundFileName('');
    if (audioFileInputRef.current) audioFileInputRef.current.value = '';

    syncSoundSettingsEverywhere(
      nextList,
      newSound.id,
      settings.soundVolume || 80,
      typeof settings.autoRefreshInterval === 'number' ? settings.autoRefreshInterval : 60,
      true
    );
    handlePlaySoundTest(newSound.id, nextList);
  };

  // Özel Bildirim Sesini Sil
  const handleDeleteCustomSound = (soundId, e) => {
    if (e) e.stopPropagation();
    const currentList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
    const nextList = currentList.filter((s) => s.id !== soundId);
    const nextSoundType =
      settings.soundType === soundId
        ? nextList.length > 0
          ? nextList[nextList.length - 1].id
          : 'chime'
        : settings.soundType;

    syncSoundSettingsEverywhere(
      nextList,
      nextSoundType,
      settings.soundVolume || 80,
      typeof settings.autoRefreshInterval === 'number' ? settings.autoRefreshInterval : 60,
      true
    );
  };

  // Yedek İndirme
  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      const backupData = {
        exportedAt: new Date().toISOString(),
        settings,
        systemData: json.data || {},
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sandvic_Diyari_Sistem_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Yedek dosyası oluşturulamadı: ' + err.message);
    }
  };

  const currentMeta = SETTINGS_PAGES[activeSubTab] || SETTINGS_PAGES.appearance;

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full min-w-0 font-poppins animate-in fade-in duration-150">
      {/* 1. SEÇİLİ AYAR SAYFASI İÇİN ÖZEL BAŞLIK VE AKSİYON BARI */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center text-sm font-bold shadow-2xs shrink-0">
            <i className={currentMeta.icon}></i>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">
                Sistem Ayarları &bull;
              </span>
              <h2 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                {currentMeta.title}
              </h2>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${currentMeta.badgeColor}`}>
                {currentMeta.badge}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5 truncate sm:whitespace-normal">
              {currentMeta.desc}
            </p>
          </div>
        </div>

        {/* Sağ Alan: Hızlı Ayar Seçici & Kaydet Butonu */}
        <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100 justify-end">
          {/* Hızlı Sayfa Seçici (Hem Mobilde Hem Masaüstünde Tek Tıkla Geçiş) */}
          <div className="relative">
            <select
              value={activeSubTab}
              onChange={(e) => handleSubTabSwitch(e.target.value)}
              className="app-select bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 text-stone-900 text-xs font-bold rounded-2xl px-4 py-2.5 cursor-pointer focus:outline-none focus:ring-3 focus:ring-brand-500/15 transition-all shadow-xs"
              title="Ayar Sayfası Değiştir"
            >
              <option value="appearance">🔤 Arayüz</option>
              <option value="site_content">🎨 Vitrin</option>
              <option value="users">🛡️ Kullanıcılar</option>
              <option value="sound">🔔 Ses</option>
              <option value="receipt">🧾 Fiş Baskı</option>
              <option value="system">💾 Yedekleme</option>
              <option value="api">🐘 Veritabanı</option>
            </select>
          </div>

          {activeSubTab !== 'users' && activeSubTab !== 'api' && activeSubTab !== 'site_content' && (
            <div className="flex items-center gap-2">
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                  <i className="fa-solid fa-check"></i>
                  <span>Kaydedildi</span>
                </span>
              )}
              <button
                type="button"
                disabled={isSavingCustNotif}
                onClick={handleSave}
                className="bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs active:scale-95"
              >
                <i className={`fa-solid ${isSavingCustNotif ? 'fa-spinner animate-spin' : 'fa-floppy-disk'} text-xs`}></i>
                <span>{isSavingCustNotif ? 'Kaydediliyor...' : 'Kaydet'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. SEÇİLİ AYAR SAYFASI İÇERİĞİ */}

      {/* SEKME 1: YAZI BOYUTU VE ARAYÜZ ERİŞİLEBİLİRLİĞİ */}
      {activeSubTab === 'appearance' && (
        <div className="space-y-4">
          {/* Yazı Boyutu Seçimi */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-font text-stone-600"></i>
                Yazı Boyutu (Font Size)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Paneldeki metinlerin, ürün listelerinin ve sipariş kartlarının boyutunu ayarlayın. Dokunmatik ekranlar ve mutfak tabletleri için büyük yazı boyutu önerilir.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'small',
                  label: 'Kompakt (Küçük)',
                  desc: 'Daha fazla ürün ve satırı ekranda topluca görmek için idealdir.',
                  sample: 'text-xs',
                  sampleText: 'Örnek Metin: 1x Maxi Kumru ₺240.00',
                  badge: 'Kompakt',
                },
                {
                  id: 'medium',
                  label: 'Standart (Orta)',
                  desc: 'Varsayılan ve dengeli masaüstü kullanım standardı.',
                  sample: 'text-sm',
                  sampleText: 'Örnek Metin: 1x Maxi Kumru ₺240.00',
                  badge: 'Önerilen',
                },
                {
                  id: 'large',
                  label: 'Büyük & Okunaklı',
                  desc: 'Tablet, POS ve mutfak dokunmatik ekranları için geniş ve rahat okunur.',
                  sample: 'text-base font-semibold',
                  sampleText: 'Örnek Metin: 1x Maxi Kumru ₺240.00',
                  badge: 'Tablet / POS',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handleChange('fontSize', opt.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    settings.fontSize === opt.id
                      ? 'border-brand-600 bg-brand-50/20 shadow-xs'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-stone-900">{opt.label}</span>
                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">{opt.desc}</p>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80 text-stone-800">
                    <span className={opt.sample}>{opt.sampleText}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ekran Satır Yoğunluğu */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-table-cells text-stone-600"></i>
                Tablo ve Liste Yoğunluğu (Density)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Sipariş ve stok tablolarındaki satır yüksekliğini ve iç boşlukları belirler.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'comfortable',
                  label: 'Standart / Dengeli',
                  desc: 'Ferah padding boşlukları ile rahat ve yormayan görünüm.',
                  icon: 'fa-regular fa-square',
                },
                {
                  id: 'compact',
                  label: 'Sıkışık / Yüksek Veri',
                  desc: 'Az boşluk, yoğun satır. Hızlı operasyon takibi için daha çok sipariş gösterir.',
                  icon: 'fa-solid fa-bars',
                },
              ].map((den) => (
                <div
                  key={den.id}
                  onClick={() => handleChange('density', den.id)}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                    settings.density === den.id
                      ? 'border-brand-600 bg-brand-50/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 shrink-0">
                    <i className={den.icon}></i>
                  </div>
                  <div>
                    <span className="font-bold text-xs text-stone-900 block">{den.label}</span>
                    <span className="text-[11px] text-stone-500 block leading-tight mt-0.5">
                      {den.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SEKME: KULLANICILAR VE ROL MODELLERİ */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <UsersRolesTab currentAdmin={currentAdmin} />
        </div>
      )}

      {/* SEKME 2: SES VE BİLDİRİM AYARLARI */}
      {activeSubTab === 'sound' && (
        <div className="space-y-5">
          {/* KART 1: MÜŞTERİ SAYFASI BİLDİRİM MERKEZİ & DUYURU BANDI AYARLARI */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base shrink-0">
                  <i className="fa-solid fa-bell"></i>
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900">
                    Müşteri Sayfası Bildirim Merkezi &amp; Canlı Duyuru Ayarları
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Müşteri vitrinindeki bildirim zili, sipariş durumu uyarıları ve üst duyuru bandını buradan kontrol edin.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSavingCustNotif}
                onClick={handleSaveCustomerNotifOnly}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs shrink-0"
              >
                <i className={`fa-solid ${isSavingCustNotif ? 'fa-spinner animate-spin' : 'fa-check'}`}></i>
                <span>Müşteri Bildirim Ayarlarını Uygula</span>
              </button>
            </div>

            {/* 4 Anahtar (Switch) Kartı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  key: 'enabled',
                  title: 'Müşteri Bildirim Zili Aktif',
                  desc: 'Üst menüde (Navbar) bildirim zili ve açılır bildirim kutusunu gösterir.',
                  icon: 'fa-solid fa-bell'
                },
                {
                  key: 'orderStatusNotifications',
                  title: 'Otomatik Sipariş Durumu Bildirimleri',
                  desc: 'Sipariş onaylandığında, hazırlandığında veya kuryeye çıktığında müşteriye otomatik bildirim düşer.',
                  icon: 'fa-solid fa-motorcycle'
                },
                {
                  key: 'toastEnabled',
                  title: 'Anlık Bildirim Balonu (Canlı Popup)',
                  desc: 'Yeni bildirim gönderildiğinde müşterinin ekranında sağ üstte canlı baloncuk açılır.',
                  icon: 'fa-solid fa-comment-dots'
                },
                {
                  key: 'soundEnabled',
                  title: 'Müşteri Bildirim Sesi',
                  desc: 'Yeni bildirim ulaştığında müşteri ekranında hafif uyarı çanı çalar.',
                  icon: 'fa-solid fa-music'
                }
              ].map((item) => {
                const isOn = custNotifSettings[item.key] !== false;
                return (
                  <div
                    key={item.key}
                    onClick={() => handleCustNotifChange(item.key, !isOn)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isOn
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                          isOn ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-500'
                        }`}
                      >
                        <i className={item.icon}></i>
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-stone-900 block">{item.title}</span>
                        <span className="text-[11px] text-stone-500 block leading-snug mt-0.5">
                          {item.desc}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                        isOn ? 'bg-emerald-600' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          isOn ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Üst Duyuru Bandı Düzenleyici */}
            <div className="pt-4 border-t border-stone-100 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider">
                    Üst Canlı Duyuru &amp; Fırsat Bandı
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Menü çubuğunun hemen altında tüm ziyaretçilere görünen renkli duyuru şeridi.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-800">
                  <input
                    type="checkbox"
                    checked={custNotifSettings.showBanner !== false}
                    onChange={(e) => handleCustNotifChange('showBanner', e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span>Bandı Göster</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Görünüm Teması</label>
                  <select
                    value={custNotifSettings.bannerType || 'campaign'}
                    onChange={(e) => handleCustNotifChange('bannerType', e.target.value)}
                    className="app-select w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-bold text-stone-900 cursor-pointer"
                  >
                    <option value="campaign">🔥 Kampanya (Turuncu)</option>
                    <option value="delivery">🛵 Sıcak Teslimat (Yeşil)</option>
                    <option value="info">📢 Bilgilendirme (İndigo)</option>
                    <option value="warning">⚠️ Önemli Uyarı (Kırmızı)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Buton Hedef Sayfası</label>
                  <select
                    value={custNotifSettings.bannerActionPage || 'kampanyalar'}
                    onChange={(e) => handleCustNotifChange('bannerActionPage', e.target.value)}
                    className="app-select w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-bold text-stone-900 cursor-pointer"
                  >
                    <option value="kampanyalar">Kampanyalar Sayfası</option>
                    <option value="menu">Menü &amp; Ürünler</option>
                    <option value="iletisim">İletişim Sayfası</option>
                    <option value="none">Buton Gösterme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Buton Yazısı</label>
                  <input
                    type="text"
                    value={custNotifSettings.bannerActionLabel || ''}
                    onChange={(e) => handleCustNotifChange('bannerActionLabel', e.target.value)}
                    placeholder="Örn: Fırsatları Gör"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Kısa Başlık</label>
                  <input
                    type="text"
                    value={custNotifSettings.bannerTitle || ''}
                    onChange={(e) => handleCustNotifChange('bannerTitle', e.target.value)}
                    placeholder="Örn: Sıcak Paket Servis Aktif!"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Duyuru Mesajı</label>
                  <input
                    type="text"
                    value={custNotifSettings.bannerText || ''}
                    onChange={(e) => handleCustNotifChange('bannerText', e.target.value)}
                    placeholder="Örn: Torbalı içi her gün 03:00'e kadar sıcak teslimat..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Canlı Gradyan Bant Önizlemesi */}
              {(() => {
                const previewTheme =
                  BANNER_THEMES[custNotifSettings.bannerType] || BANNER_THEMES.campaign;
                return (
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
                      Canlı Görünüm Önizlemesi
                    </span>
                    <div
                      className={`w-full rounded-xl text-white ${previewTheme.borderClass} shadow-md px-4 py-2.5 flex items-center justify-between gap-3 overflow-hidden`}
                      style={{ backgroundImage: previewTheme.gradient }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className={`w-7 h-7 rounded-xl ${previewTheme.iconBox} flex items-center justify-center shrink-0`}
                        >
                          <i className={`${previewTheme.icon} text-xs`}></i>
                        </span>
                        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {custNotifSettings.bannerTitle && (
                            <strong
                              className={`${previewTheme.titlePill} font-black tracking-tight text-[11px] px-2.5 py-0.5 rounded-full shrink-0`}
                            >
                              {custNotifSettings.bannerTitle}
                            </strong>
                          )}
                          {custNotifSettings.bannerText && (
                            <span
                              className="text-white font-semibold text-xs leading-snug"
                              style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)' }}
                            >
                              {custNotifSettings.bannerText}
                            </span>
                          )}
                        </div>
                      </div>
                      {custNotifSettings.bannerActionPage &&
                        custNotifSettings.bannerActionPage !== 'none' &&
                        custNotifSettings.bannerActionLabel && (
                          <span
                            className={`${previewTheme.btn} font-extrabold text-[11px] px-3 py-1 rounded-full shrink-0 flex items-center gap-1`}
                          >
                            <span>{custNotifSettings.bannerActionLabel}</span>
                            <i className="fa-solid fa-arrow-right text-[9px]"></i>
                          </span>
                        )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* KART 2: HIZLI CANLI BİLDİRİM & KAMPANYA YAYINLAMA */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-indigo-600"></i>
                <span>Müşteri Bildirim Kutusuna Canlı Duyuru / Kampanya Gönder</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Buradan yayınladığınız bildirimler sitedeki tüm ziyaretçi ve üyelerin bildirim zilinde anında görünür.
              </p>
            </div>

            <form onSubmit={handlePublishBroadcast} className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200/80">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Bildirim Başlığı *</label>
                  <input
                    type="text"
                    required
                    value={bcastTitle}
                    onChange={(e) => setBcastTitle(e.target.value)}
                    placeholder="Örn: 🎉 Gece Menülerinde Özel Fırsat!"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Kategori</label>
                  <select
                    value={bcastType}
                    onChange={(e) => setBcastType(e.target.value)}
                    className="app-select w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 cursor-pointer"
                  >
                    <option value="campaign">🎁 Kampanya</option>
                    <option value="info">📢 Duyuru</option>
                    <option value="warning">⚠️ Önemli Bilgi</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Tıklanınca Açılacak Sayfa</label>
                  <select
                    value={bcastTargetPage}
                    onChange={(e) => setBcastTargetPage(e.target.value)}
                    className="app-select w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 cursor-pointer"
                  >
                    <option value="kampanyalar">Kampanyalar</option>
                    <option value="menu">Menü &amp; Ürünler</option>
                    <option value="iletisim">İletişim</option>
                    <option value="none">Yönlendirme Yok</option>
                  </select>
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Bildirim Mesajı *</label>
                  <textarea
                    rows={2}
                    required
                    value={bcastMessage}
                    onChange={(e) => setBcastMessage(e.target.value)}
                    placeholder="Müşterilerinize iletmek istediğiniz kampanya veya duyuru metnini yazın..."
                    className="w-full bg-white border border-stone-200 rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700">
                  <input
                    type="checkbox"
                    checked={bcastAlsoMembers}
                    onChange={(e) => setBcastAlsoMembers(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span>Kayıtlı tüm üyelerin kişisel bildirim kutusuna da kaydet</span>
                </label>

                <button
                  type="submit"
                  disabled={isPublishingBcast}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0"
                >
                  <i className={`fa-solid ${isPublishingBcast ? 'fa-spinner animate-spin' : 'fa-bullhorn'}`}></i>
                  <span>{isPublishingBcast ? 'Yayınlanıyor...' : 'Canlı Bildirimi Yayınla'}</span>
                </button>
              </div>
            </form>

            {/* Yayındaki Genel Duyurular Listesi */}
            {(custNotifSettings.broadcasts || []).length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 block">
                  Yayındaki Genel Bildirimler ({custNotifSettings.broadcasts.length})
                </span>
                <div className="divide-y divide-stone-100 border border-stone-200/80 rounded-xl overflow-hidden">
                  {custNotifSettings.broadcasts.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-white hover:bg-stone-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{b.title}</p>
                        <p className="text-[11px] text-stone-500 truncate">{b.message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBroadcast(b.id)}
                        className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Yayından Kaldır"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* KART 3: ÇOKLU SİPARİŞ (1'İN ÜZERİNDE SİPARİŞ) ÖZEL BİLDİRİM SESİ */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-stone-900">
                    Çoklu Sipariş (1&apos;in Üzerinde Sipariş) Özel Bildirim Sesi
                  </h3>
                  <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                    1+ Siparişte Aktif
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Tek ürünlü (1 adet) siparişlerde doğrudan menünün içindeki kendi sesi çalar. <strong>1&apos;in üzerinde (çoklu ürün veya birden fazla bekleyen)</strong> sipariş geldiğinde ise buradan seçtiğiniz / yüklediğiniz özel ses çalar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('soundEnabled', !settings.soundEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.soundEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Ses Tonu Seçimi */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 block">
                  Zil Sesi Tipi (Varsayılan &amp; Özel Eklenen Sesler)
                </label>
                <span className="text-[11px] text-stone-400">
                  Seçtiğiniz ses yeni sipariş geldiğinde çalar
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'chime', label: '🔔 Çift Tonlu Çan', desc: 'Melodik & Yumuşak', isBuiltIn: true },
                  { id: 'bell', label: '🎵 Klasik Zil', desc: 'Net ve Yüksek Ton', isBuiltIn: true },
                  { id: 'beep', label: '🚨 Dijital Bip', desc: 'Kısa & Hızlı Uyarı', isBuiltIn: true },
                  ...(Array.isArray(settings.customSounds) ? settings.customSounds : []),
                ].map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      const currentList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
                      syncSoundSettingsEverywhere(currentList, s.id);
                      handlePlaySoundTest(s.id, currentList);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      settings.soundType === s.id
                        ? 'border-brand-600 bg-brand-50/30 font-bold text-stone-900 ring-1 ring-brand-500/30'
                        : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-xs block truncate">
                        {s.isBuiltIn ? s.label : `🎶 ${s.label}`}
                      </span>
                      <span className="text-[10px] text-stone-400 font-normal block truncate">
                        {s.desc || 'Özel Bildirim Sesi'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySoundTest(s.id);
                        }}
                        className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] cursor-pointer"
                        title="Bu Sesi Dinle"
                      >
                        <i className="fa-solid fa-play"></i>
                      </button>
                      {!s.isBuiltIn && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomSound(s.id, e)}
                          className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] cursor-pointer"
                          title="Özel Sesi Sil"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* KULLANICI ÖZEL BİLDİRİM SESİ EKLEME ALANI */}
              <div className="bg-stone-50/90 border border-stone-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3 mt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                      <i className="fa-solid fa-file-audio text-brand-600"></i>
                      <span>Kendi Bildirim Sesini Ekle (.mp3, .wav, .ogg veya URL)</span>
                    </span>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Bilgisayarınızdan veya telefonunuzdan özel zil/alarm sesi yükleyip sipariş bildirimi olarak kullanabilirsiniz.
                    </p>
                  </div>

                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                    onChange={handleAudioFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => audioFileInputRef.current?.click()}
                    className="bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-upload text-brand-600"></i>
                    <span>{newSoundFileName ? `Seçildi: ${newSoundFileName}` : 'Cihazdan Ses Dosyası Seç'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newSoundLabel}
                      onChange={(e) => setNewSoundLabel(e.target.value)}
                      placeholder="Ses Adı (Örn: Mutfak Zili 1)"
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={newSoundUrl.startsWith('data:') ? `[Yüklenen Dosya: ${newSoundFileName}]` : newSoundUrl}
                      onChange={(e) => {
                        setNewSoundFileName('');
                        setNewSoundUrl(e.target.value);
                      }}
                      placeholder="Veya ses dosyası linki (https://.../zil.mp3)"
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-700 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddCustomSound}
                      className="w-full bg-stone-900 hover:bg-black text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <i className="fa-solid fa-plus text-amber-400"></i>
                      <span>Sesi Listeye Ekle</span>
                    </button>
                  </div>
                </div>

                {soundUploadError && (
                  <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{soundUploadError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Ses Seviyesi ve Test Butonu */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">Ses Düzeyi: %{settings.soundVolume || 80}</span>
                <button
                  type="button"
                  onClick={() => handlePlaySoundTest()}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-play text-[10px]"></i>
                  <span>Seçili Sesi Test Et</span>
                </button>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.soundVolume || 80}
                onChange={(e) => {
                  const nextVol = Number(e.target.value);
                  handleChange('soundVolume', nextVol);
                  try {
                    localStorage.setItem('sd_bell_volume', String(nextVol / 100));
                  } catch {}
                }}
                onMouseUp={(e) => {
                  const nextVol = Number(e.currentTarget.value);
                  const customList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
                  const activeSoundType =
                    customList.length > 0 && (!settings.soundType || settings.soundType === 'chime')
                      ? customList[customList.length - 1].id
                      : settings.soundType || 'chime';
                  syncSoundSettingsEverywhere(
                    customList,
                    activeSoundType,
                    nextVol,
                    Number(settings.autoRefreshInterval ?? 60),
                    false
                  );
                }}
                onTouchEnd={(e) => {
                  const nextVol = Number(e.currentTarget.value);
                  const customList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
                  const activeSoundType =
                    customList.length > 0 && (!settings.soundType || settings.soundType === 'chime')
                      ? customList[customList.length - 1].id
                      : settings.soundType || 'chime';
                  syncSoundSettingsEverywhere(
                    customList,
                    activeSoundType,
                    nextVol,
                    Number(settings.autoRefreshInterval ?? 60),
                    false
                  );
                }}
                className="w-full accent-brand-600 cursor-pointer"
              />
            </div>

            {/* Bildirim Sesi Tekrarlama Aralığı */}
            <div className="space-y-2.5 pt-3 border-t border-stone-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-stone-800 block">
                  Bildirim Sesi Tekrarlama Aralığı (Sipariş Onaylanana Kadar)
                </label>
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {Number(settings.autoRefreshInterval ?? 60) === 0
                    ? 'Aktif: Tek Sefer Çal (Tekrarlama Yok)'
                    : `Aktif Aralık: ${Number(settings.autoRefreshInterval ?? 60)} Saniyede Bir`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { val: 8, label: '8 Saniyede Bir' },
                  { val: 15, label: '15 Saniyede Bir' },
                  { val: 30, label: '30 Saniyede Bir' },
                  { val: 60, label: '60 Saniyede Bir' },
                  { val: 0, label: 'Tek Sefer Çal (Tekrarlama)' },
                ].map((item) => {
                  const currentInterval = Number(
                    typeof settings.autoRefreshInterval !== 'undefined' ? settings.autoRefreshInterval : 60
                  );
                  const isSelected = currentInterval === item.val;
                  return (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => {
                        handleChange('autoRefreshInterval', item.val);
                        const customList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
                        const activeSoundType =
                          customList.length > 0 && (!settings.soundType || settings.soundType === 'chime')
                            ? customList[customList.length - 1].id
                            : settings.soundType || 'chime';
                        syncSoundSettingsEverywhere(
                          customList,
                          activeSoundType,
                          settings.soundVolume || 80,
                          item.val,
                          false
                        );
                        if (showToast) {
                          showToast(
                            item.val > 0
                              ? `Bildirim sesi aralığı ${item.val} saniyede bir olarak ayarlandı!`
                              : 'Bildirim sesi yalnızca 1 kez çalacak şekilde ayarlandı!',
                            'success'
                          );
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-stone-900 text-white font-bold border-stone-900 shadow-xs ring-2 ring-stone-900/15'
                          : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200 font-medium'
                      }`}
                    >
                      {isSelected && <i className="fa-solid fa-check mr-1.5 text-amber-400"></i>}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEKME 3: FİŞ VE ADİSYON AYARLARI */}
      {activeSubTab === 'receipt' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-receipt text-stone-600"></i>
                Termal Yazıcı &amp; Adisyon Fişi Şablonu
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Müşteri adisyon fişinde ve paket teslim tutanağında yazdırılacak şube başlık ve alt notları.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block">Fiş Başlığı (İşletme Adı)</label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => handleChange('storeName', e.target.value)}
                  className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block">Şube İletişim Telefonu</label>
                <input
                  type="text"
                  value={settings.storePhone}
                  onChange={(e) => handleChange('storePhone', e.target.value)}
                  className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block">Şube Adresi</label>
                <input
                  type="text"
                  value={settings.storeAddress}
                  onChange={(e) => handleChange('storeAddress', e.target.value)}
                  className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block">Fiş Alt Bilgi Notu</label>
                <textarea
                  rows="2"
                  value={settings.receiptFooter}
                  onChange={(e) => handleChange('receiptFooter', e.target.value)}
                  className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 font-medium text-stone-900 focus:outline-none focus:border-stone-400"
                ></textarea>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-stone-100 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={settings.showPricesOnReceipt}
                  onChange={(e) => handleChange('showPricesOnReceipt', e.target.checked)}
                  className="rounded border-stone-300 text-brand-600 focus:ring-0 cursor-pointer"
                />
                <span>Fiş üzerinde ürün birim ve toplam fiyatlarını yazdır</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={settings.showPhoneOnReceipt}
                  onChange={(e) => handleChange('showPhoneOnReceipt', e.target.checked)}
                  className="rounded border-stone-300 text-brand-600 focus:ring-0 cursor-pointer"
                />
                <span>Müşteri telefon numarasını fişte göster</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SEKME 4: SİSTEM VE YEDEKLEME */}
      {activeSubTab === 'system' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-cloud-arrow-down text-emerald-600"></i>
                Veri Tabanı &amp; Sistem Yedeği Al
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Menü ürünleri, roller, yetkiler ve güncel panel yapılandırmasını tek tıkla JSON formatında bilgisayarınıza yedekleyin.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-stone-900 block">Tam Sistem Yedek Dosyası (.json)</span>
                <span className="text-[11px] text-stone-500 block">
                  Tüm ayar ve veritabanı kayıtlarını içerir.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <i className="fa-solid fa-download"></i>
                <span>Yedek İndir (.json)</span>
              </button>
            </div>
          </div>

          {/* Fabrika Ayarlarına Dönüş */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-rose-200/80 shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <i className="fa-solid fa-arrow-rotate-left text-rose-600"></i>
                Panel Ayarlarını Varsayılana Döndür
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Yazı boyutu, ses ve fiş ayarlarını fabrika varsayılan ayarlarına geri döndürür. Ürün ve sipariş kayıtlarınız silinmez.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (confirm('Panel ayarları varsayılan fabrika ayarlarına döndürülsün mü?')) {
                  setSettings(DEFAULT_ADMIN_SETTINGS);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('sandwich_admin_settings', JSON.stringify(DEFAULT_ADMIN_SETTINGS));
                  }
                  if (onSaveSettings) onSaveSettings(DEFAULT_ADMIN_SETTINGS);
                  alert('Ayarlar varsayılan hale getirildi.');
                }
              }}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Varsayılan Ayarlara Sıfırla
            </button>
          </div>
        </div>
      )}

      {/* SEKME: MÜŞTERİ SAYFASI & VİTRİN DÜZENLERİ */}
      {activeSubTab === 'site_content' && (
        <div className="w-full">
          <SiteContentEditorTab />
        </div>
      )}

      {/* SEKME: POSTGRESQL 16 ORM & SİBER GÜVENLİK MERKEZİ */}
      {activeSubTab === 'api' && (
        <div className="w-full">
          <MysqlOrmTab showToast={showToast} />
        </div>
      )}
    </div>
  );
}

