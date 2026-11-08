'use client';

import { useSelector, useDispatch } from 'react-redux';
import {
  setActivePage,
  toggleMobileMenu,
  toggleCart,
  openAuthModal,
  openProfileModal
} from '@/store/slices/uiSlice';

export default function Navbar() {
  const dispatch = useDispatch();
  const { activePage, isMobileMenuOpen } = useSelector((state) => state.ui);
  const { totalCount, subtotal } = useSelector((state) => state.cart);
  const { currentUser } = useSelector((state) => state.auth);

  const navItems = [
    { id: 'home', label: 'Ana Sayfa' },
    { id: 'menu', label: 'Menü & Ürünler' },
    { id: 'kampanyalar', label: 'Kampanyalar' },
    { id: 'hikaye', label: 'Hikayemiz' },
    { id: 'iletisim', label: 'İletişim' }
  ];

  const initials = currentUser
    ? currentUser.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
    : '';

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <button
            onClick={() => dispatch(setActivePage('home'))}
            className="flex items-center gap-2.5 sm:gap-3 group shrink-0 text-left cursor-pointer"
          >
            <img
              src="/logo.png?v=2"
              alt="Sandviç Diyarı Logo"
              className="h-9 sm:h-11 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900">
                Sandviç
              </span>
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-brand-600">
                Diyarı
              </span>
            </div>
          </button>

          {/* Orta Menü Linkleri (Desktop) */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-stone-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => dispatch(setActivePage(item.id))}
                className={`transition-colors cursor-pointer ${activePage === item.id
                  ? 'font-bold text-brand-600'
                  : 'hover:text-brand-600'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Sağ Bölüm (Sepet ve Kullanıcı) */}
          <div className="flex items-center gap-3">
            {/* Sepet Butonu */}
            <button
              onClick={() => {
                if (!currentUser || !currentUser.email) {
                  dispatch(openAuthModal('login'));
                  return;
                }
                dispatch(toggleCart());
              }}
              className="relative bg-brand-50 hover:bg-brand-100 text-brand-900 p-3 rounded-2xl transition-all border border-brand-200 flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-bag-shopping text-lg"></i>
              <span id="cart-total-header" className="hidden sm:inline font-bold text-sm">
                ₺{subtotal.toFixed(2)}
              </span>
              {totalCount > 0 && (
                <span
                  id="cart-badge"
                  className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                >
                  {totalCount}
                </span>
              )}
            </button>

            {/* Üye Giriş / Profil Alanı */}
            <div id="user-nav-area" className="hidden sm:block">
              {currentUser ? (
                <button
                  onClick={() => dispatch(openProfileModal())}
                  className="flex items-center gap-2 bg-brand-50 hover:bg-brand-100 text-brand-900 px-4 py-2 rounded-xl font-semibold text-sm transition-all border border-brand-200 cursor-pointer"
                >
                  <div className="w-7 h-7 bg-brand-500 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                    {initials}
                  </div>
                  <span className="hidden sm:inline">{currentUser.name.split(' ')[0]}</span>
                </button>
              ) : (
                <button
                  onClick={() => dispatch(openAuthModal('login'))}
                  className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-user"></i>
                  <span>Giriş / Üye Ol</span>
                </button>
              )}
            </div>

            {/* Mobil Menü Butonu */}
            <button
              onClick={() => dispatch(toggleMobileMenu())}
              className="md:hidden text-stone-700 p-2 text-xl cursor-pointer"
            >
              <i className={isMobileMenuOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars"}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Mobil Açılır Menü */}
      {isMobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden bg-white border-t border-stone-200 px-4 py-4 space-y-3 shadow-lg">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => dispatch(setActivePage(item.id))}
              className={`block w-full text-left font-semibold py-2 transition-colors ${activePage === item.id ? 'text-brand-600' : 'text-stone-700'
                }`}
            >
              {item.label}
            </button>
          ))}
          <div id="mobile-auth-area" className="pt-2 border-t border-stone-100">
            {currentUser ? (
              <button
                onClick={() => dispatch(openProfileModal())}
                className="w-full bg-brand-50 text-brand-900 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-user-check"></i> Profilim & Siparişlerim
              </button>
            ) : (
              <button
                onClick={() => dispatch(openAuthModal('login'))}
                className="w-full bg-brand-500 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-user"></i> Giriş Yap / Üye Ol
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
