'use client';

import { useDispatch, useSelector } from 'react-redux';
import { openOptionsModal, openAuthModal, toggleFavorite } from '@/store/slices/uiSlice';

function getCategoryName(cat) {
  switch (cat) {
    case 'menu':
      return 'Menü';
    case 'sandwich':
      return 'Sandviç';
    case 'snack':
      return 'Atıştırmalık';
    case 'drink':
      return 'İçecek';
    default:
      return 'Ürün';
  }
}

/**
 * ============================================================================
 * ProductCard (Minimalist & Mobil Odaklı Ürün Kartı)
 * ============================================================================
 * Sade, ferah ve mobil ekranlarda ergonomik dokunma alanlarına sahip
 * modern ürün kartı bileşeni.
 */
export default function ProductCard({ product }) {
  const dispatch = useDispatch();
  const { favorites } = useSelector((state) => state.ui);
  const { currentUser } = useSelector((state) => state.auth);
  const isMember = Boolean(currentUser && currentUser.email);
  const isFavorite = isMember && Array.isArray(favorites) && favorites.includes(product.id);
  const isAvailable = product.isAvailable !== false;

  const handleOrderClick = () => {
    dispatch(openOptionsModal(product));
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    if (!isMember) {
      dispatch(
        openAuthModal({
          tab: 'login',
          notice:
            'Favorilere ürün eklemek sadece üyelere özeldir. Lütfen üye girişi yapın veya ücretsiz üye olun.'
        })
      );
      return;
    }
    dispatch(toggleFavorite({ id: product.id, email: currentUser.email }));
  };

  return (
    <div
      className={`bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-stone-200/80 transition-all duration-200 flex flex-col justify-between group ${
        isAvailable
          ? 'hover:border-stone-300 hover:shadow-md'
          : 'opacity-75 bg-stone-50/60'
      }`}
    >
      <div>
        {/* Ürün Görseli & Minimalist Rozetler */}
        <div className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden mb-3 sm:mb-4 bg-stone-100">
          <img
            src={product.image}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-500 ${
              isAvailable ? 'group-hover:scale-105' : 'grayscale contrast-75 opacity-60'
            }`}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src =
                'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=500';
            }}
          />

          {/* Minimal Kategori / Özel Rozet */}
          <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider z-10 shadow-xs">
            {product.badge || getCategoryName(product.category)}
          </span>

          {/* Minimal Favori Butonu (Sadece Üyelere Özel) */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            className={`absolute top-2.5 right-2.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-transform z-10 cursor-pointer active:scale-90 ${
              isFavorite
                ? 'bg-rose-500 text-white shadow-xs'
                : 'bg-white/85 hover:bg-white text-stone-500 hover:text-rose-500 shadow-2xs'
            }`}
            title={
              !isMember
                ? 'Favorilere eklemek için üye girişi yapın'
                : isFavorite
                ? 'Favorilerden Çıkar'
                : 'Favorilere Ekle'
            }
            aria-label={!isMember ? 'Üye Girişi ile Favorilere Ekle' : 'Favorilere Ekle'}
          >
            <i className={`fa-heart text-[11px] sm:text-xs ${isFavorite ? 'fa-solid' : 'fa-regular'}`}></i>
          </button>

          {/* Tükendi Katmanı */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-[2px] flex items-center justify-center z-10">
              <span className="bg-rose-600 text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                <i className="fa-solid fa-ban text-[10px]"></i> Tükendi
              </span>
            </div>
          )}
        </div>

        {/* Başlık, Açıklama ve Kritik Stok */}
        <div className="space-y-1">
          <h4
            className={`font-bold text-sm sm:text-base leading-snug transition-colors line-clamp-1 sm:line-clamp-2 ${
              isAvailable ? 'text-stone-900 group-hover:text-brand-600' : 'text-stone-500'
            }`}
          >
            {product.name}
          </h4>

          <p className="text-stone-500 text-xs leading-relaxed line-clamp-2">
            {product.description}
          </p>

          {/* Kritik Stok Bildirimi */}
          {isAvailable &&
            product.trackStock !== false &&
            typeof product.stock === 'number' &&
            product.stock > 0 &&
            product.stock <= (product.criticalThreshold || 5) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md mt-1">
                <i className="fa-solid fa-fire text-amber-500 text-[9px]"></i>
                Son {product.stock} adet
              </span>
            )}
        </div>
      </div>

      {/* Alt Alan: Fiyat ve Ekle Butonu */}
      <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className={`text-base sm:text-lg font-black tracking-tight ${isAvailable ? 'text-stone-900' : 'text-stone-400'}`}>
            ₺{product.price.toFixed(2)}
          </span>
        </div>

        {isAvailable ? (
          <button
            onClick={handleOrderClick}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            <span>Ekle</span>
          </button>
        ) : (
          <button
            disabled
            className="h-9 px-3 rounded-xl bg-stone-100 text-stone-400 text-xs font-semibold cursor-not-allowed shrink-0"
          >
            Tükendi
          </button>
        )}
      </div>
    </div>
  );
}
