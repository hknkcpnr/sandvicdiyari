'use client';

import { useSelector, useDispatch } from 'react-redux';
import { toggleCart, openCheckoutModal, openAuthModal } from '@/store/slices/uiSlice';

export default function FloatingCartBar() {
  const dispatch = useDispatch();
  const { totalCount, grandTotal } = useSelector((state) => state.cart);
  const { currentUser } = useSelector((state) => state.auth);
  const { isCartOpen, isCheckoutModalOpen, isOptionsModalOpen, isAuthModalOpen } = useSelector(
    (state) => state.ui
  );

  if (
    totalCount === 0 ||
    isCartOpen ||
    isCheckoutModalOpen ||
    isOptionsModalOpen ||
    isAuthModalOpen
  ) {
    return null;
  }

  const handleQuickCheckout = (e) => {
    e.stopPropagation();
    if (currentUser) {
      dispatch(openCheckoutModal({ isGuest: Boolean(currentUser.isGuest) }));
    } else {
      dispatch(openAuthModal('guest'));
    }
  };

  return (
    <aside
      aria-label="Hızlı Sepet Çubuğu"
      className="fixed bottom-4 inset-x-3.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-30 animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="w-full bg-stone-900/95 backdrop-blur-md text-white rounded-2xl p-2 sm:p-2.5 shadow-[0_12px_35px_rgba(0,0,0,0.35)] border border-stone-700/80 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => dispatch(toggleCart())}
          className="flex items-center gap-3 px-2 py-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer min-w-0 flex-1 text-left"
        >
          <div className="relative w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center font-bold text-sm shrink-0">
            <i className="fa-solid fa-bag-shopping text-base"></i>
            <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
              {totalCount}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-extrabold text-white block leading-tight truncate">
              Sepetiniz ({totalCount} Ürün)
            </span>
            <span className="text-[11px] text-stone-400 block leading-tight mt-0.5">
              İncelemek için dokunun
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleQuickCheckout}
          className="bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-brand-500/25 flex items-center gap-2 shrink-0 cursor-pointer transition-all"
        >
          <span>Siparişi Tamamla</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-black">
            ₺{grandTotal.toFixed(2)}
          </span>
        </button>
      </div>
    </aside>
  );
}
