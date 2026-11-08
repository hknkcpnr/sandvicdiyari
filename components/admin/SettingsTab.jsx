'use client';

import { useState, useEffect } from 'react';
import UsersRolesTab from './UsersRolesTab';
import MysqlOrmTab from './MysqlOrmTab';
import SiteContentEditorTab from './SiteContentEditorTab';

export const DEFAULT_ADMIN_SETTINGS = {
  fontSize: 'medium', // 'small' | 'medium' | 'large'
  density: 'comfortable', // 'comfortable' | 'compact'
  soundEnabled: true,
  soundType: 'chime', // 'chime' | 'bell' | 'beep'
  soundVolume: 80, // 0 - 100
  autoRefreshInterval: 30, // seconds: 15, 30, 60, 0
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
    title: 'Sesli Sipariş & Bildirim Ayarları',
    badge: 'Ses & Uyarılar',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: 'fa-solid fa-volume-high',
    desc: 'Mutfak ve kasada yeni sipariş düştüğünde çalacak zil sesini ve liste yenilenme periyodunu belirleyin.',
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
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  // Ayar Değişikliği
  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSavedSuccess(false);
  };

  // Ayarları Kaydet
  const handleSave = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sandwich_admin_settings', JSON.stringify(settings));
      } catch (e) {
        console.error('Ayarlar kaydedilemedi:', e);
      }
    }
    if (onSaveSettings) {
      onSaveSettings(settings);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Ses Testi (Web Audio API)
  const handlePlaySoundTest = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = (settings.soundVolume || 80) / 100;

      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = Math.max(0.01, vol * 0.4);

      if (settings.soundType === 'bell') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
        osc.start();
        osc.stop(ctx.currentTime + 0.9);
      } else if (settings.soundType === 'beep') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1100, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // 'chime' (iki tonlu yumuşak çan)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      }
    } catch (e) {
      console.error('Ses testi çalınamadı:', e);
    }
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
              <option value="appearance">🔤 Yazı Boyutu &amp; Arayüz</option>
              <option value="site_content">🎨 Müşteri Sayfası &amp; Vitrin</option>
              <option value="users">🛡️ Kullanıcılar &amp; Roller</option>
              <option value="sound">🔔 Ses &amp; Bildirimler</option>
              <option value="receipt">🧾 Fiş &amp; Adisyon Baskısı</option>
              <option value="system">💾 Yedekleme &amp; Sistem</option>
              <option value="api">🐘 PostgreSQL ORM &amp; Güvenlik</option>
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
                onClick={handleSave}
                className="bg-stone-900 hover:bg-stone-800 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs active:scale-95"
              >
                <i className="fa-solid fa-floppy-disk text-xs"></i>
                <span>Kaydet</span>
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
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Yeni Sipariş Sesli Uyarısı</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Müşteri yeni sipariş oluşturduğunda mutfak/kasa terminalinde sesli alarm çalar.
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
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-800 block">Zil Sesi Tipi</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'chime', label: 'Çift Tonlu Çan', desc: 'Melodik & Yumuşak' },
                  { id: 'bell', label: 'Klasik Zil', desc: 'Net ve Yüksek Ton' },
                  { id: 'beep', label: 'Dijital Bip', desc: 'Kısa & Hızlı Uyarı' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      handleChange('soundType', s.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.soundType === s.id
                        ? 'border-brand-600 bg-brand-50/20 font-bold text-stone-900'
                        : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                    }`}
                  >
                    <span className="text-xs block">{s.label}</span>
                    <span className="text-[10px] text-stone-400 font-normal block">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ses Seviyesi ve Test Butonu */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">Ses Düzeyi: %{settings.soundVolume || 80}</span>
                <button
                  type="button"
                  onClick={handlePlaySoundTest}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-play text-[10px]"></i>
                  <span>Sesi Test Et</span>
                </button>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.soundVolume || 80}
                onChange={(e) => handleChange('soundVolume', Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
            </div>

            {/* Otomatik Liste Yenileme */}
            <div className="space-y-2 pt-3 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-800 block">
                Sipariş Listesi Otomatik Yenileme Periyodu
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { val: 15, label: '15 Saniyede Bir' },
                  { val: 30, label: '30 Saniyede Bir' },
                  { val: 60, label: '60 Saniyede Bir' },
                  { val: 0, label: 'Yalnızca Manuel' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => handleChange('autoRefreshInterval', item.val)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      settings.autoRefreshInterval === item.val
                        ? 'bg-stone-900 text-white font-bold'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
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

