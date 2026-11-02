'use client';

import { useSelector, useDispatch } from 'react-redux';
import { closeProfileModal, showMessageModal, toggleCart } from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';
import { addToCart } from '@/store/slices/cartSlice';

export default function ProfileModal() {
  const dispatch = useDispatch();
  const { isProfileModalOpen } = useSelector((state) => state.ui);
  const { currentUser } = useSelector((state) => state.auth);
  const { items: products } = useSelector((state) => state.product);

  if (!isProfileModalOpen || !currentUser) return null;

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

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
                price: Number(item.price) || (json.data.total / json.data.items.length),
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
        const fallbackProd = products && products.length > 0 ? products[0] : { id: 1, name: 'Maxi Karışık Menü', price: 450, image: '/images/hero_banner.jpg' };
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-7 sm:p-10 shadow-2xl relative space-y-6 animate-in fade-in zoom-in-95 duration-200">
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

        <div className="space-y-4">
          <h4 className="font-bold text-stone-900 text-sm uppercase tracking-wider">
            Kayıtlı Adres & İletişim Bilgileriniz
          </h4>
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs space-y-2 text-stone-700">
            <p>
              <strong>Telefon:</strong> <span id="profile-phone-display">{currentUser.phone || '-'}</span>
            </p>
            <p>
              <strong>Adres:</strong> <span id="profile-address-display">{currentUser.address || '-'}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="font-bold text-stone-900 text-sm uppercase tracking-wider">
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
                        <span className="font-bold text-stone-900 block">Sipariş No: {order.id}</span>
                        <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                          {order.status || 'Teslim Edildi'}
                        </span>
                      </div>
                      <span className="text-stone-500 block mt-0.5 line-clamp-2">{order.items}</span>
                      <span className="text-stone-400 block mt-1">{order.date}</span>
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
