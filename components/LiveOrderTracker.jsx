'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '@/store/slices/authSlice';
import { showMessageModal } from '@/store/slices/uiSlice';
import { getRestaurantStatus, CLOSED_MESSAGE } from '@/lib/openingHours';

const STATUS_STEPS = [
  { key: 'Yeni', label: 'Alındı', icon: 'fa-solid fa-receipt' },
  { key: 'Onaylandı', label: 'Onaylandı', icon: 'fa-solid fa-thumbs-up' },
  { key: 'Hazırlanıyor', label: 'Hazırlanıyor', icon: 'fa-solid fa-fire-burner' },
  { key: 'Yolda', label: 'Kuryede', icon: 'fa-solid fa-motorcycle' },
  { key: 'Teslim Edildi', label: 'Teslim Edildi', icon: 'fa-solid fa-circle-check' },
];

function getStatusIndex(status) {
  if (!status) return 0;
  if (status === 'Görüntülendi') return 0;
  if (status === 'Onaylandı') return 1;
  if (status === 'Hazırlanıyor' || status === 'Hazır') return 2;
  if (status === 'Kurye Teslim Aldı' || status === 'Yolda') return 3;
  if (status === 'Teslim Edildi') return 4;
  return 0;
}

export default function LiveOrderTracker() {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const [activeOrder, setActiveOrder] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const guestClearedRef = useRef(false);

  const clearGuestSessionIfDelivered = (orderObj) => {
    if (!orderObj || orderObj.status !== 'Teslim Edildi' || guestClearedRef.current) return;
    try {
      const rawUser = localStorage.getItem('sd_current_user');
      const parsedUser = rawUser ? JSON.parse(rawUser) : currentUser;
      const isGuest = Boolean(
        parsedUser && (
          parsedUser.isGuest ||
          String(parsedUser.id || '').startsWith('guest_') ||
          String(parsedUser.email || '').startsWith('misafir_')
        )
      );
      if (isGuest) {
        guestClearedRef.current = true;
        localStorage.removeItem('sd_last_order');
        dispatch(logout());
        dispatch(
          showMessageModal({
            title: 'Siparişiniz Teslim Edildi 🎉',
            text: 'Afiyet olsun! Siparişiniz teslim edildiği için misafir oturumunuz güvenlik amacıyla otomatik olarak sonlandırıldı.',
            type: 'success'
          })
        );
      }
    } catch (err) {}
  };

  // Load last order from storage
  const loadLastOrder = () => {
    try {
      const saved = localStorage.getItem('sd_last_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          // If status is not cancelled and was created recently (within 6 hours)
          const orderAgeHours = (Date.now() - new Date(parsed.createdAt || Date.now()).getTime()) / (1000 * 60 * 60);
          if (parsed.status !== 'İptal Edildi' && (Number.isNaN(orderAgeHours) || orderAgeHours < 6)) {
            setActiveOrder(parsed);
            if (parsed.status === 'Teslim Edildi') {
              clearGuestSessionIfDelivered(parsed);
            }
            return parsed;
          }
        }
      }
    } catch (e) {}
    setActiveOrder(null);
    return null;
  };

  const checkOrderStatus = async () => {
    const current = loadLastOrder();
    if (current && current.id && current.status !== 'Teslim Edildi' && current.status !== 'İptal Edildi') {
      try {
        const res = await fetch(`/api/orders/${current.id}`, { cache: 'no-store' });
        const json = await res.json();
        if (json.success && json.data) {
          setActiveOrder(json.data);
          localStorage.setItem('sd_last_order', JSON.stringify(json.data));
          clearGuestSessionIfDelivered(json.data);
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    checkOrderStatus();

    const handleCreated = () => {
      guestClearedRef.current = false;
      loadLastOrder();
      setIsExpanded(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkOrderStatus();
      }
    };

    window.addEventListener('sd_order_created', handleCreated);
    window.addEventListener('storage', loadLastOrder);
    window.addEventListener('focus', checkOrderStatus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Poll current active order status
    const pollTimer = setInterval(checkOrderStatus, 4000);

    return () => {
      window.removeEventListener('sd_order_created', handleCreated);
      window.removeEventListener('storage', loadLastOrder);
      window.removeEventListener('focus', checkOrderStatus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pollTimer);
    };
  }, []);

  if (!activeOrder) return null;

  const currentIndex = getStatusIndex(activeOrder.status);
  const isCompleted = activeOrder.status === 'Teslim Edildi';

  return (
    <>
      {/* Floating Pill on bottom-right of page */}
      <div className="fixed bottom-5 right-5 z-40 animate-in slide-in-from-bottom duration-300">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-stone-900/95 hover:bg-stone-900 text-white pl-4 pr-5 py-3 rounded-2xl shadow-2xl shadow-black/40 border border-stone-700/80 backdrop-blur-md flex items-center gap-3.5 transition-all hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="relative">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white text-base shadow-md shadow-brand-500/30">
              <i className="fa-solid fa-motorcycle"></i>
            </div>
            {!isCompleted && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
            )}
          </div>
          <div className="text-left leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                Canlı Sipariş Takibi
              </span>
              <span className="text-[10px] text-stone-400">#{activeOrder.orderNumber || activeOrder.id}</span>
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{activeOrder.status || 'Hazırlanıyor'}</span>
              <span className="text-stone-400 text-xs font-normal">| Detay</span>
            </div>
          </div>
        </button>
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-brand-500/20">
                  <i className="fa-solid fa-motorcycle"></i>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900 leading-tight">Sipariş Durumu</h3>
                  <span className="text-xs text-stone-400">No: #{activeOrder.orderNumber || activeOrder.id}</span>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-sm transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Stepper */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4">
              <div className="relative flex items-center justify-between">
                {/* Connecting Line */}
                <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-stone-200 z-0">
                  <div
                    className="h-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
                  ></div>
                </div>

                {STATUS_STEPS.map((step, idx) => {
                  const isPassed = idx <= currentIndex;
                  const isCurrent = idx === currentIndex;
                  return (
                    <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCurrent
                            ? 'bg-brand-500 text-white ring-4 ring-brand-100 shadow-md scale-110'
                            : isPassed
                            ? 'bg-brand-500 text-white'
                            : 'bg-white text-stone-400 border-2 border-stone-200'
                        }`}
                      >
                        <i className={step.icon}></i>
                      </div>
                      <span
                        className={`text-[10px] font-bold text-center ${
                          isCurrent ? 'text-brand-600' : isPassed ? 'text-stone-700' : 'text-stone-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Info & Items */}
            <div className="space-y-3 text-xs text-stone-600">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400 font-medium">Teslimat Adresi:</span>
                  <span className="font-semibold text-stone-800 text-right max-w-xs">{activeOrder.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400 font-medium">Ödeme Şekli:</span>
                  <span className="font-semibold text-stone-800">{activeOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400 font-medium">Toplam Tutar:</span>
                  <span className="font-extrabold text-brand-600 text-sm">
                    ₺{Number(activeOrder.total || activeOrder.subtotal || 0).toFixed(2)}
                  </span>
                </div>
                {activeOrder.notes && (
                  <div className="pt-2 border-t border-stone-200/80 text-stone-500">
                    <strong>Sipariş Notu:</strong> &quot;{activeOrder.notes}&quot;
                  </div>
                )}
              </div>

              {/* Items List */}
              {Array.isArray(activeOrder.items) && (
                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-stone-700 block">Sipariş Edilen Ürünler:</span>
                  <div className="divide-y divide-stone-100 bg-stone-50 rounded-2xl p-3 border border-stone-200">
                    {activeOrder.items.map((it, i) => (
                      <div key={i} className="flex justify-between py-1.5 first:pt-0 last:pb-0">
                        <span className="font-medium text-stone-800">
                          {it.quantity || 1}x {it.name}
                        </span>
                        <span className="text-stone-500">
                          ₺{Number(it.price * (it.quantity || 1)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-2">
              {getRestaurantStatus().isOpen ? (
                <a
                  href="tel:05521045535"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-3 rounded-xl text-xs text-center transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-phone"></i>
                  <span>Restoranı Ara</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => alert(CLOSED_MESSAGE)}
                  className="flex-1 bg-stone-100 text-stone-400 font-bold py-3 rounded-xl text-xs text-center border border-stone-200 cursor-not-allowed opacity-70 flex items-center justify-center gap-2"
                  title="Saat 03:00 - 10:00 arası telefon kapalıdır"
                >
                  <i className="fa-solid fa-phone-slash"></i>
                  <span>Restoran Kapalı (10:00)</span>
                </button>
              )}
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('sd_last_order');
                  } catch (e) {}
                  setActiveOrder(null);
                  setIsExpanded(false);
                }}
                className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-3 rounded-xl text-xs font-semibold transition-colors"
                title="Bildirimi Kapat"
              >
                Takibi Gizle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
