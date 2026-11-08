'use client';

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { closeProfileModal, showMessageModal, toggleCart } from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';
import { addToCart } from '@/store/slices/cartSlice';

export default function ProfileModal() {
  const dispatch = useDispatch();
  const { isProfileModalOpen } = useSelector((state) => state.ui);
  const { currentUser } = useSelector((state) => state.auth);
  const { items: products } = useSelector((state) => state.product);

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'notifications'
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  useEffect(() => {
    if (!isProfileModalOpen || !currentUser) return;

    const loadUserNotifs = async () => {
      setLoadingNotifs(true);
      try {
        const q = new URLSearchParams();
        if (currentUser.email) q.set('email', currentUser.email);
        if (currentUser.id) q.set('id', currentUser.id);
        const res = await fetch(`/api/notifications?${q.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (json?.success && Array.isArray(json?.data?.notifications)) {
          setNotifications(json.data.notifications);
        }
      } catch (e) {
      } finally {
        setLoadingNotifs(false);
      }
    };

    loadUserNotifs();
  }, [isProfileModalOpen, currentUser]);

  if (!isProfileModalOpen || !currentUser) return null;

  const initials = (currentUser?.name || currentUser?.username || currentUser?.email || 'Ü')
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'Ü';

  const handleLogout = () => {
    dispatch(logout());
    dispatch(closeProfileModal());
    dispatch(
      showMessageModal({
        title: 'Oturum Kapatıldı',
        text: 'Başarıyla çıkış yapıldı.',
        type: 'success',
      })
    );
  };

  const handleClearPersonalNotifications = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear_personal',
          email: currentUser.email,
          id: currentUser.id
        })
      });
      setNotifications((prev) => prev.filter((n) => n.scope !== 'personal'));
    } catch (e) {}
  };

  const handleReorder = async (order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      const json = await res.json();
      if (json.success && json.data && Array.isArray(json.data.items) && json.data.items.length > 0) {
        for (const item of json.data.items) {
          dispatch(
            addToCart({
              product: {
                id: item.id || Date.now(),
                name: item.name,
                price: Number(item.price) || json.data.total / json.data.items.length,
                image: item.image || '/images/hero_banner.jpg',
                category: item.category || 'sandwich',
              },
              sauces: {},
              extras: [],
              note: item.details || '',
              drink: null,
            })
          );
        }
      } else {
        const fallbackProd =
          products && products.length > 0
            ? products[0]
            : { id: 1, name: 'Maxi Karışık Menü', price: 450, image: '/images/hero_banner.jpg' };
        dispatch(
          addToCart({
            product: fallbackProd,
            sauces: {},
            extras: [],
            note: `Tekrar Sipariş: #${order.id}`,
            drink: null,
          })
        );
      }

      dispatch(closeProfileModal());
      dispatch(toggleCart());
      dispatch(
        showMessageModal({
          title: 'Sepete Eklendi! 🛍️',
          text: `#${order.id} nolu siparişinizdeki lezzetler sepetinize aktarıldı.`,
          type: 'success',
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      id="profile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-9 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center text-xl font-bold"
              id="profile-initials"
            >
              {initials}
            </div>
            <div>
              <h3 className="font-bold text-lg text-stone-900" id="profile-name-display">
                {currentUser.name}
              </h3>
              <span className="text-xs text-stone-400" id="profile-email-display">
                {currentUser.email}
              </span>
            </div>
          </div>
          <button
            onClick={() => dispatch(closeProfileModal())}
            className="text-stone-400 hover:text-stone-600 p-2 cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Sekme Geçişi */}
        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>Bilgilerim &amp; Siparişlerim</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'notifications'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-bell text-brand-600"></i>
            <span>Bildirimlerim</span>
            {notifications.length > 0 && (
              <span className="bg-brand-100 text-brand-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {notifications.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'orders' ? (
          <>
            <div className="space-y-3">
              <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
                Kayıtlı Adres &amp; İletişim Bilgileriniz
              </h4>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs space-y-2 text-stone-700">
                <p>
                  <strong>Telefon:</strong>{' '}
                  <span id="profile-phone-display">{currentUser.phone || '-'}</span>
                </p>
                <p>
                  <strong>Adres:</strong>{' '}
                  <span id="profile-address-display">{currentUser.address || '-'}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
                Geçmiş Siparişlerim
              </h4>
              <div id="profile-orders-list" className="space-y-3">
                {currentUser.orders && currentUser.orders.length > 0 ? (
                  currentUser.orders.map((order, idx) => (
                    <div
                      key={order.id || idx}
                      className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex justify-between items-center text-xs"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900 block">
                              Sipariş No: {order.orderNumber || order.id}
                            </span>
                            <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                              {order.status || 'Teslim Edildi'}
                            </span>
                          </div>
                          {typeof order.items === 'string' && (
                            <span className="text-stone-500 block mt-0.5 line-clamp-2">{order.items}</span>
                          )}
                          <span className="text-stone-400 block mt-1">{order.date || ''}</span>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200">
                          <span className="font-extrabold text-brand-600 text-sm block">
                            ₺{order.total ? Number(order.total).toFixed(2) : '0.00'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleReorder(order)}
                            className="bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                          >
                            <i className="fa-solid fa-rotate-right text-[10px]"></i>
                            <span>Tekrar Sipariş Ver</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 text-xs italic py-2">
                    Henüz geçmiş siparişiniz bulunmuyor.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
                Size Gelen Bildirimler &amp; Duyurular
              </h4>
              {notifications.some((n) => n.scope === 'personal') && (
                <button
                  type="button"
                  onClick={handleClearPersonalNotifications}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Özel Mesajları Temizle
                </button>
              )}
            </div>

            {loadingNotifs ? (
              <p className="text-xs text-stone-400 py-6 text-center">Bildirimler yükleniyor...</p>
            ) : notifications.length === 0 ? (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 text-center space-y-2">
                <i className="fa-regular fa-bell-slash text-2xl text-stone-300"></i>
                <p className="text-xs font-semibold text-stone-600">Henüz bildiriminiz bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 dropdown-scroll">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-stone-900">{n.title}</span>
                      <span className="text-[10px] text-stone-400 shrink-0">
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : ''}
                      </span>
                    </div>
                    <p className="text-stone-600 leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={handleLogout}
            className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-5 py-3 rounded-xl text-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket"></i> Oturumu Kapat
          </button>
          <button
            onClick={() => dispatch(closeProfileModal())}
            className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
