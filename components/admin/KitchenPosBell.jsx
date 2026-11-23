'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

let activeCustomAudio = null;
let activeAudioCtx = null;

// Speak product name in Turkish or play its custom audio file
export function speakProductPreview(productName = '', audioUrl = '', volume = 0.9) {
  try {
    const safeVolume = Math.min(1, Math.max(0.1, Number(volume) || 0.9));
    if (activeCustomAudio) {
      try {
        activeCustomAudio.pause();
        activeCustomAudio.currentTime = 0;
      } catch { }
      activeCustomAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioUrl && typeof audioUrl === 'string' && audioUrl.trim()) {
      const audio = new Audio(audioUrl.trim());
      audio.volume = safeVolume;
      activeCustomAudio = audio;
      audio.play().catch(() => { });
      return;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const cleanName = String(productName || 'Yeni Menü').trim();
      const utterance = new SpeechSynthesisUtterance(`Yeni sipariş: 1 adet ${cleanName}`);
      utterance.lang = 'tr-TR';
      utterance.rate = 1.0;
      utterance.volume = safeVolume;
      const voices = window.speechSynthesis.getVoices?.() || [];
      const trVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
      if (trVoice) utterance.voice = trVoice;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn('Product voice preview error:', e);
  }
}

// Helper: Extract custom product audio URLs from an order or array of orders
export function extractOrderCustomAudios(orderOrOrders, productsList = []) {
  const orderArray = Array.isArray(orderOrOrders)
    ? orderOrOrders
    : orderOrOrders
      ? [orderOrOrders]
      : [];
  const customProductAudios = [];

  for (const ord of orderArray) {
    const rawItems = Array.isArray(ord?.items) ? ord.items : [];
    for (const item of rawItems) {
      if (!item) continue;
      const directItemAudio =
        typeof item.audioUrl === 'string' && item.audioUrl.trim() ? item.audioUrl.trim() : '';

      const itemName = String(item.name || '').trim();
      const candId = item.productId ?? item.id;
      const matchedProd = Array.isArray(productsList)
        ? productsList.find(
          (p) =>
            (candId !== undefined && candId !== null && String(p.id) === String(candId)) ||
            (itemName &&
              String(p.name || '').trim().toLocaleLowerCase('tr-TR') ===
              itemName.toLocaleLowerCase('tr-TR'))
        )
        : null;

      const resolvedAudio =
        directItemAudio ||
        (typeof matchedProd?.audioUrl === 'string' && matchedProd.audioUrl.trim()
          ? matchedProd.audioUrl.trim()
          : '');

      if (resolvedAudio && !customProductAudios.includes(resolvedAudio)) {
        customProductAudios.push(resolvedAudio);
      }
    }
  }

  return customProductAudios;
}

// Helper: Play one or more custom audio URLs sequentially, then optional suffix audio 1s later
function playSequentialProductAudios(audioUrls = [], volume = 0.9, suffixAudioUrl = null) {
  if (!Array.isArray(audioUrls) || audioUrls.length === 0) return false;
  try {
    const safeVolume = Math.min(1, Math.max(0.1, Number(volume) || 0.9));
    if (activeCustomAudio) {
      try {
        activeCustomAudio.pause();
        activeCustomAudio.currentTime = 0;
      } catch { }
      activeCustomAudio = null;
    }
    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch { }
      activeAudioCtx = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const markFinished = () => {
      if (typeof window !== 'undefined') {
        const endTs = Date.now();
        window.__sdLastOrderAudioPlayedAt = endTs;
        try {
          localStorage.setItem('sd_last_order_sound_at', String(endTs));
        } catch {}
      }
    };

    const resolvedSuffix =
      suffixAudioUrl ||
      (typeof window !== 'undefined'
        ? (window.__sdSuffixAudio || localStorage.getItem('sd_suffix_audio'))
        : null);

    const playSuffixIfAny = () => {
      if (resolvedSuffix && typeof resolvedSuffix === 'string' && resolvedSuffix.trim()) {
        setTimeout(() => {
          try {
            const suffixAudio = new Audio(resolvedSuffix.trim());
            suffixAudio.volume = safeVolume;
            activeCustomAudio = suffixAudio;
            suffixAudio.onended = () => {
              markFinished();
            };
            suffixAudio.play().catch((err) => {
              console.warn('Suffix audio playback error:', err);
              markFinished();
            });
          } catch (err) {
            markFinished();
          }
        }, 1000); // Ürün sesinden 1 sn sonra cümleyi tamamlayan ses çalar
      } else {
        markFinished();
      }
    };

    let index = 0;
    const playNext = () => {
      if (index >= audioUrls.length) {
        playSuffixIfAny();
        return;
      }
      const url = audioUrls[index];
      index += 1;
      const audio = new Audio(url);
      audio.volume = safeVolume;
      activeCustomAudio = audio;
      audio.onended = () => {
        if (index < audioUrls.length) {
          playNext();
        } else {
          playSuffixIfAny();
        }
      };
      audio.play().catch((err) => {
        console.warn('Product custom audio playback error:', err);
        if (index < audioUrls.length) {
          playNext();
        } else {
          playSuffixIfAny();
        }
      });
    };

    playNext();
    return true;
  } catch (e) {
    console.warn('Sequential product audio error:', e);
    return false;
  }
}

// Announce an incoming order's product names (plays product custom audio with #1 priority, otherwise Turkish TTS readout)
export function announceOrderItems(order, productsList = [], volume = 0.9, suffixAudioUrl = null) {
  if (!order || typeof window === 'undefined') return;
  try {
    const safeVolume = Math.min(1, Math.max(0.1, Number(volume) || 0.9));
    const customProductAudios = extractOrderCustomAudios(order, productsList);

    const resolvedSuffix =
      suffixAudioUrl ||
      (typeof window !== 'undefined'
        ? (window.__sdSuffixAudio || localStorage.getItem('sd_suffix_audio'))
        : null);

    // 1. TOP PRIORITY: If any ordered product has a custom audio recording uploaded, play it directly
    if (customProductAudios.length > 0) {
      playSequentialProductAudios(customProductAudios, safeVolume, resolvedSuffix);
      return;
    }

    const rawItems = Array.isArray(order.items) ? order.items : [];
    const speechParts = [];

    for (const item of rawItems) {
      const qty = Number(item?.quantity || 1);
      const name = String(item?.name || '').trim();
      if (!name) continue;
      speechParts.push(qty > 1 ? `${qty} adet ${name}` : `1 adet ${name}`);
    }

    // 2. Otherwise announce the ordered product names in Turkish via Web Speech API
    if (speechParts.length > 0 && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const textToSpeak = `Yeni sipariş! ${speechParts.join(', ')}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'tr-TR';
      utterance.rate = 1.0;
      utterance.volume = safeVolume;
      const voices = window.speechSynthesis.getVoices?.() || [];
      const trVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
      if (trVoice) utterance.voice = trVoice;

      utterance.onend = () => {
        if (resolvedSuffix && typeof resolvedSuffix === 'string' && resolvedSuffix.trim()) {
          setTimeout(() => {
            try {
              const suffixAudio = new Audio(resolvedSuffix.trim());
              suffixAudio.volume = safeVolume;
              activeCustomAudio = suffixAudio;
              suffixAudio.onended = () => {
                if (typeof window !== 'undefined') {
                  const endTs = Date.now();
                  window.__sdLastOrderAudioPlayedAt = endTs;
                  try { localStorage.setItem('sd_last_order_sound_at', String(endTs)); } catch {}
                }
              };
              suffixAudio.play().catch(() => {});
            } catch {}
          }, 1000);
        } else if (typeof window !== 'undefined') {
          const endTs = Date.now();
          window.__sdLastOrderAudioPlayedAt = endTs;
          try { localStorage.setItem('sd_last_order_sound_at', String(endTs)); } catch {}
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn('Order voice announcement error:', e);
  }
}

// Web Audio & Custom Audio Kitchen POS Bell Player
export function playKitchenBellSound(soundType = null, volume = 0.85, customSoundsOpt = null) {
  try {
    const safeVolume = Math.min(1, Math.max(0.05, Number(volume) || 0.85));

    // Stop any currently playing custom audio or WebAudio context to prevent overlap
    if (activeCustomAudio) {
      try {
        activeCustomAudio.pause();
        activeCustomAudio.currentTime = 0;
      } catch { }
      activeCustomAudio = null;
    }
    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch { }
      activeAudioCtx = null;
    }

    // 1. Gather custom sounds from argument, window memory cache, and localStorage
    let customList = [];
    if (Array.isArray(customSoundsOpt) && customSoundsOpt.length > 0) {
      customList = customSoundsOpt;
    } else if (typeof window !== 'undefined' && Array.isArray(window.__sdCustomBellSounds) && window.__sdCustomBellSounds.length > 0) {
      customList = window.__sdCustomBellSounds;
    } else if (typeof window !== 'undefined') {
      try {
        const rawCustom = localStorage.getItem('sd_custom_bell_sounds');
        if (rawCustom) {
          const parsed = JSON.parse(rawCustom);
          if (Array.isArray(parsed)) customList = parsed;
        }
      } catch { }
    }

    // 2. Determine the active soundType
    let effectiveType = soundType;
    if (typeof window !== 'undefined') {
      const savedBellSound = localStorage.getItem('sd_bell_sound');
      if (!effectiveType || effectiveType === 'pos_bell' || effectiveType === 'chime') {
        if (savedBellSound) {
          effectiveType = savedBellSound;
        }
      }
    }
    if (!effectiveType) effectiveType = 'pos_bell';

    // 3. Find matching custom sound (or latest custom sound if effectiveType is custom_* / default)
    let matchedCustom = customList.find((s) => s && s.id === effectiveType && s.audioUrl);
    if (
      !matchedCustom &&
      customList.length > 0 &&
      (String(effectiveType).startsWith('custom_') ||
        effectiveType === 'pos_bell' ||
        effectiveType === 'chime')
    ) {
      matchedCustom = customList[customList.length - 1];
    }

    const directAudioUrl =
      matchedCustom?.audioUrl ||
      (typeof effectiveType === 'string' &&
        (effectiveType.startsWith('data:') ||
          effectiveType.startsWith('http://') ||
          effectiveType.startsWith('https://') ||
          effectiveType.startsWith('/'))
        ? effectiveType
        : null);

    if (directAudioUrl) {
      const audio = new Audio(directAudioUrl);
      audio.volume = safeVolume;
      activeCustomAudio = audio;
      audio.onended = () => {
        if (typeof window !== 'undefined') {
          const endTs = Date.now();
          window.__sdLastOrderAudioPlayedAt = endTs;
          try {
            localStorage.setItem('sd_last_order_sound_at', String(endTs));
          } catch {}
        }
      };
      audio.play().catch((err) => {
        console.warn('Custom audio playback error:', err);
      });
      return;
    }

    // If a custom sound ID was requested or custom sounds exist, never fall back to the old built-in synthesizer
    if (String(effectiveType).startsWith('custom_') || customList.length > 0) {
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    activeAudioCtx = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(safeVolume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    if (soundType === 'kitchen_alarm' || soundType === 'beep') {
      // Urgent triple alarm beep for high-noise kitchens: beep-beep-beep
      [0, 0.12, 0.24, 0.45, 0.57, 0.69].forEach((timeOffset, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(idx < 3 ? 980 : 1180, ctx.currentTime + timeOffset);
        g.gain.setValueAtTime(0.35, ctx.currentTime + timeOffset);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.09);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(ctx.currentTime + timeOffset);
        osc.stop(ctx.currentTime + timeOffset + 0.09);
      });
    } else if (soundType === 'classic_dingdong' || soundType === 'bell') {
      // Classic two-tone Ding-Dong
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(784, ctx.currentTime); // G5
      g1.gain.setValueAtTime(0.6, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc1.connect(g1);
      g1.connect(masterGain);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.45);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.35); // E5
      g2.gain.setValueAtTime(0.6, ctx.currentTime + 0.35);
      g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);
      osc2.connect(g2);
      g2.connect(masterGain);
      osc2.start(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.9);
    } else {
      // 'pos_bell' - Powerful rich restaurant POS chime (Dual chord bell like Yemeksepeti / SambaPOS)
      const notes = [
        { freq: 880, start: 0, dur: 0.7, gain: 0.55 },
        { freq: 1320, start: 0, dur: 0.55, gain: 0.35 },
        { freq: 1760, start: 0, dur: 0.4, gain: 0.2 },
        { freq: 1046.5, start: 0.22, dur: 0.9, gain: 0.65 },
        { freq: 1568, start: 0.22, dur: 0.7, gain: 0.4 },
        { freq: 2093, start: 0.22, dur: 0.5, gain: 0.25 }
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);
        g.gain.setValueAtTime(note.gain, ctx.currentTime + note.start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.start + note.dur);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(ctx.currentTime + note.start);
        osc.stop(ctx.currentTime + note.start + note.dur);
      });
    }
  } catch (e) {
    console.warn('Web Audio Playback failed:', e);
  }
}

export default function KitchenPosBell({
  orders = [],
  products = [],
  onOpenOrderDetail,
  onAcceptOrder,
  onAcceptAllNew
}) {
  // Bell Configuration State (persisted in localStorage)
  const [continuousBellEnabled, setContinuousBellEnabled] = useState(true);
  const [voiceReadoutEnabled, setVoiceReadoutEnabled] = useState(true);
  const [soundType, setSoundType] = useState('pos_bell'); // 'pos_bell' | 'kitchen_alarm' | 'classic_dingdong' | custom_*
  const [customSounds, setCustomSounds] = useState([]);
  const [suffixAudio, setSuffixAudio] = useState(null);
  const [volume, setVolume] = useState(0.85);
  const [repeatInterval, setRepeatInterval] = useState(60); // seconds (default 60s)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Snooze state (timestamp until which the bell is muted)
  const [snoozeUntil, setSnoozeUntil] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Track previous order IDs to detect arrival of a BRAND NEW order
  const prevOrderIdsRef = useRef(new Set());
  const initialMountRef = useRef(true);
  const [fallbackCatalogProducts, setFallbackCatalogProducts] = useState([]);

  const effectiveProducts = useMemo(() => {
    if (Array.isArray(products) && products.length > 0) return products;
    return fallbackCatalogProducts;
  }, [products, fallbackCatalogProducts]);

  // Ensure menu products (with their audioUrl) are always loaded in KitchenPosBell
  useEffect(() => {
    if (Array.isArray(products) && products.length > 0) return;
    fetch('/api/products?includeAudio=1', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setFallbackCatalogProducts(j.data);
        }
      })
      .catch(() => { });
  }, [products]);

  // Load and sync preferences from localStorage & Supabase on mount and storage events
  useEffect(() => {
    const syncSoundFromLocal = () => {
      try {
        const savedContinuous = localStorage.getItem('sd_continuous_bell');
        if (savedContinuous !== null) setContinuousBellEnabled(savedContinuous === 'true');

        const savedVoiceReadout = localStorage.getItem('sd_voice_readout');
        if (savedVoiceReadout !== null) setVoiceReadoutEnabled(savedVoiceReadout !== 'false');

        const savedSound = localStorage.getItem('sd_bell_sound');
        if (savedSound) setSoundType(savedSound);

        const savedVol = localStorage.getItem('sd_bell_volume');
        if (savedVol) setVolume(parseFloat(savedVol));

        // Read interval from sandwich_admin_settings (/yonetici) and sd_bell_interval
        let resolvedLocalInterval = null;
        try {
          const rawAdminSettings = localStorage.getItem('sandwich_admin_settings');
          if (rawAdminSettings) {
            const parsedSettings = JSON.parse(rawAdminSettings);
            if (typeof parsedSettings?.autoRefreshInterval === 'number' && parsedSettings.autoRefreshInterval >= 0) {
              resolvedLocalInterval = parsedSettings.autoRefreshInterval;
            }
          }
        } catch {}

        const savedInt = localStorage.getItem('sd_bell_interval');
        if (savedInt !== null && savedInt !== '') {
          const parsedInt = parseInt(savedInt, 10);
          if (!Number.isNaN(parsedInt) && parsedInt >= 0) {
            // If /yonetici has a larger configured interval (like 60s) and sd_bell_interval was stuck on old 8s default, prefer /yonetici setting
            if (resolvedLocalInterval !== null && parsedInt === 8 && resolvedLocalInterval !== 8) {
              setRepeatInterval(resolvedLocalInterval);
              localStorage.setItem('sd_bell_interval', String(resolvedLocalInterval));
            } else {
              setRepeatInterval(parsedInt);
            }
          }
        } else if (resolvedLocalInterval !== null) {
          setRepeatInterval(resolvedLocalInterval);
          localStorage.setItem('sd_bell_interval', String(resolvedLocalInterval));
        }

        const rawCustom = localStorage.getItem('sd_custom_bell_sounds');
        if (rawCustom) {
          const parsed = JSON.parse(rawCustom);
          if (Array.isArray(parsed)) setCustomSounds(parsed);
        }

        const savedSuffix = localStorage.getItem('sd_suffix_audio');
        if (savedSuffix) {
          setSuffixAudio(savedSuffix);
          if (typeof window !== 'undefined') {
            window.__sdSuffixAudio = savedSuffix;
          }
        } else {
          setSuffixAudio(null);
          if (typeof window !== 'undefined') {
            window.__sdSuffixAudio = null;
          }
        }
      } catch (e) { }
    };

    const syncSoundFromApi = () => {
      fetch('/api/notifications?includePosSounds=1', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          const s = j?.data?.settings;
          if (!s) return;
          if (Array.isArray(s.customSounds)) {
            setCustomSounds(s.customSounds);
            if (typeof window !== 'undefined') {
              window.__sdCustomBellSounds = s.customSounds;
            }
          }
          if (s.posSoundType) {
            setSoundType(s.posSoundType);
          }
          if (typeof s.posSoundVolume === 'number') {
            const normVol = Math.min(1, Math.max(0.1, s.posSoundVolume / 100));
            setVolume(normVol);
          }
          if (typeof s.posSoundInterval === 'number' && s.posSoundInterval >= 0) {
            setRepeatInterval(s.posSoundInterval);
          }
          if (typeof s.suffixAudioUrl !== 'undefined') {
            setSuffixAudio(s.suffixAudioUrl || null);
            if (typeof window !== 'undefined') {
              window.__sdSuffixAudio = s.suffixAudioUrl || null;
            }
            try {
              if (s.suffixAudioUrl) {
                localStorage.setItem('sd_suffix_audio', s.suffixAudioUrl);
              } else {
                localStorage.removeItem('sd_suffix_audio');
              }
            } catch {}
          }
        })
        .catch(() => { });
    };

    syncSoundFromLocal();
    syncSoundFromApi();

    const handleStorage = (e) => {
      if (
        e.key === 'sd_bell_sound' ||
        e.key === 'sd_bell_volume' ||
        e.key === 'sd_bell_interval' ||
        e.key === 'sd_custom_bell_sounds' ||
        e.key === 'sd_pos_bell_updated' ||
        e.key === 'sd_suffix_audio' ||
        e.key === 'sandwich_admin_settings'
      ) {
        syncSoundFromLocal();
        if (e.key === 'sd_pos_bell_updated') {
          syncSoundFromApi();
        }
      }
    };

    const handleCustomSoundSettingsChanged = (e) => {
      if (e?.detail) {
        if (typeof e.detail.volume === 'number') {
          setVolume(Math.min(1, Math.max(0.1, e.detail.volume)));
        }
        if (typeof e.detail.interval === 'number') {
          setRepeatInterval(Math.max(0, e.detail.interval));
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('sd_sound_settings_changed', handleCustomSoundSettingsChanged);

    // Başka cihazdan (ör. yöneticinin telefonu) yapılan ses değişikliklerini mutfak ekranına yansıt:
    // sekme öne geldiğinde ve 2 dakikada bir sunucudaki güncel ayarı çek.
    const handleVisibleSync = () => {
      if (document.visibilityState === 'visible') syncSoundFromApi();
    };
    document.addEventListener('visibilitychange', handleVisibleSync);
    window.addEventListener('focus', syncSoundFromApi);
    const remoteSyncTimer = setInterval(syncSoundFromApi, 120000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibleSync);
      window.removeEventListener('focus', syncSoundFromApi);
      clearInterval(remoteSyncTimer);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sd_sound_settings_changed', handleCustomSoundSettingsChanged);
    };
  }, []);

  // Update clock every second ONLY while snoozed for snooze countdown
  useEffect(() => {
    if (!snoozeUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [snoozeUntil]);

  // Filter unconfirmed 'Yeni' or 'Görüntülendi' orders (until approved as 'Onaylandı')
  const newOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'Yeni' || o.status === 'Görüntülendi');
  }, [orders]);

  const hasNewOrders = newOrders.length > 0;
  const isSnoozed = snoozeUntil && now < snoozeUntil;
  const isRinging = hasNewOrders && continuousBellEnabled && !isSnoozed;

  // Helper:
  // - 1 adet (tekli) siparişte: Doğrudan menü/ürün içindeki özel ses çalar.
  // - 1'in üzerinde (birden fazla ürün veya birden fazla bekleyen) siparişte: Yönetici panelinde (/yonetici) ayarlanan özel bildirim sesi çalar!
  const triggerOrderPriorityNotification = (targetOrders = newOrders, isPeriodicRepeat = false) => {
    // If a periodic repeat fires while a custom audio clip is still actively playing, let it finish
    if (
      isPeriodicRepeat &&
      activeCustomAudio &&
      !activeCustomAudio.paused &&
      !activeCustomAudio.ended
    ) {
      return;
    }

    const orderArray = Array.isArray(targetOrders)
      ? targetOrders
      : targetOrders
      ? [targetOrders]
      : [];

    const totalOrdersCount = orderArray.length;
    const totalOrderedItemQty = orderArray.reduce((sum, ord) => {
      const items = Array.isArray(ord?.items) ? ord.items : [];
      return sum + items.reduce((acc, it) => acc + Math.max(1, Number(it?.quantity || 1)), 0);
    }, 0);

    // 1. 1'İN ÜZERİNDE SİPARİŞ (Çoklu ürün adedi > 1 veya bekleyen sipariş sayısı > 1):
    // Yönetici panelinde (/yonetici) eklenen / seçilen özel bildirim sesi çalar!
    if (totalOrdersCount > 1 || totalOrderedItemQty > 1) {
      playKitchenBellSound(soundType, volume, customSounds);
      return;
    }

    // 2. TEKLİ SİPARİŞ (1 Adet Menü/Ürün):
    // Doğrudan sipariş edilen menünün kendi içindeki özel ses çalar!
    // Varsa 1 saniye sonra genel cümle tamamlayıcı ses kaydı oynatılır.
    const orderedProductAudios = extractOrderCustomAudios(orderArray, effectiveProducts);
    if (orderedProductAudios.length > 0) {
      playSequentialProductAudios(orderedProductAudios, volume, suffixAudio);
      return;
    }

    // Menüye özel ses dosyası yüklenmemişse doğrudan menü ismini Türkçe seslendir
    const primaryOrder = orderArray[0];
    if (primaryOrder) {
      announceOrderItems(primaryOrder, effectiveProducts, volume, suffixAudio);
    }
  };

  // Keep latest notification trigger, newOrders, isRinging, and repeatInterval in refs
  const triggerFnRef = useRef(triggerOrderPriorityNotification);
  const newOrdersRef = useRef(newOrders);
  const isRingingRef = useRef(isRinging);
  const repeatIntervalRef = useRef(repeatInterval);
  const lastPlayedAtRef = useRef(0);

  triggerFnRef.current = triggerOrderPriorityNotification;
  newOrdersRef.current = newOrders;
  isRingingRef.current = isRinging;
  repeatIntervalRef.current = repeatInterval;

  const getLastPlayedTimestamp = () => {
    let ts = lastPlayedAtRef.current || 0;
    if (typeof window !== 'undefined') {
      const winTs = Number(window.__sdLastOrderAudioPlayedAt || 0);
      if (winTs > ts) ts = winTs;
      try {
        const storedTs = Number(localStorage.getItem('sd_last_order_sound_at') || 0);
        if (storedTs > ts) ts = storedTs;
      } catch {}
    }
    return ts;
  };

  const recordPlayedTimestamp = () => {
    const nowTs = Date.now();
    lastPlayedAtRef.current = nowTs;
    if (typeof window !== 'undefined') {
      window.__sdLastOrderAudioPlayedAt = nowTs;
      try {
        localStorage.setItem('sd_last_order_sound_at', String(nowTs));
      } catch {}
    }
  };

  // Detect brand new incoming order ID (Wait until initial non-empty orders list loads before arming detector!)
  useEffect(() => {
    if (!Array.isArray(orders) || orders.length === 0) return;

    const currentIds = new Set(orders.map((o) => o.id));
    // On initial mount, if there are unconfirmed new orders and cooldown has passed, play once
    if (initialMountRef.current) {
      initialMountRef.current = false;
      prevOrderIdsRef.current = currentIds;
      if (newOrders.length > 0 && continuousBellEnabled) {
        const intervalSec = typeof repeatIntervalRef.current === 'number' ? repeatIntervalRef.current : 60;
        const minGapMs = Math.max(8, intervalSec || 60) * 1000;
        const lastTs = getLastPlayedTimestamp();
        if (lastTs === 0 || Date.now() - lastTs >= minGapMs) {
          recordPlayedTimestamp();
          triggerFnRef.current(newOrders, false);
        }
      }
      return;
    }

    let brandNewOrder = null;
    for (const order of newOrders) {
      if (!prevOrderIdsRef.current.has(order.id)) {
        brandNewOrder = order;
        break;
      }
    }
    prevOrderIdsRef.current = currentIds;

    if (brandNewOrder) {
      if (snoozeUntil) {
        setSnoozeUntil(null); // Cancel snooze for new order
      }
      recordPlayedTimestamp();
      triggerFnRef.current(newOrders.length > 1 ? newOrders : [brandNewOrder], false);
    }
  }, [orders, newOrders, snoozeUntil, continuousBellEnabled]);

  // Single Wall-Clock Periodic Repeat Checker:
  // Checks once per second if (Date.now() - lastPlayedTimestamp >= repeatInterval * 1000).
  // Never resets when /api/orders polls every 5s or when state re-renders!
  useEffect(() => {
    const checkTimer = setInterval(() => {
      if (!isRingingRef.current) return;

      // While an audio clip or speech synthesis is still actively playing, reset the countdown timestamp so the interval starts AFTER playback finishes!
      const isPlayingAudio =
        (activeCustomAudio && !activeCustomAudio.paused && !activeCustomAudio.ended) ||
        (typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking));
      if (isPlayingAudio) {
        recordPlayedTimestamp();
        return;
      }

      const intervalSec = typeof repeatIntervalRef.current === 'number' ? repeatIntervalRef.current : 60;
      if (intervalSec <= 0) return; // 0 = Tek Sefer Çal (no periodic repeat)

      const requiredGapMs = Math.max(8, intervalSec) * 1000;
      const lastPlayed = getLastPlayedTimestamp();
      const nowMs = Date.now();

      if (nowMs - lastPlayed >= requiredGapMs) {
        recordPlayedTimestamp();
        triggerFnRef.current(newOrdersRef.current, true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([250, 100, 250, 100, 400]);
        }
      }
    }, 1000);

    return () => clearInterval(checkTimer);
  }, []);

  // Document Title Blinking during Active Alarm
  useEffect(() => {
    if (!isRinging) {
      document.title = 'Sandviç Diyarı - Restoran Yönetim Portalı';
      return;
    }

    let toggle = false;
    const titleTimer = setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? `🚨 (${newOrders.length}) YENİ SİPARİŞ VAR!`
        : `🔔 Sandviç Diyarı Admin`;
    }, 1000);

    return () => {
      clearInterval(titleTimer);
      document.title = 'Sandviç Diyarı - Restoran Yönetim Portalı';
    };
  }, [isRinging, newOrders.length]);

  // Actions
  const handleSnooze = (durationMinutes = 3) => {
    const until = Date.now() + durationMinutes * 60 * 1000;
    setSnoozeUntil(until);
  };

  const handleToggleContinuous = () => {
    const nextVal = !continuousBellEnabled;
    setContinuousBellEnabled(nextVal);
    try {
      localStorage.setItem('sd_continuous_bell', String(nextVal));
    } catch (e) { }
  };

  const handleToggleVoiceReadout = () => {
    const nextVal = !voiceReadoutEnabled;
    setVoiceReadoutEnabled(nextVal);
    try {
      localStorage.setItem('sd_voice_readout', String(nextVal));
    } catch (e) { }
  };

  const handleSaveSoundType = (type) => {
    setSoundType(type);
    try {
      localStorage.setItem('sd_bell_sound', type);
    } catch (e) { }
    playKitchenBellSound(type, volume);
  };

  const handleSaveVolume = (vol) => {
    setVolume(vol);
    try {
      localStorage.setItem('sd_bell_volume', String(vol));
    } catch (e) { }
  };

  const handleSaveInterval = (sec) => {
    setRepeatInterval(sec);
    try {
      localStorage.setItem('sd_bell_interval', String(sec));
      const rawAdmin = localStorage.getItem('sandwich_admin_settings');
      if (rawAdmin) {
        const parsed = JSON.parse(rawAdmin);
        localStorage.setItem(
          'sandwich_admin_settings',
          JSON.stringify({ ...parsed, autoRefreshInterval: sec })
        );
      }
    } catch (e) { }
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_settings',
        settings: { posSoundInterval: sec }
      })
    }).catch(() => { });
  };

  const testCurrentSound = () => {
    if (hasNewOrders) {
      triggerOrderPriorityNotification(newOrders, false);
      return;
    }
    const firstMenuWithAudio = (Array.isArray(effectiveProducts) ? effectiveProducts : []).find(
      (p) => typeof p?.audioUrl === 'string' && p.audioUrl.trim()
    );
    if (firstMenuWithAudio) {
      speakProductPreview(firstMenuWithAudio.name, firstMenuWithAudio.audioUrl, volume);
    } else {
      speakProductPreview(effectiveProducts?.[0]?.name || 'Örnek Menü', '', volume);
    }
  };

  // Remaining snooze seconds
  const snoozeRemainingSec = isSnoozed ? Math.max(0, Math.ceil((snoozeUntil - now) / 1000)) : 0;
  const snoozeRemainingMin = Math.floor(snoozeRemainingSec / 60);
  const snoozeRemainingSecs = snoozeRemainingSec % 60;

  return (
    <>
      {/* 1. TOP EMERGENCY VISUAL ALERT BANNER (High-contrast flashing bar) */}
      {hasNewOrders && (
        <aside
          role="alert"
          aria-live="assertive"
          aria-label="Bekleyen Yeni Sipariş Bildirimi"
          className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white px-3 sm:px-6 py-2.5 shadow-xl sticky top-0 z-40 border-b-2 border-red-400/50 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Left: Shaking Bell & Status Info */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={testCurrentSound}
                title="Sesi Test Et"
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-base sm:text-lg shrink-0 shadow-inner cursor-pointer transition-transform ${isRinging ? 'animate-bounce ring-2 ring-white/60' : ''
                  }`}
                aria-label="Sesi Test Et"
              >
                🔔
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="font-black text-xs sm:text-base tracking-wide uppercase drop-shadow-xs">
                    {newOrders.length} YENİ SİPARİŞ BEKLİYOR!
                  </span>

                  {isRinging && (
                    <span className="inline-flex items-center gap-1 bg-black/40 text-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse border border-amber-300/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                      Zil ({repeatInterval}sn)
                    </span>
                  )}

                  {isSnoozed && (
                    <span className="inline-flex items-center gap-1 bg-stone-900/50 text-stone-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      🔕 Susturuldu ({snoozeRemainingMin}:{snoozeRemainingSecs < 10 ? '0' : ''}{snoozeRemainingSecs})
                    </span>
                  )}

                  {!continuousBellEnabled && (
                    <span className="bg-stone-900/50 text-stone-200 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      🔕 Zil Kapalı
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-red-100 hidden md:block truncate mt-0.5">
                  Sipariş yetkili tarafından görüntülenip onaylanana kadar mutfak zili periyodik olarak uyarı verir.
                </div>
              </div>
            </div>

            {/* Right: Quick Operational Actions */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t border-white/15 sm:border-t-0">
              {/* Snooze / Un-snooze Button */}
              {isRinging && (
                <button
                  type="button"
                  onClick={() => handleSnooze(3)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-black/25 hover:bg-black/40 text-white font-bold text-[11px] sm:text-xs transition-all active:scale-95 flex items-center gap-1.5 border border-white/20 cursor-pointer"
                  title="Mutfak zilini 3 dakika boyunca sustur"
                >
                  <i className="fa-solid fa-bell-slash text-[11px]"></i>
                  <span>Sustur (3 Dk)</span>
                </button>
              )}

              {isSnoozed && (
                <button
                  type="button"
                  onClick={() => setSnoozeUntil(null)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] sm:text-xs transition-all active:scale-95 flex items-center gap-1.5 border border-white/20 cursor-pointer"
                  title="Susturmayı İptal Et ve Zili Tekrar Aç"
                >
                  <i className="fa-solid fa-bell text-[11px]"></i>
                  <span>Zili Aç</span>
                </button>
              )}

              {/* View Oldest Pending Order */}
              {newOrders[0] && (
                <button
                  type="button"
                  onClick={() => triggerOrderPriorityNotification([newOrders[0]], false)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] sm:text-xs transition-all active:scale-95 flex items-center gap-1.5 border border-white/25 cursor-pointer shrink-0"
                  title="Sipariş edilen ürünün menü sesini çal veya sesli oku"
                >
                  <i className="fa-solid fa-volume-high text-[11px]"></i>
                  <span>Sesli Oku</span>
                </button>
              )}

              {onOpenOrderDetail && newOrders[0] && (
                <button
                  type="button"
                  onClick={() => onOpenOrderDetail(newOrders[0])}
                  className="flex-1 sm:flex-none justify-center px-3 sm:px-3.5 py-1.5 rounded-xl bg-white text-red-700 hover:bg-red-50 font-black text-[11px] sm:text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer truncate"
                >
                  <i className="fa-solid fa-eye text-[11px]"></i>
                  <span className="truncate">İncele (#{newOrders[0].orderNumber || newOrders[0].id})</span>
                </button>
              )}

              {/* Direct 1-Click Approve Oldest Pending Order */}
              {onAcceptOrder && newOrders[0] && (
                <button
                  type="button"
                  onClick={() => onAcceptOrder(newOrders[0].id)}
                  className="flex-1 sm:flex-none justify-center px-3 sm:px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] sm:text-xs shadow-md ring-1 ring-white/40 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer truncate"
                  title="Siparişi Hemen Onayla ve Mutfağa İlet"
                >
                  <i className="fa-solid fa-check text-[11px]"></i>
                  <span className="truncate">Onayla</span>
                </button>
              )}

              {/* Settings gear */}
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                title="Zil Ayarları"
                className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
                aria-label="Zil Ayarları"
              >
                <i className="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 2. HEADER QUICK ACCESS BELL BUTTON (Renders standalone in header if needed) */}
      <div className="fixed bottom-4 right-4 z-30 md:static md:z-auto">
        {/* Floating Quick Action on Mobile if ringing */}
        {isRinging && (
          <button
            onClick={() => handleSnooze(3)}
            className="md:hidden flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-full shadow-2xl font-black text-xs animate-bounce border-2 border-white cursor-pointer"
          >
            <span>🔕 Zili Sustur ({newOrders.length})</span>
          </button>
        )}
      </div>

      {/* 3. SETTINGS MODAL / POPUP */}
      {isSettingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-bell-settings-title"
          className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-5 text-stone-900 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-bold">
                  🔔
                </span>
                <div>
                  <h3 id="kitchen-bell-settings-title" className="font-extrabold text-base text-stone-900">
                    Mutfak Sipariş Zili Ayarları
                  </h3>
                  <p className="text-xs text-stone-500">
                    Restoran ortamı için yüksek sesli POS alarmı
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Kapat"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Toggle Continuous Ringing & Voice Product Readout */}
            <div className="space-y-2.5">
              <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-xs text-stone-900">
                    Sürekli Çalan Alarm Modu
                  </div>
                  <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                    Sipariş ekranda kabul edilene kadar aralıklarla yüksek sesle çalar.
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={continuousBellEnabled}
                  onClick={handleToggleContinuous}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${continuousBellEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  aria-label="Sürekli Çalan Alarm Modunu Aç veya Kapat"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${continuousBellEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              <div className="bg-amber-50/60 rounded-xl p-3.5 border border-amber-200/80 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                    <i className="fa-solid fa-microphone-lines text-amber-600"></i>
                    <span>Sipariş Ürün İsmi Sesli Okuma (Anons)</span>
                  </div>
                  <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                    Yeni sipariş geldiğinde ürün isimlerini Türkçe seslendirir veya ürüne özel sesi çalar.
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={voiceReadoutEnabled}
                  onClick={handleToggleVoiceReadout}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${voiceReadoutEnabled ? 'bg-amber-600' : 'bg-stone-300'
                    }`}
                  aria-label="Sipariş Ürün İsmi Sesli Okumayı Aç veya Kapat"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${voiceReadoutEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* Sound Choice */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Zil / Alarm Tonu
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'pos_bell',
                    title: '🔔 SambaPOS / Yemeksepeti Melodisi',
                    desc: 'Çift tonlu, net ve dikkat çeken restoran zili (Önerilen)'
                  },
                  {
                    id: 'kitchen_alarm',
                    title: '🚨 Acil Mutfak Alarmı (Triple Siren)',
                    desc: 'Yüksek gürültülü ve davlumbaz çalışan mutfaklar için keskin alarm'
                  },
                  {
                    id: 'classic_dingdong',
                    title: '🎵 Klasik Ding-Dong',
                    desc: 'Yumuşak tınılı geleneksel resepsiyon zili'
                  },
                  ...customSounds.map((cs) => ({
                    id: cs.id,
                    title: `🎶 ${cs.label || 'Özel Bildirim Sesi'}`,
                    desc: cs.desc || 'Yönetici tarafından eklenen özel bildirim sesi'
                  }))
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSaveSoundType(s.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${soundType === s.id
                      ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-semibold ring-1 ring-amber-500'
                      : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                      }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{s.title}</div>
                      <div className="text-[10px] text-stone-500 mt-0.5">{s.desc}</div>
                    </div>
                    {soundType === s.id && (
                      <span className="text-amber-600 text-xs font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <i className={`fa-solid ${volume <= 0.15 ? 'fa-volume-off text-stone-400' : volume <= 0.6 ? 'fa-volume-low text-amber-500' : 'fa-volume-high text-amber-600'}`}></i>
                  <span>Ses Seviyesi</span>
                </span>
                <span className="font-extrabold text-amber-600 text-sm">%{Math.round(volume * 100)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => handleSaveVolume(parseFloat(e.target.value))}
                className="custom-range w-full cursor-pointer h-2 rounded-full"
                style={{
                  background: `linear-gradient(to right, #d97706 0%, #d97706 ${Math.round(volume * 100)}%, #e7e5e4 ${Math.round(volume * 100)}%, #e7e5e4 100%)`
                }}
              />
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { v: 0.25, label: '%25' },
                  { v: 0.50, label: '%50' },
                  { v: 0.80, label: '%80' },
                  { v: 1.00, label: '%100' }
                ].map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => handleSaveVolume(p.v)}
                    className={`py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                      Math.abs(volume - p.v) < 0.04
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Repeat Interval */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Tekrarlama Aralığı (Sipariş Onaylanana Kadar)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { sec: 8, label: '8 Sn' },
                  { sec: 15, label: '15 Sn' },
                  { sec: 30, label: '30 Sn' },
                  { sec: 60, label: '60 Sn' },
                  { sec: 0, label: 'Tek Sefer' }
                ].map((opt) => (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => handleSaveInterval(opt.sec)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${repeatInterval === opt.sec
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={testCurrentSound}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-amber-200 cursor-pointer"
              >
                <span>🔔 Sesi Test Et</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="py-2.5 px-6 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
