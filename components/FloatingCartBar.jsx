'use client';

import { useSelector, useDispatch } from 'react-redux';
import { toggleCart } from '@/store/slices/uiSlice';

export default function FloatingCartBar() {
  const dispatch = useDispatch();
  const { totalCount, grandTotal } = useSelector((state) => state.cart);
  const { isCartOpen, isCheckoutModalOpen } = useSelector((state) => state.ui);

  if (totalCount === 0 || isCartOpen || isCheckoutModalOpen) {
    return null;
  }

  return (
    <aside aria-label="Mobil Sepet Çubuğu" className="md:hidden fixed bottom-4 inset-x-3.5 z-30 animate-in slide-in-from-bottom-5 duration-300">
      <button
        type="button"
        onClick={() => dispatch(toggleCart())}
        className="w-full bg-brand-600 hover:bg-brand-700 active:scale-98 text-white rounded-2xl px-4 py-3 shadow-[0_8px_30px_rgb(234,88,12,0.4)] border border-brand-400/30 flex items-center justify-between cursor-pointer transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm shrink-0">
            <i className="fa-solid fa-bag-shopping text-base"></i>
            <span className="absolute -top-1 -right-1 bg-white text-brand-700 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
              {totalCount}
            </span>
          </div>
          <div className="text-left">
            <span className="text-xs font-bold block leading-tight">Sepetiniz</span>
            <span className="text-[11px] text-brand-100 block leading-tight">
              {totalCount} Adet Ürün Seçildi
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold text-white">
            ₺{grandTotal.toFixed(2)}
          </span>
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs">
            <i className="fa-solid fa-arrow-right"></i>
          </div>
        </div>
      </button>
    </aside>
  );
}
