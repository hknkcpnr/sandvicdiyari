'use client';

import { useState, useEffect, useRef } from 'react';
import ActivityLogsTab from './ActivityLogsTab';
import ThemeColorPicker from './ThemeColorPicker';
import SiteContentEditorTab from './SiteContentEditorTab';
import { playKitchenBellSound } from './KitchenPosBell';
import { DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS } from '@/lib/notificationDefaults';
import { BANNER_THEMES } from '@/components/CustomerAnnouncementBanner';
import { getOrderPauseState } from '@/lib/orderPause';
import { printTestThermalReceipt } from '@/lib/thermalReceipt';

export const DEFAULT_ADMIN_SETTINGS = {
  courierModuleEnabled: false,
  ordersPaused: false,
  ordersPausedUntil: null,
  ordersPausedReason: '',
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
  autoPrintOnApproval: true,
  receiptPaperWidth: '80mm',
  receiptCopies: 1,
  receiptShowNotes: true,
};

const SETTINGS_PAGES = {
  appearance: {
    id: 'appearance',
    title: 'Arayüz, Yazı Boyutu & Kurye Görünürlüğü',
    badge: 'Arayüz & Kurye Modülü',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: 'fa-solid fa-sliders',
    desc: 'Panel metinleri, kuryeyi sistemden tamamen görünmez yapma ayarı, sipariş kartları ve arayüz düzenini yönetin.',
  },
  site_content: {
    id: 'site_content',
    title: 'Müşteri Sayfası & Vitrin Düzenleri',
    badge: 'Vitrin & Sayfa Tasarımı',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: 'fa-solid fa-paintbrush',
    desc: 'Müşteri ana sayfasındaki manşet slider, afiş, kampanyalar ve vitrin bölümlerini özelleştirin.',
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
    title: 'Sistem, Depolama & Veri Yedekleme',
    badge: 'Excel & Depolama Yedeği',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: 'fa-solid fa-hard-drive',
    desc: 'Sistemin diskte kapladığı alan, çok sayfalı Excel (.xlsx) yedeği ve tam sistem arşivlemesi.',
  },
  logs: {
    id: 'logs',
    title: 'Kullanıcı İşlem & Güvenlik Logları',
    badge: 'Canlı İşlem Takibi',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: 'fa-solid fa-clock-rotate-left',
    desc: 'Hangi personelin ne zaman sipariş sildiği, durum güncellediği, ürün veya fiyat değiştirdiği tüm kullanıcı işlem geçmişi.',
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
  const [soundViewMode, setSoundViewMode] = useState('pos_sound'); // 'pos_sound' | 'customer_notif'
  const [showUrlSoundInput, setShowUrlSoundInput] = useState(false);

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

  // Cümle Tamamlayıcı Ses Kaydı (Suffix Ses) State'leri
  const [suffixAudioUrl, setSuffixAudioUrl] = useState(null);
  const [suffixAudioName, setSuffixAudioName] = useState('');
  const [suffixUploadError, setSuffixUploadError] = useState('');
  const [isPlayingSuffixPreview, setIsPlayingSuffixPreview] = useState(false);
  const suffixFileInputRef = useRef(null);

  // Sunucu Disk & Depolama Bilgisi State'leri
  const [storageInfo, setStorageInfo] = useState(null);
  const [loadingStorage, setLoadingStorage] = useState(false);

  const fetchStorageInfo = async () => {
    setLoadingStorage(true);
    try {
      const res = await fetch('/api/admin/storage', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.data) {
        setStorageInfo(data.data);
      }
    } catch (e) {
      console.warn('Storage fetch error:', e);
    } finally {
      setLoadingStorage(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'system') {
      fetchStorageInfo();
    }
  }, [activeSubTab]);

  // Ses Düzeyi Canlı Güncelleme & Anında Kaydetme Fonksiyonu
  const handleUpdateVolume = (newVol, andPlayTest = false) => {
    const cleanVol = Math.max(10, Math.min(100, Math.round(newVol)));
    handleChange('soundVolume', cleanVol);
    try {
      localStorage.setItem('sd_bell_volume', String(cleanVol / 100));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sd_sound_settings_changed', { detail: { volume: cleanVol / 100 } }));
    } catch {}

    const customList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
    const activeSoundType =
      customList.length > 0 && (!settings.soundType || settings.soundType === 'chime')
        ? customList[customList.length - 1].id
        : settings.soundType || 'chime';

    syncSoundSettingsEverywhere(
      customList,
      activeSoundType,
      cleanVol,
      Number(settings.autoRefreshInterval ?? 60),
      false
    );

    if (andPlayTest) {
      handlePlaySoundTest(activeSoundType, customList);
    }
  };

  useEffect(() => {
    try {
      const savedInt = localStorage.getItem('sd_bell_interval');
      const parsedLocalInt = savedInt !== null && savedInt !== '' ? parseInt(savedInt, 10) : null;

      const savedCustom = localStorage.getItem('sd_custom_bell_sounds');
      const parsedCustom = savedCustom ? JSON.parse(savedCustom) : null;

      const savedSuffix = localStorage.getItem('sd_suffix_audio');
      if (savedSuffix) setSuffixAudioUrl(savedSuffix);
      const savedSuffixName = localStorage.getItem('sd_suffix_audio_name');
      if (savedSuffixName) setSuffixAudioName(savedSuffixName);

      let savedCourier = null;
      try {
        const rawAdmin = localStorage.getItem('sandwich_admin_settings');
        if (rawAdmin) {
          const parsedAdmin = JSON.parse(rawAdmin);
          if (typeof parsedAdmin?.courierModuleEnabled === 'boolean') {
            savedCourier = parsedAdmin.courierModuleEnabled;
          }
        }
        const sdCourier = localStorage.getItem('sd_courier_module_enabled');
        if (sdCourier !== null) {
          savedCourier = sdCourier === 'true';
        }
      } catch {}

      setSettings((prev) => ({
        ...prev,
        ...(savedCourier !== null ? { courierModuleEnabled: savedCourier } : {}),
        ...(Array.isArray(parsedCustom) && parsedCustom.length > 0 && (!Array.isArray(prev.customSounds) || prev.customSounds.length === 0)
          ? { customSounds: parsedCustom }
          : {}),
        ...(parsedLocalInt !== null && !Number.isNaN(parsedLocalInt) && parsedLocalInt >= 0
          ? { autoRefreshInterval: parsedLocalInt }
          : {})
      }));
    } catch {}

    // Load admin settings from server (courierModuleEnabled etc.)
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j?.data) {
          const courierVal = j.data.courierModuleEnabled === true;
          setSettings((prev) => ({ ...prev, courierModuleEnabled: courierVal }));
          try {
            const raw = localStorage.getItem('sandwich_admin_settings');
            const parsed = raw ? JSON.parse(raw) : {};
            localStorage.setItem('sandwich_admin_settings', JSON.stringify({ ...parsed, courierModuleEnabled: courierVal }));
            localStorage.setItem('sd_courier_module_enabled', String(courierVal));
          } catch {}
        }
      })
      .catch(() => {});

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
          if (typeof j.data.settings.suffixAudioUrl !== 'undefined') {
            setSuffixAudioUrl(j.data.settings.suffixAudioUrl || null);
            if (j.data.settings.suffixAudioUrl) {
              try { localStorage.setItem('sd_suffix_audio', j.data.settings.suffixAudioUrl); } catch {}
            } else {
              try { localStorage.removeItem('sd_suffix_audio'); } catch {}
            }
          }
          if (j.data.settings.suffixAudioName) {
            setSuffixAudioName(j.data.settings.suffixAudioName);
            try { localStorage.setItem('sd_suffix_audio_name', j.data.settings.suffixAudioName); } catch {}
          }
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

  // Cümle Tamamlayıcı Ses Kaydı Seçimi (.mp3 / .wav)
  const handleSuffixFileSelect = (e) => {
    setSuffixUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      setSuffixUploadError('Lütfen geçerli bir ses dosyası (.mp3, .wav, .ogg, .m4a) seçin.');
      return;
    }

    if (file.size > 3.5 * 1024 * 1024) {
      setSuffixUploadError('Ses dosyası boyutu en fazla 3.5 MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl.startsWith('data:')) {
        const cleanName = file.name.slice(0, 60);
        setSuffixAudioUrl(dataUrl);
        setSuffixAudioName(cleanName);
        if (suffixFileInputRef.current) suffixFileInputRef.current.value = '';

        try {
          localStorage.setItem('sd_suffix_audio', dataUrl);
          localStorage.setItem('sd_suffix_audio_name', cleanName);
          localStorage.setItem('sd_pos_bell_updated', String(Date.now()));
        } catch {}

        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_settings',
              settings: {
                suffixAudioUrl: dataUrl,
                suffixAudioName: cleanName
              }
            })
          });
          if (showToast) {
            showToast('Cümle tamamlayıcı ses kaydı başarıyla kaydedildi! 🎙️', 'success');
          }
        } catch (err) {
          console.error('Tamamlayıcı ses kaydedilemedi:', err);
        }
      }
    };
    reader.onerror = () => {
      setSuffixUploadError('Ses dosyası okunamadı.');
    };
    reader.readAsDataURL(file);
  };

  // Cümle Tamamlayıcı Sesi Kaldır
  const handleRemoveSuffixAudio = async () => {
    setSuffixAudioUrl(null);
    setSuffixAudioName('');
    if (suffixFileInputRef.current) suffixFileInputRef.current.value = '';

    try {
      localStorage.removeItem('sd_suffix_audio');
      localStorage.removeItem('sd_suffix_audio_name');
      localStorage.setItem('sd_pos_bell_updated', String(Date.now()));
    } catch {}

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          settings: {
            suffixAudioUrl: null,
            suffixAudioName: null
          }
        })
      });
      if (showToast) {
        showToast('Cümle tamamlayıcı ses kaydı kaldırıldı.', 'info');
      }
    } catch {}
  };

  // Cümle Tamamlayıcı Ses Testi (Önizleme Dinletisi)
  const handlePlaySuffixTest = () => {
    if (!suffixAudioUrl) return;
    try {
      setIsPlayingSuffixPreview(true);
      const audio = new Audio(suffixAudioUrl);
      audio.volume = (settings.soundVolume || 80) / 100;
      audio.onended = () => setIsPlayingSuffixPreview(false);
      audio.onerror = () => setIsPlayingSuffixPreview(false);
      audio.play().catch(() => setIsPlayingSuffixPreview(false));
    } catch {
      setIsPlayingSuffixPreview(false);
    }
  };

  // Kurye İşlemleri & Kurye Portalı Aç / Kapat
  const handleCourierModuleToggle = async (enabled) => {
    const nextSettings = { ...settings, courierModuleEnabled: enabled };
    setSettings(nextSettings);

    try {
      localStorage.setItem('sandwich_admin_settings', JSON.stringify(nextSettings));
      localStorage.setItem('sd_courier_module_enabled', String(enabled));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sd_courier_module_updated', { detail: { enabled } }));
    } catch {}

    if (onSaveSettings) {
      onSaveSettings(nextSettings);
    }

    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierModuleEnabled: enabled })
      });
      if (showToast) {
        showToast(
          enabled
            ? 'Kurye işlemleri ve kurye modülü açıldı! (Tüm sistemde aktif)'
            : 'Kurye işlemleri kapatıldı. Kurye özellikleri hiçbir yerde gözükmeyecek.',
          enabled ? 'success' : 'info'
        );
      }
    } catch (e) {
      console.warn('Courier settings API save error:', e);
    }
  };

  // Sipariş Alımını Geçici Durdurma / Açma (Yoğunluk Kontrolü)
  const handleOrderPauseToggle = async (minutes) => {
    const isPausing = minutes !== null;
    const nextSettings = {
      ...settings,
      ordersPaused: isPausing,
      ordersPausedUntil: isPausing && minutes > 0 ? new Date(Date.now() + minutes * 60000).toISOString() : null,
      ordersPausedReason: isPausing ? 'Yoğunluk nedeniyle kısa bir süre sipariş alamıyoruz.' : ''
    };
    setSettings(nextSettings);

    try {
      localStorage.setItem('sandwich_admin_settings', JSON.stringify(nextSettings));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sd_order_pause_updated', { detail: { paused: isPausing } }));
    } catch {}

    if (onSaveSettings) onSaveSettings(nextSettings);

    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordersPaused: isPausing,
          ordersPausedUntil: nextSettings.ordersPausedUntil,
          ordersPausedReason: nextSettings.ordersPausedReason
        })
      });
      if (showToast) {
        showToast(
          isPausing
            ? minutes > 0
              ? `Sipariş alımı ${minutes} dakika durduruldu.`
              : 'Sipariş alımı siz açana kadar durduruldu.'
            : 'Sipariş alımı tekrar açıldı (Normal operasyon).',
          isPausing ? 'info' : 'success'
        );
      }
    } catch (e) {
      console.warn('Order pause save error:', e);
    }
  };

  // Yedek İndirme (Excel .xlsx & JSON)
  const [downloadingFormat, setDownloadingFormat] = useState(null); // 'excel' | 'json' | null

  const handleDownloadBackup = async (format = 'excel') => {
    setDownloadingFormat(format);
    try {
      const res = await fetch(`/api/admin/backup?format=${format}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Sunucu yedekleme dosyasını oluşturamadı (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const ext = format === 'excel' ? 'xlsx' : 'json';
      const fileName = `Sandvic_Diyari_Sistem_Yedek_${new Date().toISOString().slice(0, 10)}.${ext}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (showToast) {
        showToast(
          format === 'excel'
            ? 'Detaylı Excel (.xlsx) sistem yedeği başarıyla indirildi! 📊'
            : 'JSON veritabanı yedeği başarıyla indirildi! 💾',
          'success'
        );
      }
    } catch (err) {
      alert('Yedek dosyası indirilemedi: ' + err.message);
    } finally {
      setDownloadingFormat(null);
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
              <option value="appearance">🎨 Arayüz & Renk</option>
              <option value="site_content">🖼️ Vitrin Tasarımı</option>
              <option value="sound">🔔 Ses & Bildirim</option>
              <option value="receipt">🧾 Fiş Baskı</option>
              <option value="system">💾 Depolama & Yedek</option>
              <option value="logs">📜 İşlem Logları</option>
            </select>
          </div>

          {activeSubTab !== 'logs' && activeSubTab !== 'site_content' && (
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

      {/* SEKME 1: YAZI BOYUTU VE ARAYÜZ ERİŞİLEBİLİRLİĞİ (MİNİMAL TEK EKRAN) */}
      {activeSubTab === 'appearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Sol: Yazı Boyutu Seçimi */}
          <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-font text-stone-600"></i>
                Yazı Boyutu
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Paneldeki metin ve sipariş kartlarının okunabilirlik boyutu.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'small',
                  label: 'Küçük',
                  desc: 'Ekranda daha fazla satır gösterir.',
                  badge: 'Kompakt',
                },
                {
                  id: 'medium',
                  label: 'Standart',
                  desc: 'Dengeli masaüstü görünümü.',
                  badge: 'Önerilen',
                },
                {
                  id: 'large',
                  label: 'Büyük',
                  desc: 'Dokunmatik & mutfak ekranları için.',
                  badge: 'POS',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handleChange('fontSize', opt.id)}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    settings.fontSize === opt.id
                      ? 'border-brand-600 bg-brand-50/25 shadow-2xs'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-stone-900">{opt.label}</span>
                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-snug">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sağ: Ekran Satır Yoğunluğu */}
          <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-table-cells text-stone-600"></i>
                Liste Yoğunluğu
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Tablolardaki satır aralığı ve iç boşluk düzeni.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  id: 'comfortable',
                  label: 'Standart / Ferah',
                  desc: 'Rahat okunan dengeli satır aralıkları.',
                  icon: 'fa-regular fa-square',
                },
                {
                  id: 'compact',
                  label: 'Sıkışık / Yoğun Liste',
                  desc: 'Tek ekranda maksimum sipariş satırı.',
                  icon: 'fa-solid fa-bars',
                },
              ].map((den) => (
                <div
                  key={den.id}
                  onClick={() => handleChange('density', den.id)}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                    settings.density === den.id
                      ? 'border-brand-600 bg-brand-50/25'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 shrink-0 text-xs">
                    <i className={den.icon}></i>
                  </div>
                  <div>
                    <span className="font-bold text-xs text-stone-900 block">{den.label}</span>
                    <span className="text-[11px] text-stone-500 block leading-tight">
                      {den.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kurye Modülü ve Görünürlük Ayarı (Kuryeyi Sistemden Tamamen Görünmez Yap) */}
          <div className="lg:col-span-12 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-motorcycle text-amber-500"></i>
                  <span>Kurye Modülü ve Görünürlük Ayarı</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Kurye işlemlerini arayüzde görünür tutabilir veya kuryeyi sistemden tamamen görünmez yapabilirsiniz.
                </p>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border self-start sm:self-center ${
                settings.courierModuleEnabled === true
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {settings.courierModuleEnabled === true ? '● Kurye: Açık (Görünür)' : '○ Kurye: Sistemden Tamamen Gizli'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Seçenek 1: Kuryeyi Göster */}
              <div
                onClick={() => handleCourierModuleToggle(true)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                  settings.courierModuleEnabled === true
                    ? 'border-emerald-600 bg-emerald-50/30 shadow-xs ring-1 ring-emerald-500/20'
                    : 'border-stone-200 hover:border-stone-300 bg-white opacity-70'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base ${
                  settings.courierModuleEnabled === true
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  <i className="fa-solid fa-motorcycle"></i>
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-stone-900">Kuryeyi Göster (Standart Operasyon)</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      settings.courierModuleEnabled === true
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {settings.courierModuleEnabled === true ? 'Seçili' : 'Aç'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-snug">
                    Sipariş kartlarında kurye atama alanı, /kurye teslimat portalı, kurye aşama sekmeleri ve anlık kurye takip tabloları sistemde aktif ve görünürdür.
                  </p>
                </div>
              </div>

              {/* Seçenek 2: Kuryeyi Tamamen Görünmez Yap */}
              <div
                onClick={() => handleCourierModuleToggle(false)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                  settings.courierModuleEnabled === false
                    ? 'border-rose-600 bg-rose-50/30 shadow-xs ring-1 ring-rose-500/20'
                    : 'border-stone-200 hover:border-stone-300 bg-white opacity-70'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base ${
                  settings.courierModuleEnabled === false
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  <i className="fa-solid fa-eye-slash"></i>
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-stone-900">Kuryeyi Sistemden Tamamen Görünmez Yap</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      settings.courierModuleEnabled === false
                        ? 'bg-rose-600 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {settings.courierModuleEnabled === false ? 'Seçili' : 'Gizle'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-snug">
                    Kurye portalı, sipariş kurye atama kutuları, kurye filtreleri ve aşamaları tüm arayüzden tamamen gizlenir. Siparişler doğrudan mutfaktan teslim edildi durumuna alınır.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sipariş Alımını Geçici Durdurma / Acil Yoğunluk Kartı */}
          <div className="lg:col-span-12 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-hourglass-half text-amber-500"></i>
                  <span>Sipariş Alımını Geçici Durdurma (Acil Yoğunluk &amp; Mola)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Mutfakta aşırı yığılma olduğunda veya malzeme tükendiğinde sipariş alımını belirli bir süre durdurabilirsiniz.
                </p>
              </div>
              {(() => {
                const pauseInfo = getOrderPauseState(settings);
                return (
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border self-start sm:self-center ${
                    pauseInfo.paused
                      ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {pauseInfo.paused
                      ? pauseInfo.remainingMinutes > 0
                        ? `● Sipariş Alımı Durduruldu (${pauseInfo.remainingMinutes} dk kaldı)`
                        : '● Sipariş Alımı Durduruldu (Süresiz)'
                      : '● Sipariş Alımı Açık (Normal)'}
                  </span>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOrderPauseToggle(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  !getOrderPauseState(settings).paused
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                }`}
              >
                <i className="fa-solid fa-circle-play mr-1.5"></i>
                Siparişe Açık (Normal)
              </button>

              <button
                type="button"
                onClick={() => handleOrderPauseToggle(15)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 hover:text-rose-700 border border-stone-200 hover:border-rose-300 text-stone-700 transition-all cursor-pointer shadow-2xs"
              >
                <i className="fa-solid fa-clock mr-1.5 text-amber-500"></i>
                15 Dakika Durdur
              </button>

              <button
                type="button"
                onClick={() => handleOrderPauseToggle(30)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 hover:text-rose-700 border border-stone-200 hover:border-rose-300 text-stone-700 transition-all cursor-pointer shadow-2xs"
              >
                <i className="fa-solid fa-clock mr-1.5 text-amber-500"></i>
                30 Dakika Durdur
              </button>

              <button
                type="button"
                onClick={() => handleOrderPauseToggle(60)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 hover:text-rose-700 border border-stone-200 hover:border-rose-300 text-stone-700 transition-all cursor-pointer shadow-2xs"
              >
                <i className="fa-solid fa-clock mr-1.5 text-amber-500"></i>
                1 Saat Durdur
              </button>

              <button
                type="button"
                onClick={() => handleOrderPauseToggle(0)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 hover:text-rose-700 border border-stone-200 hover:border-rose-300 text-stone-700 transition-all cursor-pointer shadow-2xs"
              >
                <i className="fa-solid fa-hand mr-1.5 text-rose-500"></i>
                Süresiz Durdur (Ben Açana Kadar)
              </button>
            </div>
          </div>

          {/* Arayüz Renk Teması & Palet Seçenekleri */}
          <div className="lg:col-span-12 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-palette text-amber-500"></i>
                  <span>Arayüz Renk Teması & Palet Seçenekleri</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Restoran paneli ve butonların vurgu rengini dilediğiniz gibi özelleştirin.
                </p>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200 self-start sm:self-center">
                7 Farklı Renk Paleti
              </span>
            </div>
            <ThemeColorPicker variant="grid" />
          </div>
        </div>
      )}

      {/* SEKME 2: SES VE BİLDİRİM AYARLARI (MİNİMAL 2 SEKMELİ YAPI) */}
      {activeSubTab === 'sound' && (
        <div className="space-y-4">
          {/* ÜST MİNİMAL ALT-SEKME SEÇİCİ */}
          <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSoundViewMode('pos_sound')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  soundViewMode === 'pos_sound'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <i className="fa-solid fa-volume-high text-amber-400"></i>
                <span>Sipariş &amp; Panel Ses Ayarları</span>
              </button>

              <button
                type="button"
                onClick={() => setSoundViewMode('customer_notif')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  soundViewMode === 'customer_notif'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <i className="fa-solid fa-bullhorn text-emerald-400"></i>
                <span>Müşteri Bildirimleri &amp; Duyuru Bandı</span>
              </button>
            </div>

            {soundViewMode === 'pos_sound' && (
              <div className="flex items-center gap-2 pr-1">
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
                  className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <i className="fa-solid fa-upload"></i>
                  <span>+ Cihazdan Ses Yükle (.mp3 / .wav)</span>
                </button>
              </div>
            )}
          </div>

          {/* GÖRÜNÜM 1: SİPARİŞ & PANEL SES AYARLARI (MİNİMAL TEK KART, 2 SÜTUN) */}
          {soundViewMode === 'pos_sound' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              {/* Başlık & Aç/Kapa */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                    <i className="fa-solid fa-bell"></i>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-stone-900">
                        Çoklu Sipariş (1+ Sipariş) &amp; Panel Bildirim Sesi
                      </h3>
                      <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {Number(settings.autoRefreshInterval ?? 60) === 0
                          ? 'Tek Sefer Çal'
                          : `${Number(settings.autoRefreshInterval ?? 60)} Saniyede Bir`}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      <strong>1 adet</strong> üründe menünün kendi sesi; <strong>1&apos;in üzerinde (çoklu)</strong> siparişte buradaki seçili ses çalar.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleChange('soundEnabled', !settings.soundEnabled)}
                  title={settings.soundEnabled ? 'Sesli Uyarı Açık' : 'Sesli Uyarı Kapalı'}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    settings.soundEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition ${
                      settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 2 Sütunlu Minimal İçerik: Sol (Ses Seçimi) - Sağ (Süre & Ses Seviyesi) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* SOL SÜTUN (7 birim): SES LİSTESİ */}
                <div className="lg:col-span-7 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800">
                      Bildirim Sesi Seçin
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowUrlSoundInput((prev) => !prev)}
                      className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-link text-[10px]"></i>
                      <span>{showUrlSoundInput ? 'Link Alanını Gizle' : 'Link (URL) ile Ekle'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'chime', label: '🔔 Çift Tonlu Çan', desc: 'Melodik & Yumuşak', isBuiltIn: true },
                      { id: 'bell', label: '🎵 Klasik Zil', desc: 'Net ve Yüksek Ton', isBuiltIn: true },
                      { id: 'beep', label: '🚨 Dijital Bip', desc: 'Kısa & Hızlı Uyarı', isBuiltIn: true },
                      ...(Array.isArray(settings.customSounds) ? settings.customSounds : []),
                    ].map((s) => {
                      const isActiveSound = settings.soundType === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            const currentList = Array.isArray(settings.customSounds) ? settings.customSounds : [];
                            syncSoundSettingsEverywhere(
                              currentList,
                              s.id,
                              settings.soundVolume || 80,
                              Number(settings.autoRefreshInterval ?? 60),
                              false
                            );
                            handlePlaySoundTest(s.id, currentList);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isActiveSound
                              ? 'border-stone-900 bg-amber-50/50 font-bold text-stone-900 ring-1 ring-stone-900/20'
                              : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isActiveSound ? 'bg-emerald-500' : 'bg-stone-300'
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="text-xs block truncate">
                                {s.isBuiltIn ? s.label : `🎶 ${s.label}`}
                              </span>
                              <span className="text-[10px] text-stone-400 font-normal block truncate">
                                {s.desc || 'Özel Bildirim Sesi'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlaySoundTest(s.id);
                              }}
                              className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] cursor-pointer"
                              title="Dinle"
                            >
                              <i className="fa-solid fa-play"></i>
                            </button>
                            {!s.isBuiltIn && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomSound(s.id, e)}
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] cursor-pointer"
                                title="Sil"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* İsteğe Bağlı Minimal Link (URL) Ekleme Satırı */}
                  {showUrlSoundInput && (
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        value={newSoundLabel}
                        onChange={(e) => setNewSoundLabel(e.target.value)}
                        placeholder="Ses Adı"
                        className="sm:col-span-4 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-900"
                      />
                      <input
                        type="text"
                        value={newSoundUrl}
                        onChange={(e) => setNewSoundUrl(e.target.value)}
                        placeholder="https://.../zil.mp3"
                        className="sm:col-span-5 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-stone-700"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSound}
                        className="sm:col-span-3 bg-stone-900 hover:bg-black text-white font-bold py-1.5 px-2.5 rounded-lg text-xs cursor-pointer"
                      >
                        + Ekle
                      </button>
                    </div>
                  )}

                  {soundUploadError && (
                    <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>{soundUploadError}</span>
                    </p>
                  )}
                </div>

                {/* SAĞ SÜTUN (5 birim): TEKRARLAMA SÜRESİ & SES DÜZEYİ */}
                <div className="lg:col-span-5 bg-stone-50/80 border border-stone-200/90 rounded-2xl p-4 space-y-4">
                  {/* 1. Tekrarlama Aralığı */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <i className="fa-solid fa-clock-rotate-left text-amber-600"></i>
                        <span>Tekrarlama Aralığı</span>
                      </label>
                      <span className="text-[10px] font-bold text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded-full">
                        Sipariş onaylanana dek
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-1.5">
                      {[
                        { val: 8, label: '8 Saniye' },
                        { val: 15, label: '15 Saniye' },
                        { val: 30, label: '30 Saniye' },
                        { val: 60, label: '60 Saniye' },
                        { val: 0, label: 'Tek Sefer' },
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
                              try {
                                localStorage.setItem('sd_bell_interval', String(item.val));
                                window.dispatchEvent(new Event('storage'));
                                window.dispatchEvent(new CustomEvent('sd_sound_settings_changed', { detail: { interval: item.val } }));
                              } catch {}
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
                                    ? `Bildirim sesi aralığı ${item.val} saniye yapıldı!`
                                    : 'Bildirim sesi yalnızca 1 kez çalacak!',
                                  'success'
                                );
                              }
                            }}
                            className={`px-2 py-2 rounded-xl text-xs transition-all cursor-pointer border text-center ${
                              isSelected
                                ? 'bg-stone-900 text-white font-bold border-stone-900 shadow-2xs'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 font-medium'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Ses Seviyesi (Özel Tasarım, Hassas Butonlar & Presetler) */}
                  <div className="space-y-3 pt-3 border-t border-stone-200/80">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${
                          (settings.soundVolume || 80) <= 20
                            ? 'fa-volume-low text-stone-500'
                            : (settings.soundVolume || 80) <= 60
                            ? 'fa-volume-low text-amber-600'
                            : 'fa-volume-high text-brand-600'
                        }`}></i>
                        <span className="font-bold text-stone-800">
                          Ses Düzeyi: <strong className="text-brand-600 font-black">%{settings.soundVolume || 80}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* -5 Azalt */}
                        <button
                          type="button"
                          onClick={() => handleUpdateVolume(Math.max(10, (settings.soundVolume || 80) - 5))}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 font-bold flex items-center justify-center text-xs cursor-pointer shadow-2xs transition-colors"
                          title="Sesi %5 Azalt"
                        >
                          <i className="fa-solid fa-minus text-[10px]"></i>
                        </button>

                        {/* +5 Artır */}
                        <button
                          type="button"
                          onClick={() => handleUpdateVolume(Math.min(100, (settings.soundVolume || 80) + 5))}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 font-bold flex items-center justify-center text-xs cursor-pointer shadow-2xs transition-colors"
                          title="Sesi %5 Artır"
                        >
                          <i className="fa-solid fa-plus text-[10px]"></i>
                        </button>

                        {/* Test Et */}
                        <button
                          type="button"
                          onClick={() => handlePlaySoundTest()}
                          className="bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ml-1"
                        >
                          <i className="fa-solid fa-play text-[10px] text-brand-600"></i>
                          <span>Test Et</span>
                        </button>
                      </div>
                    </div>

                    {/* Kaydırıcı Bar (Custom Range Slider) */}
                    <div className="relative pt-1 pb-1">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={settings.soundVolume || 80}
                        onChange={(e) => handleUpdateVolume(Number(e.target.value))}
                        className="custom-range w-full cursor-pointer h-2.5 rounded-full"
                        style={{
                          background: `linear-gradient(to right, #d97706 0%, #d97706 ${settings.soundVolume || 80}%, #e7e5e4 ${settings.soundVolume || 80}%, #e7e5e4 100%)`
                        }}
                      />
                    </div>

                    {/* Hızlı Seçim Butonları (Presetler) */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { val: 20, label: '%20 Düşük' },
                        { val: 50, label: '%50 Orta' },
                        { val: 80, label: '%80 Standart' },
                        { val: 100, label: '%100 Maks.' },
                      ].map((preset) => {
                        const isPresetActive = (settings.soundVolume || 80) === preset.val;
                        return (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => handleUpdateVolume(preset.val, false)}
                            className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all border text-center cursor-pointer ${
                              isPresetActive
                                ? 'bg-brand-600 text-white border-brand-600 shadow-2xs font-black'
                                : 'bg-white hover:bg-stone-100 text-stone-600 border-stone-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* CÜMLE TAMAMLAYICI SES KAYDI (SUFFIX SES) */}
              <div className="pt-4 border-t border-stone-150 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-sm shrink-0">
                      <i className="fa-solid fa-microphone-lines"></i>
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                          Cümle Tamamlayıcı Ses Kaydı (Bitiş Eki)
                        </h4>
                        <span className="text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                          Ürün Sesinden 1 sn Sonra Çalar
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Ürün ses kayıtlarının sonuna ortak bir bitiş ekler (Örn: <em>&quot;1 Adet Tavuk Burger&quot;</em> sesinden 1 saniye sonra <em>&quot;siparişi alındı&quot;</em> ses kaydını oynatır).
                      </p>
                    </div>
                  </div>

                  {/* Butonlar: Cihazdan Yükle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={suffixFileInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a"
                      onChange={handleSuffixFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => suffixFileInputRef.current?.click()}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <i className="fa-solid fa-cloud-arrow-up text-[11px]"></i>
                      <span>{suffixAudioUrl ? 'Sesi Değiştir' : 'Ses Yükle (.mp3 / .wav)'}</span>
                    </button>
                  </div>
                </div>

                {/* Yüklü Ses Önizleme & Aksiyonlar */}
                {suffixAudioUrl ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs shrink-0">
                        <i className="fa-solid fa-check"></i>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-950 truncate">
                            {suffixAudioName || 'Cümle Tamamlayıcı Ses Kaydı'}
                          </span>
                          <span className="text-[10px] bg-white border border-purple-200 text-purple-700 font-bold px-1.5 py-0.5 rounded">
                            Aktif
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-700/80 block truncate">
                          Tekli siparişlerde menü ürün sesi bittikten 1 saniye sonra otomatik oynatılır.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handlePlaySuffixTest}
                        className="bg-white hover:bg-purple-100 text-purple-900 border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                        title="Bitiş Sesini Dinle"
                      >
                        <i className={`fa-solid ${isPlayingSuffixPreview ? 'fa-spinner animate-spin text-purple-600' : 'fa-play text-purple-600 text-[10px]'}`}></i>
                        <span>{isPlayingSuffixPreview ? 'Çalıyor...' : 'Dinle'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveSuffixAudio}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Kaydı Kaldır"
                      >
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                        <span>Kaldır</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-stone-50 border border-dashed border-stone-200 rounded-xl text-xs text-stone-500 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-circle-info text-stone-400"></i>
                      <span>Henüz tamamlama sesi yüklenmedi. Yüklediğinizde tüm ürün seslerinin ardından 1 sn sonra eklenecektir.</span>
                    </div>
                  </div>
                )}

                {suffixUploadError && (
                  <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{suffixUploadError}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* GÖRÜNÜM 2: MÜŞTERİ BİLDİRİMLERİ & DUYURU BANDI (2 SÜTUNLU KOMPAKT YAPI) */}
          {soundViewMode === 'customer_notif' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* SOL KART (6 birim): MÜŞTERİ ZİLİ ANAHTARLARI & ÜST DUYURU BANDI */}
              <div className="lg:col-span-6 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                  <div>
                    <h3 className="text-sm font-extrabold text-stone-900">
                      Müşteri Bildirim Zili &amp; Üst Bant
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Müşteri vitrinindeki bildirim ve duyuru şeridi ayarları
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingCustNotif}
                    onClick={handleSaveCustomerNotifOnly}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <i className={`fa-solid ${isSavingCustNotif ? 'fa-spinner animate-spin' : 'fa-check'}`}></i>
                    <span>Uygula</span>
                  </button>
                </div>

                {/* Kompakt 2x2 Anahtarlar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'enabled', title: 'Bildirim Zili Aktif', icon: 'fa-solid fa-bell' },
                    { key: 'orderStatusNotifications', title: 'Sipariş Durum Bildirimi', icon: 'fa-solid fa-motorcycle' },
                    { key: 'toastEnabled', title: 'Canlı Popup Balonu', icon: 'fa-solid fa-comment-dots' },
                    { key: 'soundEnabled', title: 'Müşteri Bildirim Sesi', icon: 'fa-solid fa-music' }
                  ].map((item) => {
                    const isOn = custNotifSettings[item.key] !== false;
                    return (
                      <div
                        key={item.key}
                        onClick={() => handleCustNotifChange(item.key, !isOn)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isOn
                            ? 'border-emerald-300 bg-emerald-50/40'
                            : 'border-stone-200 bg-stone-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <i className={`${item.icon} text-xs ${isOn ? 'text-emerald-600' : 'text-stone-400'}`}></i>
                          <span className="text-xs font-bold text-stone-800 truncate">{item.title}</span>
                        </div>
                        <span
                          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                            isOn ? 'bg-emerald-600' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              isOn ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Sistem Mesajları Otomatik Silinme Süresi */}
                <div className="pt-3 border-t border-stone-150 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <i className="fa-solid fa-clock-rotate-left text-xs text-indigo-600"></i>
                      <span className="text-xs font-extrabold text-stone-900">
                        Sistem Mesajları Silinme Süresi
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      {Number(custNotifSettings.autoDeleteMinutes ?? 3) === 0
                        ? 'Süresiz / Kalıcı'
                        : `${Number(custNotifSettings.autoDeleteMinutes ?? 3)} Dakika Sonra`}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Müşteri sayfasındaki bildirimler bu süre geçince otomatik silinir / kaybolur.
                  </p>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { val: 1, label: '1 Dk' },
                      { val: 3, label: '3 Dk' },
                      { val: 5, label: '5 Dk' },
                      { val: 10, label: '10 Dk' },
                      { val: 30, label: '30 Dk' },
                      { val: 0, label: 'Kalıcı' }
                    ].map((opt) => {
                      const currentVal = Number(
                        typeof custNotifSettings.autoDeleteMinutes !== 'undefined'
                          ? custNotifSettings.autoDeleteMinutes
                          : 3
                      );
                      const isSelected = currentVal === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => handleCustNotifChange('autoDeleteMinutes', opt.val)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                            isSelected
                              ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                              : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Üst Duyuru Bandı Kompakt Form */}
                <div className="pt-3 border-t border-stone-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-stone-800">
                      Üst Duyuru Bandı
                    </span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={custNotifSettings.showBanner !== false}
                        onChange={(e) => handleCustNotifChange('showBanner', e.target.checked)}
                        className="w-3.5 h-3.5 accent-emerald-600 rounded"
                      />
                      <span>Göster</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={custNotifSettings.bannerType || 'campaign'}
                      onChange={(e) => handleCustNotifChange('bannerType', e.target.value)}
                      className="app-select bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900"
                    >
                      <option value="campaign">🔥 Kampanya</option>
                      <option value="delivery">🛵 Teslimat</option>
                      <option value="info">📢 Duyuru</option>
                      <option value="warning">⚠️ Uyarı</option>
                    </select>

                    <select
                      value={custNotifSettings.bannerActionPage || 'kampanyalar'}
                      onChange={(e) => handleCustNotifChange('bannerActionPage', e.target.value)}
                      className="app-select bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900"
                    >
                      <option value="kampanyalar">Kampanyalar</option>
                      <option value="menu">Menü</option>
                      <option value="iletisim">İletişim</option>
                      <option value="none">Buton Yok</option>
                    </select>

                    <input
                      type="text"
                      value={custNotifSettings.bannerActionLabel || ''}
                      onChange={(e) => handleCustNotifChange('bannerActionLabel', e.target.value)}
                      placeholder="Buton Yazısı"
                      className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={custNotifSettings.bannerTitle || ''}
                      onChange={(e) => handleCustNotifChange('bannerTitle', e.target.value)}
                      placeholder="Kısa Başlık"
                      className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-900"
                    />
                    <input
                      type="text"
                      value={custNotifSettings.bannerText || ''}
                      onChange={(e) => handleCustNotifChange('bannerText', e.target.value)}
                      placeholder="Duyuru mesajı..."
                      className="sm:col-span-2 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-900"
                    />
                  </div>
                </div>
              </div>

              {/* SAĞ KART (6 birim): CANLI DUYURU & KAMPANYA GÖNDER */}
              <div className="lg:col-span-6 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-paper-plane text-indigo-600"></i>
                    <span>Müşterilere Canlı Bildirim Gönder</span>
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Sitedeki tüm ziyaretçi ve üyelerin bildirim ziline anında düşer
                  </p>
                </div>

                <form onSubmit={handlePublishBroadcast} className="space-y-2.5 bg-stone-50 p-3.5 rounded-xl border border-stone-200/80">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      required
                      value={bcastTitle}
                      onChange={(e) => setBcastTitle(e.target.value)}
                      placeholder="Bildirim Başlığı *"
                      className="sm:col-span-6 bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-900"
                    />
                    <select
                      value={bcastType}
                      onChange={(e) => setBcastType(e.target.value)}
                      className="app-select sm:col-span-3 bg-white border border-stone-200 rounded-xl px-2 py-1.5 text-xs font-bold text-stone-900"
                    >
                      <option value="campaign">🎁 Kampanya</option>
                      <option value="info">📢 Duyuru</option>
                      <option value="warning">⚠️ Önemli</option>
                    </select>
                    <select
                      value={bcastTargetPage}
                      onChange={(e) => setBcastTargetPage(e.target.value)}
                      className="app-select sm:col-span-3 bg-white border border-stone-200 rounded-xl px-2 py-1.5 text-xs font-bold text-stone-900"
                    >
                      <option value="kampanyalar">Kampanyalar</option>
                      <option value="menu">Menü</option>
                      <option value="iletisim">İletişim</option>
                      <option value="none">Sayfa Yok</option>
                    </select>
                  </div>

                  <textarea
                    rows={2}
                    required
                    value={bcastMessage}
                    onChange={(e) => setBcastMessage(e.target.value)}
                    placeholder="Bildirim mesajını yazın..."
                    className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs text-stone-900 resize-none"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={bcastAlsoMembers}
                        onChange={(e) => setBcastAlsoMembers(e.target.checked)}
                        className="w-3.5 h-3.5 accent-indigo-600 rounded"
                      />
                      <span>Üyelerin kutusuna da kaydet</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isPublishingBcast}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <i className={`fa-solid ${isPublishingBcast ? 'fa-spinner animate-spin' : 'fa-bullhorn'}`}></i>
                      <span>{isPublishingBcast ? 'Yayınlanıyor...' : 'Yayınla'}</span>
                    </button>
                  </div>
                </form>

                {(custNotifSettings.broadcasts || []).length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
                      Yayındaki Bildirimler ({custNotifSettings.broadcasts.length})
                    </span>
                    <div className="max-h-36 overflow-y-auto divide-y divide-stone-100 border border-stone-200/80 rounded-xl">
                      {custNotifSettings.broadcasts.map((b) => (
                        <div
                          key={b.id}
                          className="px-3 py-2 bg-white hover:bg-stone-50 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900 truncate">{b.title}</p>
                            <p className="text-[11px] text-stone-500 truncate">{b.message}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBroadcast(b.id)}
                            className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg cursor-pointer shrink-0"
                            title="Kaldır"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEKME 3: FİŞ VE ADİSYON AYARLARI */}
      {activeSubTab === 'receipt' && (
        <div className="space-y-4">
          {/* Otomatik Fiş Yazdırma & Termal Donanım Ayarları */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-print text-brand-600 text-base"></i>
                  Xprinter 80mm Termal Yazıcı &amp; Otomatik Fiş
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Sipariş yönetim panelinde sipariş onaylandığında fişin otomatikman Xprinter yazıcıdan çıkmasını yönetin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  printTestThermalReceipt(settings);
                  showToast?.('Test fişi Xprinter yazıcıya gönderildi! 🧾', 'success');
                }}
                className="self-start sm:self-auto bg-stone-900 hover:bg-stone-800 text-white text-xs font-black py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <i className="fa-solid fa-receipt text-amber-400"></i>
                <span>Test Fişi Yazdır (80mm)</span>
              </button>
            </div>

            {/* Otomatik Yazdırma Anahtarı (ÖNE ÇIKAN ÖZELLİK) */}
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-lg shrink-0 mt-0.5 shadow-xs">
                  <i className="fa-solid fa-bolt-lightning"></i>
                </div>
                <div>
                  <span className="text-xs font-black text-stone-900 block flex items-center gap-2">
                    Sipariş Onaylandığında Otomatik Fiş Çıkar
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                      Önerilen (Restoran Modu)
                    </span>
                  </span>
                  <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                    Sipariş yönetim panelinde (veya bildirim modalında) siparişi <strong>"Onayla ve Hazırla"</strong> yaptığınız anda, sisteme bağlı termal yazıcıdan beklemeden fiş otomatik çıkar.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-center">
                <input
                  type="checkbox"
                  checked={settings.autoPrintOnApproval !== false}
                  onChange={(e) => handleChange('autoPrintOnApproval', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Yazıcı Boyut ve Kopya Tercihleri */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <label className="text-xs font-bold text-stone-800 block">Termal Kağıt Genişliği</label>
                <select
                  value={settings.receiptPaperWidth || '80mm'}
                  onChange={(e) => handleChange('receiptPaperWidth', e.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 rounded-lg px-3 py-2 font-bold text-stone-800 focus:outline-none focus:border-stone-500 cursor-pointer"
                >
                  <option value="80mm">80 mm (Standart Xprinter Termal Rulo - Önerilen)</option>
                  <option value="58mm">58 mm (Kompakt Termal Rulo)</option>
                </select>
                <p className="text-[11px] text-stone-500">Fotoğraftaki Xprinter cihazınız standart 80mm genişliktedir.</p>
              </div>

              <div className="space-y-1.5 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <label className="text-xs font-bold text-stone-800 block">Her Siparişte Çıkacak Kopya Adedi</label>
                <select
                  value={settings.receiptCopies || 1}
                  onChange={(e) => handleChange('receiptCopies', Number(e.target.value))}
                  className="w-full text-xs bg-white border border-stone-300 rounded-lg px-3 py-2 font-bold text-stone-800 focus:outline-none focus:border-stone-500 cursor-pointer"
                >
                  <option value={1}>1 Adet (Mutfak / Hazırlık)</option>
                  <option value={2}>2 Adet (1 Mutfak Hazırlık + 1 Kurye / Müşteri Teslim)</option>
                </select>
                <p className="text-[11px] text-stone-500">2 kopya seçildiğinde arka arkaya 2 nüsha fiş basılır.</p>
              </div>
            </div>

            {/* Kiosk Modu Bilgilendirme Kutusu */}
            <div className="bg-stone-900 text-stone-100 rounded-2xl p-4 border border-stone-800">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-400 font-bold shrink-0 mt-0.5">
                  <i className="fa-brands fa-chrome text-base"></i>
                </div>
                <div className="space-y-1 text-xs">
                  <span className="font-extrabold text-white block">
                    Windows Chrome İpucu: Onay Penceresi Olmadan Doğrudan Yazdırma (--kiosk-printing)
                  </span>
                  <p className="text-stone-300 leading-relaxed">
                    Yazdırma penceresi (Ctrl+P onay diyaloğu) hiç açılmadan, fişin Xprinter&apos;dan jet hızında fırlaması için Chrome masaüstü kısayoluna sağ tıklayıp <strong>Özellikler &gt; Hedef</strong> alanının sonuna şu parametreyi ekleyin:
                  </p>
                  <div className="bg-black/60 text-amber-300 font-mono text-[11px] px-3 py-1.5 rounded-lg border border-white/10 select-all inline-block mt-1">
                    --kiosk-printing
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Windows varsayılan yazıcısı olarak <strong>Xprinter</strong> seçildiğinde, sipariş onaylandığında sıfır tıklama ile anında otomatik fiş çıkar.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Fiş Metin ve Başlık İçeriği */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-receipt text-stone-600"></i>
                Fiş Üzerindeki Bilgiler &amp; Metin Şablonu
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
              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={settings.receiptShowNotes !== false}
                  onChange={(e) => handleChange('receiptShowNotes', e.target.checked)}
                  className="rounded border-stone-300 text-brand-600 focus:ring-0 cursor-pointer"
                />
                <span>Müşteri sipariş notunu vurgulu çerçevede bas</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SEKME 4: SİSTEM VE YEDEKLEME */}
      {activeSubTab === 'system' && (
        <div className="space-y-4">
          {/* SİSTEM DEPOLAMA VE DİSK KULLANIM PANELİ */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-hard-drive text-amber-600"></i>
                  <span>Sistem Depolama &amp; Disk Kapasitesi</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Tüm sistemin, veritabanının ve yüklenen dosyaların diskte kapladığı toplam alan (GB / MB) ve sunucu kaynakları.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchStorageInfo}
                disabled={loadingStorage}
                className="self-start sm:self-center px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs border border-stone-200"
              >
                <i className={`fa-solid fa-rotate ${loadingStorage ? 'animate-spin text-amber-600' : 'text-stone-500'}`}></i>
                <span>{loadingStorage ? 'Ölçülüyor...' : 'Şimdi Yenile'}</span>
              </button>
            </div>

            {/* 4 Ana Metrik Kartı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Kart 1: Sunucu Diski */}
              <div className="bg-stone-50/80 border border-stone-200/90 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Sunucu Diski</span>
                  <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-server"></i>
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-stone-900">
                    {storageInfo?.disk?.totalGB ? `${storageInfo.disk.totalGB} GB` : 'Ölçülüyor'}
                  </span>
                  <span className="text-[11px] font-bold text-stone-500">toplam</span>
                </div>
                {storageInfo?.disk && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, storageInfo.disk.usedPercent)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                      <span>Kullanılan: {storageInfo.disk.usedGB} GB (%{storageInfo.disk.usedPercent})</span>
                      <span className="text-emerald-700 font-bold">Boş: {storageInfo.disk.freeGB} GB</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Kart 2: Proje Boyutu */}
              <div className="bg-stone-50/80 border border-stone-200/90 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Sandviç Diyarı Projesi</span>
                  <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-folder-tree"></i>
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-stone-900">
                    {storageInfo?.project?.totalGB ? `${storageInfo.project.totalGB} GB` : 'Ölçülüyor'}
                  </span>
                  <span className="text-[11px] font-bold text-stone-500">
                    ({storageInfo?.project?.totalMB || 0} MB)
                  </span>
                </div>
                {storageInfo?.project?.breakdown && (
                  <div className="pt-1 text-[10px] text-stone-500 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Paketler (node_modules):</span>
                      <strong className="text-stone-800">{storageInfo.project.breakdown.nodeModulesMB} MB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Next.js Build Önbelleği:</span>
                      <strong className="text-stone-800">{storageInfo.project.breakdown.nextBuildMB} MB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Medya &amp; Yüklenenler:</span>
                      <strong className="text-stone-800">{storageInfo.project.breakdown.publicMediaMB} MB</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Kart 3: PostgreSQL Veritabanı */}
              <div className="bg-stone-50/80 border border-stone-200/90 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">PostgreSQL Veritabanı</span>
                  <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-database"></i>
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-indigo-900">
                    {storageInfo?.database?.sizePretty || 'Hesaplanıyor'}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
                    {storageInfo?.database?.connected ? 'Aktif' : 'Bağlı'}
                  </span>
                </div>
                {storageInfo?.database?.counts && (
                  <div className="pt-1 text-[10px] text-stone-500 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Kayıtlı Siparişler:</span>
                      <strong className="text-stone-800">{storageInfo.database.counts.orders} adet</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Menü &amp; Ürünler:</span>
                      <strong className="text-stone-800">{storageInfo.database.counts.products} adet</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Kullanıcılar:</span>
                      <strong className="text-stone-800">{storageInfo.database.counts.users} üye</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Kart 4: Sunucu RAM (Bellek) */}
              <div className="bg-stone-50/80 border border-stone-200/90 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Sunucu RAM (Bellek)</span>
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-microchip"></i>
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-stone-900">
                    {storageInfo?.memory?.totalGB ? `${storageInfo.memory.totalGB} GB` : 'Ölçülüyor'}
                  </span>
                  <span className="text-[11px] font-bold text-stone-500">RAM</span>
                </div>
                {storageInfo?.memory && (
                  <div className="pt-1 text-[10px] text-stone-500 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Kullanılan RAM:</span>
                      <strong className="text-amber-700">{storageInfo.memory.usedGB} GB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Boş RAM:</span>
                      <strong className="text-emerald-700">{storageInfo.memory.freeGB} GB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Node.js Bellek:</span>
                      <strong className="text-stone-800">{storageInfo.memory.processHeapMB} MB</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VERİ TABANI & SİSTEM YEDEĞİ İNDİRME (EXCEL & JSON) */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-cloud-arrow-down text-emerald-600"></i>
                  <span>Veri Tabanı &amp; Sistem Yedeği Al (Excel / JSON)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Tüm siparişleri, menü ürünlerini, müşteri ve personel listelerini Excel (.xlsx) veya teknik JSON formatında güvenle bilgisayarınıza indirin.
                </p>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-center">
                Excel .xlsx Destekli
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* KART 1: EXCEL YEDEĞİ (ÖNCELİKLİ & DETAYLI) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border-2 border-emerald-200 flex flex-col justify-between gap-4 transition-all hover:border-emerald-300 shadow-2xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shadow-2xs">
                      <i className="fa-solid fa-file-excel"></i>
                    </span>
                    <div>
                      <span className="font-extrabold text-sm text-emerald-950 block">Detaylı Excel Yedeği (.xlsx)</span>
                      <span className="text-[10px] font-bold text-emerald-700 block">Önerilen &bull; Çok Sayfalı Çalışma Kitabı</span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed pt-1">
                    Siparişler, ürünler, kayıtlı müşteriler, stok malzemeleri, kasa hareketleri ve yorumları ayrı sekmeler halinde içeren profesyonel Excel tablosu.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadBackup('excel')}
                  disabled={downloadingFormat !== null}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <i className={`fa-solid ${downloadingFormat === 'excel' ? 'fa-spinner animate-spin' : 'fa-file-excel'}`}></i>
                  <span>{downloadingFormat === 'excel' ? 'Excel Hazırlanıyor...' : 'Excel Yedeğini İndir (.xlsx)'}</span>
                </button>
              </div>

              {/* KART 2: TEKNİK JSON YEDEĞİ */}
              <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between gap-4 transition-all hover:border-stone-300 shadow-2xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-stone-800 text-white flex items-center justify-center text-sm font-bold shadow-2xs">
                      <i className="fa-solid fa-code"></i>
                    </span>
                    <div>
                      <span className="font-extrabold text-sm text-stone-900 block">Teknik Veri Tabanı Yedeği (.json)</span>
                      <span className="text-[10px] font-bold text-stone-500 block">Yazılım Geri Yükleme &amp; Arşiv</span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed pt-1">
                    Veritabanı tablolarının ve panel yapılandırma ayarlarının ham JSON dökümünü içerir. İleri düzey teknik yedekleme için uygundur.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadBackup('json')}
                  disabled={downloadingFormat !== null}
                  className="w-full bg-stone-900 hover:bg-black active:scale-98 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <i className={`fa-solid ${downloadingFormat === 'json' ? 'fa-spinner animate-spin' : 'fa-download'}`}></i>
                  <span>{downloadingFormat === 'json' ? 'JSON Hazırlanıyor...' : 'JSON Yedeğini İndir (.json)'}</span>
                </button>
              </div>
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

      {/* SEKME: KULLANICI İŞLEM & GÜVENLİK LOGLARI */}
      {activeSubTab === 'logs' && (
        <div className="w-full">
          <ActivityLogsTab showToast={showToast} currentAdmin={currentAdmin} />
        </div>
      )}
    </div>
  );
}

