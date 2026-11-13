'use client';

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleCart, openCheckoutModal, openAuthModal, showMessageModal } from '@/store/slices/uiSlice';
import { changeQuantity, removeItem, applyCoupon, removeCoupon, addToCart, VALID_COUPONS } from '@/store/slices/cartSlice';
import { getRestaurantStatus, MIN_ORDER_AMOUNT } from '@/lib/openingHours';

const QUICK_CROSS_SELLS = [
  {
    id: 30,
    name: 'Porsiyon Çıtır Patates',
    price: 180,
    image: '/images/loaded_cheddar_fries.jpg',
    category: 'snack'
  },
  {
    id: 36,
    name: 'Büyük Ayran (300ml)',
    price: 40,
    image: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?auto=format&fit=crop&q=80&w=300',
    category: 'drink'
  },
  {
    id: 34,
    name: '1 Litre Soğuk Pepsi',
    price: 70,
    image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&q=80&w=300',
    category: 'drink'
  },
  {
    id: 32,
    name: "8'li Altın Soğan Halkası",
    price: 180,
    image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&q=80&w=300',
    category: 'snack'
  }
];

export default function CartDrawer() {
  const dispatch = useDispatch();
  const { isCartOpen } = useSelector((state) => state.ui);
  const { items, totalCount, subtotal, discountAmount, grandTotal, coupon } = useSelector((state) => state.cart);
  const { currentUser } = useSelector((state) => state.auth);

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const restaurantStatus = getRestaurantStatus();

  if (!isCartOpen) return null;

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    setCouponError('');
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;

    if (!VALID_COUPONS[code]) {
      setCouponError('Geçersiz kupon kodu! (Deneyebileceğiniz kodlar: TORBALI10, GECEIKRAMI, SANDVIC)');
      return;
    }

    const c = VALID_COUPONS[code];
    if (subtotal < c.minSubtotal) {
      setCouponError(`Bu kupon için sepet tutarınız en az ₺${c.minSubtotal} olmalıdır.`);
      return;
    }

    dispatch(applyCoupon(code));
    setCouponCodeInput('');
    dispatch(
      showMessageModal({
        title: 'Kupon Uygulandı! 🎉',
        text: `"${code}" kuponu ile ${c.label} başarıyla uygulandı.`,
        type: 'success',
      })
    );
  };

  const handleQuickAdd = (item) => {
    dispatch(
      addToCart({
        product: item,
        sauces: {},
        extras: [],
        note: '',
        drink: null
      })
    );
  };

  return (
    <div id="cart-drawer" className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
        onClick={() => dispatch(toggleCart())}
      ></div>

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-6 bg-stone-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <i className="fa-solid fa-bag-shopping text-white"></i>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Alışveriş Sepetim</h3>
                <span id="cart-item-count" className="text-xs text-stone-400">
                  {totalCount} ürün
                </span>
              </div>
            </div>
            <button
              onClick={() => dispatch(toggleCart())}
              className="w-9 h-9 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Items Container */}
          <div
            id="cart-items-container"
            className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-stone-100"
          >
            {items.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center text-2xl mx-auto">
                  <i className="fa-solid fa-basket-shopping"></i>
                </div>
                <h4 className="font-bold text-stone-800 text-base">Sepetiniz Boş</h4>
                <p className="text-stone-400 text-xs">
                  Lezzetli sandviçlerimizden hemen eklemeye başlayın.
                </p>
              </div>
            ) : (
              <>
                {items.map((item) => (
                  <div key={item.cartKey} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-2xl object-cover bg-stone-100 border border-stone-200 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=200';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-sm text-stone-900 truncate">{item.name}</h5>
                      <span className="text-xs font-semibold text-brand-600 block mt-0.5">
                        ₺{item.price.toFixed(2)}
                      </span>
                      {item.details && (
                        <p className="text-[10px] text-stone-500 mt-1 leading-relaxed bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                          {item.details}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() =>
                            dispatch(changeQuantity({ cartKey: item.cartKey, delta: -1 }))
                          }
                          className="w-7 h-7 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-minus"></i>
                        </button>
                        <span className="text-xs font-bold text-stone-800 w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            dispatch(changeQuantity({ cartKey: item.cartKey, delta: 1 }))
                          }
                          className="w-7 h-7 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-plus"></i>
                        </button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-sm text-stone-900 block">
                        ₺{(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => dispatch(removeItem({ cartKey: item.cartKey }))}
                        className="text-stone-400 hover:text-red-500 text-xs mt-2 transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can"></i> Kaldır
                      </button>
                    </div>
                  </div>
                ))}

                {/* Akıllı Çapraz Satış (Cross-Sell Önerileri) */}
                <div className="pt-4 border-t border-stone-100 space-y-2.5">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                    <span>Yanına Çok İyi Gider:</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_CROSS_SELLS.map((cs) => (
                      <div
                        key={cs.id}
                        className="bg-stone-50 border border-stone-200/80 rounded-2xl p-2.5 flex items-center justify-between gap-2 hover:border-brand-300 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-stone-800 block truncate">
                            {cs.name}
                          </span>
                          <span className="text-[10px] text-brand-600 font-extrabold">
                            +₺{cs.price}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(cs)}
                          className="bg-white hover:bg-brand-500 hover:text-white text-stone-700 border border-stone-200 text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                          title="Sepete Ekle"
                        >
                          + Ekle
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kupon Kodu Bölümü */}
                <div className="pt-4 border-t border-stone-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-700">İndirim Kuponu</span>
                    <span className="text-[10px] text-stone-400">Örn: TORBALI10</span>
                  </div>

                  {coupon ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <i className="fa-solid fa-tag text-emerald-600"></i>
                        <span>{coupon.label} (-₺{discountAmount.toFixed(2)})</span>
                      </div>
                      <button
                        onClick={() => dispatch(removeCoupon())}
                        className="text-stone-400 hover:text-rose-600 text-xs font-semibold cursor-pointer"
                        title="Kuponu Kaldır"
                      >
                        Kaldır
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value)}
                        placeholder="Kupon Kodunuz"
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium uppercase text-stone-800 focus:outline-none focus:border-brand-500"
                      />
                      <button
                        type="submit"
                        className="bg-stone-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        Uygula
                      </button>
                    </form>
                  )}

                  {couponError && (
                    <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 sm:p-6 bg-stone-50 border-t border-stone-200 space-y-3.5">
            {/* Kapalı Saat Uyarısı */}
            {!restaurantStatus.isOpen && items.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-3 text-xs flex items-start gap-2.5">
                <i className="fa-solid fa-moon text-amber-600 text-sm mt-0.5 shrink-0"></i>
                <div className="leading-snug">
                  <span className="font-bold block">Şu An Kapalıyız (Açılış: 10:00)</span>
                  <span className="text-[11px] text-amber-800">
                    Siparişinizi tamamlayabilirsiniz; sabah saat 10:00'da fırından taptaze çıkarak ilk sırada teslim edilecektir.
                  </span>
                </div>
              </div>
            )}

            {/* Asgari Paket Servis Limiti Kontrolü */}
            {items.length > 0 && grandTotal < MIN_ORDER_AMOUNT && (
              <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-rose-800">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                    <span>Min. Paket Servis: ₺{MIN_ORDER_AMOUNT}</span>
                  </span>
                  <span className="text-rose-600">Kalan: ₺{(MIN_ORDER_AMOUNT - grandTotal).toFixed(2)}</span>
                </div>
                <div className="w-full bg-rose-200/80 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (grandTotal / MIN_ORDER_AMOUNT) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-rose-700 leading-tight">
                  Torbalı içi kapıya sıcak teslimat için sepetinize ₺{(MIN_ORDER_AMOUNT - grandTotal).toFixed(2)} tutarında ürün daha ekleyiniz.
                </p>
              </div>
            )}

            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Ara Toplam</span>
                <span id="cart-subtotal" className="font-semibold text-stone-800">
                  ₺{subtotal.toFixed(2)}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Kupon İndirimi</span>
                  <span>-₺{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Paket Servis Ücreti</span>
                <span className="text-emerald-600 font-bold">Ücretsiz</span>
              </div>

              <div className="flex justify-between text-base font-extrabold text-stone-900 pt-2 border-t border-stone-200">
                <span>Toplam Tutar</span>
                <span id="cart-grand-total" className="text-brand-600">
                  ₺{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Hızlı Sipariş / Misafir Seçeneği Bilgilendirmesi */}
            {items.length > 0 && !currentUser && (
              <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3 text-xs flex items-start gap-2.5">
                <i className="fa-solid fa-bolt text-emerald-600 text-sm mt-0.5 shrink-0"></i>
                <div className="leading-snug text-emerald-950">
                  <span className="font-bold block">Hızlı Sipariş İmkanı</span>
                  <span className="text-[11px] text-emerald-800">
                    Devam ettiğinizde ister <strong>Misafir Olarak Devam Et</strong> butonuna basıp hızlıca sipariş verebilir, ister <strong>Giriş Yap</strong>abilirsiniz.
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                dispatch(openCheckoutModal());
              }}
              id="checkout-btn"
              disabled={items.length === 0 || grandTotal < MIN_ORDER_AMOUNT}
              className={`w-full font-bold py-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                items.length === 0 || grandTotal < MIN_ORDER_AMOUNT
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed shadow-none'
                  : 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/20'
              }`}
            >
              <span>
                {items.length === 0
                  ? 'Sepetiniz Boş'
                  : grandTotal < MIN_ORDER_AMOUNT
                  ? `Min. Sipariş ₺${MIN_ORDER_AMOUNT} (₺${(MIN_ORDER_AMOUNT - grandTotal).toFixed(2)} Eksik)`
                  : !restaurantStatus.isOpen
                  ? '10:00 İçin Siparişi Tamamla'
                  : 'Siparişi Tamamla'}
              </span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
