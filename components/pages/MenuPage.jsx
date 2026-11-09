'use client';

import { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setCategory } from '@/store/slices/productSlice';
import { openAuthModal, setOnlyFavoritesFilter } from '@/store/slices/uiSlice';
import ProductCard from '@/components/ProductCard';

/**
 * ============================================================================
 * MenuPage (Minimalist & Mobil Uyumlu Menü Sayfası)
 * ============================================================================
 * Mobil cihazlarda kaydırılabilir (swipeable) kategori hapları, kompakt arama
 * ve ergonomik filtreleme alanına sahip minimalist ürün kataloğu.
 */
export default function MenuPage() {
  const dispatch = useDispatch();
  const { items: products, category } = useSelector((state) => state.product);
  const { favorites, onlyFavoritesFilter } = useSelector((state) => state.ui);
  const { currentUser } = useSelector((state) => state.auth);
  const isMember = Boolean(currentUser && currentUser.email);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price-asc' | 'price-desc' | 'name'
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const onlyFavorites = isMember && onlyFavoritesFilter;

  // Menü Kategorileri
  const categories = [
    { id: 'all', label: 'Tüm Menü', icon: 'fa-solid fa-border-all' },
    { id: 'menu', label: 'Menüler', icon: 'fa-solid fa-utensils' },
    { id: 'sandwich', label: 'Sandviçler', icon: 'fa-solid fa-burger' },
    { id: 'snack', label: 'Atıştırmalık', icon: 'fa-solid fa-french-fries' },
    { id: 'drink', label: 'İçecekler', icon: 'fa-solid fa-cup-straw' },
  ];

  // Türkçe arama normalizasyonu (Büyük-küçük harf & Türkçe karakter desteği)
  function normalizeText(text) {
    if (!text) return '';
    return text
      .toLocaleLowerCase('tr-TR')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
  }

  // Ürün Filtreleme ve Sıralama
  const filteredProducts = useMemo(() => {
    let list = category === 'all'
      ? [...products]
      : products.filter((p) => p.category === category);

    if (onlyAvailable) {
      list = list.filter((p) => p.isAvailable !== false);
    }

    if (onlyFavorites) {
      list = list.filter((p) => favorites.includes(p.id));
    }

    if (searchTerm.trim()) {
      const q = normalizeText(searchTerm.trim());
      list = list.filter(
        (p) =>
          normalizeText(p.name).includes(q) ||
          normalizeText(p.description).includes(q) ||
          normalizeText(p.badge).includes(q)
      );
    }

    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    }

    return list;
  }, [products, category, searchTerm, sortBy, onlyAvailable, onlyFavorites, favorites]);

  return (
    <div id="page-menu" className="page-content animate-in fade-in duration-300">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-5 sm:space-y-6">
        
        {/* Minimalist Sayfa Başlığı */}
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-[11px] font-bold text-brand-600 uppercase tracking-widest">
            Sandviç Diyarı Menüsü
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Damak Tadına Uygun Lezzeti Seç
          </h3>
          <p className="text-stone-500 text-xs sm:text-sm">
            Taze fırınlanmış ekmekler, zengin menüler ve sıcak atıştırmalıklar.
          </p>
        </div>

        {/* =================================================================== */}
        {/* MOBİL VE MASAÜSTÜ FİLTRE VE ARAMA KONTROLLERİ                      */}
        {/* =================================================================== */}
        <div className="max-w-4xl mx-auto space-y-3">
          
          {/* 1. Kategori Hapları (Mobilde yatay kaydırılabilir, masaüstünde ortalı) */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto no-scrollbar py-1 sm:justify-center">
            {categories.map((cat) => {
              const isActive = category === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`cat-btn-${cat.id}`}
                  onClick={() => dispatch(setCategory(cat.id))}
                  className={`category-btn shrink-0 px-3.5 sm:px-4 py-2 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  <i className={`${cat.icon} text-[11px]`}></i>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* 2. Arama ve Filtre / Sıralama Barı */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Arama Kutusu */}
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Lezzet ara (Örn: Köfte, Dürüm, Ayvalık)..."
                className="w-full bg-white border border-stone-200/90 rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:bg-white shadow-2xs transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center cursor-pointer"
                  title="Aramayı Temizle"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Hızlı Filtre Butonları & Sıralama Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Sıralama */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="app-select bg-white hover:bg-stone-50 border border-stone-200 hover:border-brand-400 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-brand-500 shadow-2xs cursor-pointer flex-1 sm:flex-initial transition-all"
              >
                <option value="default">✨ Önerilen Sıralama</option>
                <option value="price-asc">💵 Fiyat: En Düşük</option>
                <option value="price-desc">💎 Fiyat: En Yüksek</option>
                <option value="name">🔤 İsim: A'dan Z'ye</option>
              </select>

              {/* Sadece Açık / Stokta Olanlar */}
              <button
                onClick={() => setOnlyAvailable(!onlyAvailable)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  onlyAvailable
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-stone-600 border-stone-200/90 hover:bg-stone-50'
                }`}
                title="Sadece stokta olanları göster"
              >
                <i className={`fa-solid ${onlyAvailable ? 'fa-circle-check text-emerald-600' : 'fa-circle text-stone-300 text-[10px]'}`}></i>
                <span className="hidden xs:inline text-[11px]">Açık</span>
              </button>

              {/* Favoriler Filtresi (Sadece Üyelere Özel) */}
              <button
                onClick={() => {
                  if (!isMember) {
                    dispatch(
                      openAuthModal({
                        tab: 'login',
                        notice:
                          'Favori ürün listenizi görüntülemek ve ürün eklemek sadece üyelere özeldir. Lütfen üye girişi yapın.'
                      })
                    );
                    return;
                  }
                  dispatch(setOnlyFavoritesFilter(!onlyFavorites));
                }}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  onlyFavorites
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-white text-stone-600 border-stone-200/90 hover:bg-stone-50'
                }`}
                title={isMember ? 'Favori ürünlerimi göster' : 'Favoriler için üye girişi yapın'}
              >
                <i className={`fa-heart text-xs ${onlyFavorites ? 'fa-solid text-rose-600' : 'fa-regular text-stone-400'}`}></i>
                {isMember && favorites.length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {favorites.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 3. Sonuç Sayısı ve Aktif Filtre Bilgisi */}
          <div className="flex items-center justify-between text-[11px] text-stone-500 px-1 pt-1 border-t border-stone-100">
            <span>
              <strong>{filteredProducts.length}</strong> lezzet listeleniyor
              {onlyFavorites && <span className="ml-1 text-rose-600 font-bold">(Favorilerim)</span>}
            </span>
            {(searchTerm || onlyAvailable || onlyFavorites || sortBy !== 'default' || category !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setOnlyAvailable(false);
                  dispatch(setOnlyFavoritesFilter(false));
                  setSortBy('default');
                  dispatch(setCategory('all'));
                }}
                className="text-brand-600 hover:text-brand-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate-left text-[10px]"></i> Filtreleri Temizle
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* ÜRÜN LİSTESİ (GRID)                                                 */}
        {/* =================================================================== */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-stone-50 rounded-2xl border border-stone-200/80 max-w-md mx-auto space-y-3 px-4">
            <div className="w-12 h-12 bg-white rounded-xl shadow-xs text-stone-400 flex items-center justify-center text-xl mx-auto">
              <i className={`fa-solid ${onlyFavorites && !searchTerm ? 'fa-heart-crack text-rose-400' : 'fa-utensils'}`}></i>
            </div>
            <h4 className="text-base font-bold text-stone-800">
              {onlyFavorites && !searchTerm ? 'Henüz Favori Ürününüz Yok' : 'Aradığınız Lezzet Bulunamadı'}
            </h4>
            <p className="text-stone-500 text-xs">
              {onlyFavorites && !searchTerm
                ? 'Menüdeki ürün kartlarının sağ üst köşesindeki kalp ikonuna tıklayarak sevdiğiniz lezzetleri favorilerinize ekleyebilirsiniz.'
                : `"${searchTerm}" ile eşleşen bir ürün bulunamadı. Lütfen farklı bir arama deneyin.`}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                dispatch(setCategory('all'));
                setOnlyAvailable(false);
                dispatch(setOnlyFavoritesFilter(false));
              }}
              className="bg-stone-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              Tüm Menüyü Göster
            </button>
          </div>
        ) : (
          <div id="product-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
