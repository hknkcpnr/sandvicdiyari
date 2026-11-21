'use client';

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { closeTrackOrderModal } from '@/store/slices/uiSlice';
import { formatTurkishPhoneInput } from '@/lib/phoneUtils';

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
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Başlık */}
        <div className="px-5 py-4 bg-gradient-to-r from-stone-900 to-stone-850 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-location-crosshairs"></i>
            </span>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Sipariş Durumu Sorgula</h3>
              <p className="text-[11px] text-stone-300">Misafir veya üye siparişinizi anlık takip edin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <form onSubmit={handleSearch} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1">
                Sipariş Numarası <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-receipt absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                <input
                  type="text"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="Örn: SD-1042 veya 1042"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-stone-800 uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1">
                Sipariş Telefon Numarası <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatTurkishPhoneInput(e.target.value))}
                  placeholder="0532 123 45 67"
                  maxLength={14}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-stone-800 placeholder:font-normal focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-rose-500 shrink-0"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-magnifying-glass'}`}></i>
              <span>{loading ? 'Sorgulanıyor...' : 'Siparişimi Sorgula'}</span>
            </button>
          </form>

          {/* Sorgulama Sonucu */}
          {foundOrder && (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-stone-200/80 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Bulunan Sipariş</span>
                  <span className="font-black text-sm text-stone-900">#{foundOrder.orderNumber || foundOrder.id}</span>
                </div>
                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                  foundOrder.status === 'Teslim Edildi'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : foundOrder.status === 'İptal Edildi'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : foundOrder.status === 'Yolda'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  {foundOrder.status || 'Alındı'}
                </span>
              </div>

              {/* Detaylar */}
              <div className="text-xs text-stone-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-400">Müşteri:</span>
                  <strong className="text-stone-800">{foundOrder.customerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Toplam Tutar:</span>
                  <strong className="text-emerald-700 font-bold">₺{Number(foundOrder.total || 0).toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Ödeme:</span>
                  <span className="text-stone-700">{foundOrder.paymentMethod || 'Kapıda'}</span>
                </div>
                {foundOrder.courierEta && (
                  <div className="flex justify-between text-indigo-700 bg-indigo-50 p-1.5 rounded-lg font-bold">
                    <span>⏱️ Tahmini Varış:</span>
                    <span>{foundOrder.courierEta}</span>
                  </div>
                )}
              </div>

              {/* Kalemler */}
              {Array.isArray(foundOrder.items) && foundOrder.items.length > 0 && (
                <div className="pt-2 border-t border-stone-200/80 text-[11px] text-stone-600">
                  <span className="font-bold text-stone-700 block mb-1">Sipariş İçeriği:</span>
                  <ul className="space-y-0.5">
                    {foundOrder.items.map((it, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{it.quantity}x {it.name}</span>
                        <span className="font-semibold text-stone-700">₺{(Number(it.price) * (it.quantity || 1)).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Canlı Takip Çubuğuna Sabitle */}
              <button
                type="button"
                onClick={handlePinToLiveTracker}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <i className="fa-solid fa-satellite-dish animate-pulse"></i>
                <span>Canlı Takip Çubuğuna Sabitle &amp; İzle</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
