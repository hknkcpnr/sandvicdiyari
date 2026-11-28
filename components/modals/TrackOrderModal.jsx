'use client';

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { closeTrackOrderModal } from '@/store/slices/uiSlice';
import { formatTurkishPhoneInput } from '@/lib/phoneUtils';

const TRACK_STEPS = [
  { label: 'Alındı', icon: 'fa-solid fa-receipt' },
  { label: 'Hazırlanıyor', icon: 'fa-solid fa-fire-burner' },
  { label: 'Yolda', icon: 'fa-solid fa-motorcycle' },
  { label: 'Teslim Edildi', icon: 'fa-solid fa-check' }
];

function getOrderStepIndex(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('iptal')) return -1;
  if (s.includes('teslim') || s.includes('tamamland')) return 3;
  if (s.includes('yolda') || s.includes('kurye') || s.includes('hazır')) return 2;
  if (s.includes('hazırlan') || s.includes('mutfak')) return 1;
  return 0;
}

export default function TrackOrderModal() {
  const dispatch = useDispatch();
  const { isTrackOrderModalOpen } = useSelector((state) => state.ui);

  const [orderNo, setOrderNo] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [foundOrder, setFoundOrder] = useState(null);

  if (!isTrackOrderModalOpen) return null;

  const handleClose = () => {
    setErrorMsg('');
    dispatch(closeTrackOrderModal());
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setFoundOrder(null);

    const cleanOrderNo = orderNo.trim().toUpperCase().replace(/^#/, '');
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanOrderNo) {
      setErrorMsg('Lütfen sipariş numaranızı girin (Örn: SD-1042 veya 1042).');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMsg('Lütfen siparişte kullandığınız telefon numarasını girin (Örn: 0532 123 45 67).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo: cleanOrderNo,
          phone: cleanPhone
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Bu bilgilerle eşleşen bir sipariş bulunamadı.');
      }

      setFoundOrder(json.data);
    } catch (err) {
      setErrorMsg(err.message || 'Sipariş sorgulanamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinToLiveTracker = () => {
    if (!foundOrder) return;
    try {
      localStorage.setItem('sd_last_order', JSON.stringify(foundOrder));
      window.dispatchEvent(new Event('sd_order_created'));
    } catch {}
    handleClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200/80 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 font-poppins">
        {/* Başlık */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-800 text-white flex items-center justify-between overflow-hidden shrink-0">
          <div
            className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-amber-500/20 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-400 flex items-center justify-center text-base shadow-inner">
              <i className="fa-solid fa-location-crosshairs"></i>
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-tight leading-tight text-white">
                Sipariş Durumu Sorgula
              </h3>
              <p className="text-[11px] text-stone-300 mt-0.5">
                Misafir veya üye siparişinizi anlık takip edin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Kapat"
            className="relative z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/85 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Gövde */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Sipariş Numarası <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <i className="fa-solid fa-receipt absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                  <input
                    type="text"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    placeholder="Örn: SD-1042"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-stone-800 uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Telefon Numarası <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <i className="fa-solid fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatTurkishPhoneInput(e.target.value))}
                    placeholder="0532 123 45 67"
                    maxLength={14}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-stone-800 placeholder:font-normal focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-rose-500 shrink-0"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-[0.99] disabled:opacity-50"
            >
              <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-magnifying-glass'}`}></i>
              <span>{loading ? 'Sorgulanıyor...' : 'Siparişimi Sorgula'}</span>
            </button>
          </form>

          {/* Sorgulama Sonucu */}
          {foundOrder && (() => {
            const stepIdx = getOrderStepIndex(foundOrder.status);
            const isCancelled = stepIdx === -1;
            const formattedDate = foundOrder.createdAt
              ? new Date(foundOrder.createdAt).toLocaleString('tr-TR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : null;
            const statusTone =
              foundOrder.status === 'Teslim Edildi'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : foundOrder.status === 'İptal Edildi'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : foundOrder.status === 'Yolda'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-amber-50 text-amber-800 border-amber-200';
            const dotTone =
              foundOrder.status === 'Teslim Edildi'
                ? 'bg-emerald-500'
                : foundOrder.status === 'İptal Edildi'
                ? 'bg-rose-500'
                : foundOrder.status === 'Yolda'
                ? 'bg-indigo-500 animate-pulse'
                : 'bg-amber-500 animate-pulse';

            return (
              <div className="rounded-2xl bg-gradient-to-b from-stone-50/90 to-white border border-stone-200/90 shadow-xs overflow-hidden animate-in fade-in duration-200">
                {/* Üst Bar: Sipariş No + Tarih + Durum */}
                <div className="px-4 py-3 bg-white border-b border-stone-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-stone-900">
                        #{foundOrder.orderNumber || foundOrder.id}
                      </span>
                      {formattedDate && (
                        <span className="text-[11px] text-stone-400 font-medium">
                          &bull; {formattedDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${statusTone}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotTone}`}></span>
                    <span>{foundOrder.status || 'Alındı'}</span>
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Aşama Çubuğu */}
                  {isCancelled ? (
                    <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <i className="fa-solid fa-ban"></i>
                      <span>Bu sipariş iptal edilmiştir.</span>
                    </div>
                  ) : (
                    <div className="bg-white border border-stone-200/70 rounded-xl px-3 py-2.5">
                      <div className="grid grid-cols-4 gap-1 relative">
                        {TRACK_STEPS.map((st, idx) => {
                          const completed = idx <= stepIdx;
                          const current = idx === stepIdx;
                          return (
                            <div key={st.label} className="flex flex-col items-center text-center relative">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                                  completed
                                    ? idx === 3
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                      : current
                                      ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-2xs ring-4 ring-amber-500/15'
                                      : 'bg-emerald-500 text-white border-emerald-500'
                                    : 'bg-stone-100 text-stone-400 border-stone-200'
                                }`}
                              >
                                <i className={st.icon}></i>
                              </div>
                              <span
                                className={`text-[10px] mt-1 font-semibold truncate max-w-full ${
                                  completed ? 'text-stone-900' : 'text-stone-400'
                                }`}
                              >
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3 Sütun Özet Kutucukları */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white border border-stone-200/70 rounded-xl px-2.5 py-2 min-w-0">
                      <span className="text-[10px] font-semibold text-stone-400 uppercase block">Müşteri</span>
                      <strong className="text-xs font-bold text-stone-800 truncate block mt-0.5">
                        {foundOrder.customerName}
                      </strong>
                    </div>
                    <div className="bg-white border border-stone-200/70 rounded-xl px-2.5 py-2 min-w-0">
                      <span className="text-[10px] font-semibold text-stone-400 uppercase block">Ödeme</span>
                      <strong className="text-xs font-semibold text-stone-700 truncate block mt-0.5">
                        {foundOrder.paymentMethod || 'Kapıda'}
                      </strong>
                    </div>
                    <div className="bg-white border border-stone-200/70 rounded-xl px-2.5 py-2 min-w-0 text-right">
                      <span className="text-[10px] font-semibold text-stone-400 uppercase block">Toplam</span>
                      <strong className="text-xs font-extrabold text-emerald-700 block mt-0.5">
                        ₺{Number(foundOrder.total || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {foundOrder.courierEta && (
                    <div className="flex items-center justify-between text-xs text-indigo-700 bg-indigo-50/90 border border-indigo-200/80 px-3 py-2 rounded-xl font-bold">
                      <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-clock"></i>
                        <span>Tahmini Varış</span>
                      </span>
                      <span>{foundOrder.courierEta}</span>
                    </div>
                  )}

                  {/* Sipariş İçeriği (Fiş Kutusu) */}
                  {Array.isArray(foundOrder.items) && foundOrder.items.length > 0 && (
                    <div className="bg-white border border-stone-200/70 rounded-xl p-3 space-y-2">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                        Sipariş İçeriği
                      </span>
                      <ul className="space-y-1.5 divide-y divide-stone-100">
                        {foundOrder.items.map((it, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2 pt-1.5 first:pt-0 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px] shrink-0">
                                {it.quantity}x
                              </span>
                              <span className="text-stone-700 font-medium truncate">{it.name}</span>
                            </div>
                            <span className="font-bold text-stone-800 shrink-0">
                              ₺{(Number(it.price) * (it.quantity || 1)).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Canlı Takip Çubuğuna Sabitle */}
                  <button
                    type="button"
                    onClick={handlePinToLiveTracker}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/20 active:scale-[0.99]"
                  >
                    <i className="fa-solid fa-satellite-dish animate-pulse"></i>
                    <span>Canlı Takip Çubuğuna Sabitle &amp; İzle</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
