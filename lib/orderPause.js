// Sipariş alımını geçici durdurma (yoğunluk / mola) yardımcıları.
// Hem sunucu (API) hem istemci (checkout, panel) tarafında kullanılır; harici bağımlılığı yoktur.

export const ORDER_PAUSE_DEFAULT_REASON = 'Yoğunluk nedeniyle kısa bir süre sipariş alamıyoruz.';

/**
 * Admin ayar nesnesinden geçerli durdurma durumunu hesaplar.
 * Süresi dolmuş bir durdurma otomatik olarak "açık" kabul edilir.
 */
export function getOrderPauseState(settings, now = Date.now()) {
  const s = settings || {};
  if (!s.ordersPaused) {
    return { paused: false, until: null, reason: '', remainingMinutes: 0 };
  }

  const untilMs = s.ordersPausedUntil ? new Date(s.ordersPausedUntil).getTime() : null;
  if (untilMs !== null && Number.isFinite(untilMs) && untilMs <= now) {
    return { paused: false, until: null, reason: '', remainingMinutes: 0 };
  }

  const hasUntil = untilMs !== null && Number.isFinite(untilMs);
  return {
    paused: true,
    until: hasUntil ? new Date(untilMs).toISOString() : null,
    reason: String(s.ordersPausedReason || '').trim() || ORDER_PAUSE_DEFAULT_REASON,
    remainingMinutes: hasUntil ? Math.max(1, Math.ceil((untilMs - now) / 60000)) : 0
  };
}

/** Müşteriye gösterilecek tek satırlık mesaj. */
export function formatOrderPauseMessage(state) {
  if (!state || !state.paused) return '';
  const base = state.reason || ORDER_PAUSE_DEFAULT_REASON;
  if (state.remainingMinutes > 0) {
    return `${base} Yaklaşık ${state.remainingMinutes} dakika sonra tekrar sipariş verebilirsiniz.`;
  }
  return `${base} Lütfen biraz sonra tekrar deneyin.`;
}
