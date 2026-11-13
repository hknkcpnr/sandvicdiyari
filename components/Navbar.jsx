'use client';

import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setActivePage,
  toggleMobileMenu,
  toggleCart,
  openAuthModal,
  openProfileModal,
  showMessageModal,
  setOnlyFavoritesFilter
} from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';
import CustomerNotificationBell from '@/components/CustomerNotificationBell';

export default function Navbar() {
  const dispatch = useDispatch();
  const { activePage, isMobileMenuOpen } = useSelector((state) => state.ui);
  const { totalCount, subtotal } = useSelector((state) => state.cart);
  const { currentUser } = useSelector((state) => state.auth);

  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Dışarı tıklandığında kullanıcı profil açılır menüsünü kapat
  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mobilde menü açıkken boşluğa (dışarı) tıklandığında/dokunulduğunda menüyü kapat
  useEffect(() => {
    function handleOutsideTap(event) {
      if (!isMobileMenuOpen) return;
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target) &&
        !event.target.closest('button[aria-label="Açılır Menü"]')
      ) {
        dispatch(toggleMobileMenu());
      }
    }
    document.addEventListener('mousedown', handleOutsideTap);
    document.addEventListener('touchstart', handleOutsideTap, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideTap);
      document.removeEventListener('touchstart', handleOutsideTap);
    };
  }, [isMobileMenuOpen, dispatch]);

  const navItems = [
    { id: 'home', label: 'Ana Sayfa', icon: 'fa-solid fa-house' },
    { id: 'menu', label: 'Menü & Ürünler', icon: 'fa-solid fa-burger' },
    { id: 'kampanyalar', label: 'Kampanyalar', icon: 'fa-solid fa-tags' },
    { id: 'hikaye', label: 'Hikayemiz', icon: 'fa-solid fa-book-open' },
    { id: 'iletisim', label: 'İletişim', icon: 'fa-solid fa-phone' }
  ];

  const initials = currentUser
    ? (currentUser.name || currentUser.username || currentUser.email || 'Ü')
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'Ü'
    : '';

  const isAdminUser = Boolean(
    currentUser && (
      currentUser.type === 'admin' ||
      currentUser.roleId === 'role_super_admin' ||
      currentUser.email === 'admin' ||
      String(currentUser.email || '').toLowerCase().includes('hknkcpnr')
    )
  );

  const isGuestUser = Boolean(
    currentUser && (
      currentUser.isGuest ||
      String(currentUser.id || '').startsWith('guest_') ||
      String(currentUser.email || '').startsWith('misafir_')
    )
  );

  const handleLogout = () => {
    setIsUserDropdownOpen(false);
    dispatch(logout());
    dispatch(
      showMessageModal({
        title: 'Çıkış Yapıldı',
        text: 'Hesabınızdan güvenle çıkış yapıldı.',
        type: 'info'
      })
    );
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-20">
          {/* Logo (Mobilde Kompakt & Minimal, Masaüstünde Ferah) */}
          <button
            onClick={() => dispatch(setActivePage('home'))}
            className="flex items-center gap-2 sm:gap-3 group shrink-0 text-left cursor-pointer"
          >
            <img
              src="/logo.png?v=2"
              alt="Sandviç Diyarı Logo"
              className="h-7 sm:h-11 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="text-base sm:text-2xl font-extrabold tracking-tight text-stone-900">
                Sandviç
              </span>
              <span className="text-base sm:text-2xl font-extrabold tracking-tight text-brand-600">
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
                onClick={() => {
                  if (item.id === 'menu') {
                    dispatch(setOnlyFavoritesFilter(false));
                  }
                  dispatch(setActivePage(item.id));
                }}
                className={`transition-colors cursor-pointer ${activePage === item.id
                  ? 'font-bold text-brand-600'
                  : 'hover:text-brand-600'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Sağ Bölüm (Bildirimler, Sepet ve Kullanıcı) */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Müşteri Bildirim Merkezi Zili */}
            <CustomerNotificationBell />

            {/* Sepet Butonu (Mobilde Minimalist, Masaüstünde Fiyat Detaylı) */}
            <button
              onClick={() => dispatch(toggleCart())}
              className="relative bg-brand-50 hover:bg-brand-100 text-brand-900 p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all border border-brand-200 flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-bag-shopping text-sm sm:text-lg"></i>
              <span id="cart-total-header" className="hidden sm:inline font-bold text-sm">
                ₺{subtotal.toFixed(2)}
              </span>
              {totalCount > 0 && (
                <span
                  id="cart-badge"
                  className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-brand-600 text-white text-[9px] sm:text-[11px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white"
                >
                  {totalCount}
                </span>
              )}
            </button>

            {/* Üye Giriş / Profil Alanı (Açılır Profil Menüsü) */}
            <div id="user-nav-area" className="hidden sm:block relative" ref={userDropdownRef}>
              {currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen((prev) => !prev)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl font-semibold text-sm transition-all border cursor-pointer ${
                      isUserDropdownOpen
                        ? 'bg-brand-500 text-white border-brand-600 shadow-md ring-2 ring-brand-500/20'
                        : 'bg-stone-50 hover:bg-brand-50 text-stone-800 hover:text-brand-900 border-stone-200/90 hover:border-brand-200 shadow-2xs'
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-xs ${
                        isUserDropdownOpen ? 'bg-white text-brand-600' : 'bg-gradient-to-tr from-brand-600 to-amber-500 text-white'
                      }`}>
                        {initials}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                    </div>

                    <div className="text-left hidden lg:block leading-tight">
                      <div className="text-xs font-bold truncate max-w-[120px]">
                        {currentUser.name}
                      </div>
                      <div className={`text-[10px] font-semibold ${isUserDropdownOpen ? 'text-brand-100' : isGuestUser ? 'text-amber-600' : 'text-stone-400'}`}>
                        {isAdminUser ? 'Yönetici' : isGuestUser ? 'Misafir Kişisi' : 'Üye Müşteri'}
                      </div>
                    </div>

                    <i className={`fa-solid fa-chevron-down text-[11px] transition-transform duration-250 ease-out ${
                      isUserDropdownOpen ? 'rotate-180 text-white' : 'text-stone-400'
                    }`}></i>
                  </button>

                  {/* PROFİL AÇILIR DROPDOWN MENÜSÜ */}
                  {isUserDropdownOpen && (
                    <div
                      style={{ backgroundColor: '#ffffff' }}
                      className="absolute right-0 mt-2.5 w-72 bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.22)] ring-1 ring-stone-900/5 border border-stone-200 pb-2 z-50 animate-dropdown overflow-hidden"
                    >
                      {/* Kullanıcı Başlık Kartı */}
                      <div className="px-4 py-3.5 bg-gradient-to-br from-stone-50 via-white to-amber-50 border-b border-stone-100 mb-1.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-stone-900 truncate">
                              {currentUser.name}
                            </p>
                            <p className="text-[11px] font-medium text-stone-500 truncate">
                              {currentUser.phone || (isGuestUser ? 'Misafir Oturumu' : currentUser.email)}
                            </p>
                            <span className={`inline-flex items-center gap-1 mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                              isGuestUser ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isGuestUser ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                              {isAdminUser ? 'Süper Yönetici' : isGuestUser ? 'Misafir Kişisi' : 'Aktif Oturum'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Menü Linkleri (Misafir kullanıcılar normal üye menülerini görmez) */}
                      {isGuestUser ? (
                        <div className="px-3 py-2 bg-white">
                          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] text-amber-900 flex items-start gap-2.5 leading-relaxed">
                            <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
                            <div>
                              <strong className="block font-extrabold text-amber-950 mb-0.5">
                                Geçici Misafir Oturumu
                              </strong>
                              <span>
                                Siparişiniz teslim edildikten sonra oturumunuz güvenlik amacıyla otomatik olarak silinecektir.
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-2 space-y-0.5 bg-white">
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              dispatch(openProfileModal());
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-stone-700 hover:text-brand-700 hover:bg-amber-50 rounded-xl transition-all cursor-pointer group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-stone-100 group-hover:bg-brand-100 text-stone-600 group-hover:text-brand-700 flex items-center justify-center transition-colors shrink-0">
                              <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                            </div>
                            <span>Sipariş Geçmişim &amp; Takip</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              dispatch(openProfileModal());
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-stone-700 hover:text-brand-700 hover:bg-amber-50 rounded-xl transition-all cursor-pointer group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-stone-100 group-hover:bg-brand-100 text-stone-600 group-hover:text-brand-700 flex items-center justify-center transition-colors shrink-0">
                              <i className="fa-solid fa-user-gear text-xs"></i>
                            </div>
                            <span>Profil &amp; Adres Bilgilerim</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              dispatch(setOnlyFavoritesFilter(true));
                              dispatch(setActivePage('menu'));
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-stone-700 hover:text-brand-700 hover:bg-amber-50 rounded-xl transition-all cursor-pointer group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-stone-100 group-hover:bg-brand-100 text-stone-600 group-hover:text-brand-700 flex items-center justify-center transition-colors shrink-0">
                              <i className="fa-solid fa-heart text-xs"></i>
                            </div>
                            <span>Favori Sandviçlerim</span>
                          </button>

                          {/* Admin Portalı Linki (Yetkili İse) */}
                          {isAdminUser && (
                            <a
                              href="/admin"
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-amber-900 bg-amber-50/80 hover:bg-amber-100 rounded-xl transition-all cursor-pointer group border border-amber-200 my-1.5"
                            >
                              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
                                <i className="fa-solid fa-shield-halved text-xs"></i>
                              </div>
                              <span className="flex-1 truncate">Yönetici Paneline Git</span>
                              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-amber-600"></i>
                            </a>
                          )}
                        </div>
                      )}

                      <div className="border-t border-stone-100 mt-1.5 pt-1.5 px-2 bg-white">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-100 flex items-center justify-center transition-colors shrink-0">
                            <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                          </div>
                          <span>Oturumu Kapat</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => dispatch(openAuthModal('login'))}
                  className="flex items-center gap-2 bg-gradient-to-r from-stone-900 to-stone-800 hover:from-stone-800 hover:to-brand-600 text-white px-4 py-2.5 rounded-2xl font-bold text-xs tracking-wide shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  <i className="fa-solid fa-user-lock group-hover:scale-110 transition-transform"></i>
                  <span>Giriş / Üye Ol</span>
                </button>
              )}
            </div>

            {/* Mobil Menü Butonu (Kompakt & Minimal & Animasyonlu) */}
            <button
              onClick={() => dispatch(toggleMobileMenu())}
              aria-label="Açılır Menü"
              className={`md:hidden p-2 rounded-xl text-sm transition-all duration-300 cursor-pointer border flex items-center justify-center shrink-0 ${
                isMobileMenuOpen
                  ? 'bg-brand-500 text-white border-brand-600 shadow-md rotate-90 scale-105'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200 rotate-0'
              }`}
            >
              <i className={isMobileMenuOpen ? 'fa-solid fa-xmark text-sm' : 'fa-solid fa-bars-staggered text-sm'}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Mobil Açılır Menü (Slide Down Drawer & Akıcı Animasyon) */}
      {isMobileMenuOpen && (
        <>
          {/* Boşluğa / dışarı tıklandığında menüyü anında kapatan arka plan katmanı */}
          <div
            onClick={() => dispatch(toggleMobileMenu())}
            className="fixed inset-0 top-14 sm:top-20 bg-stone-900/35 backdrop-blur-2xs z-40 md:hidden animate-in fade-in duration-200"
            aria-hidden="true"
          />

          <div
            id="mobile-menu"
            ref={mobileMenuRef}
            style={{ backgroundColor: '#ffffff' }}
            className="md:hidden border-t border-stone-200 bg-white px-4 py-3.5 shadow-2xl animate-mobile-menu space-y-2 relative z-50 origin-top"
          >
          {/* Sayfa Navigasyon Linkleri */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'menu') {
                      dispatch(setOnlyFavoritesFilter(false));
                    }
                    dispatch(setActivePage(item.id));
                    dispatch(toggleMobileMenu());
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-98 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-amber-500 text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <i className={`${item.icon} text-sm w-4 text-center ${isActive ? 'text-white' : 'text-stone-400'}`}></i>
                    <span>{item.label}</span>
                  </div>
                  {isActive && <i className="fa-solid fa-check text-xs"></i>}
                </button>
              );
            })}
          </div>

          {/* Mobil Kullanıcı Alanı */}
          <div id="mobile-auth-area" className="pt-2 border-t border-stone-100 space-y-1.5">
            {currentUser ? (
              isGuestUser ? (
                <>
                  <div className="w-full bg-amber-50/90 border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-extrabold text-stone-900 truncate">
                          {currentUser.name}
                        </div>
                        <div className="text-[10px] font-bold text-amber-700">
                          Misafir Kişisi
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] font-medium text-amber-900 leading-relaxed flex items-start gap-1.5">
                      <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
                      <span>Siparişiniz teslim edildikten sonra misafir oturumunuz otomatik olarak silinecektir.</span>
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      handleLogout();
                      dispatch(toggleMobileMenu());
                    }}
                    className="w-full text-rose-600 hover:bg-rose-50 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                    <span>Oturumu Kapat</span>
                  </button>
                </>
              ) : (
              <>
                <button
                  onClick={() => {
                    dispatch(openProfileModal());
                    dispatch(toggleMobileMenu());
                  }}
                  className="w-full bg-gradient-to-r from-brand-50 to-amber-50/80 border border-brand-200/80 text-brand-900 font-bold py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-between shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <span className="truncate">{currentUser.name} • Profil &amp; Siparişler</span>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[10px] text-brand-600"></i>
                </button>

                <button
                  onClick={() => {
                    dispatch(setOnlyFavoritesFilter(true));
                    dispatch(setActivePage('menu'));
                    dispatch(toggleMobileMenu());
                  }}
                  className="w-full bg-rose-50/70 hover:bg-rose-50 border border-rose-200/80 text-rose-800 font-bold py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <i className="fa-solid fa-heart text-rose-500"></i>
                    <span>Favori Sandviçlerim</span>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[10px] text-rose-500"></i>
                </button>

                {isAdminUser && (
                  <a
                    href="/admin"
                    className="w-full bg-stone-900 text-amber-400 font-bold py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-shield-halved text-amber-400"></i>
                      <span>Yönetici Paneline Git</span>
                    </div>
                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </a>
                )}

                <button
                  onClick={() => {
                    handleLogout();
                    dispatch(toggleMobileMenu());
                  }}
                  className="w-full text-rose-600 hover:bg-rose-50 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                  <span>Oturumu Kapat</span>
                </button>
              </>
              )
            ) : (
              <button
                onClick={() => {
                  dispatch(openAuthModal('login'));
                  dispatch(toggleMobileMenu());
                }}
                className="w-full bg-gradient-to-r from-stone-900 to-stone-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <i className="fa-solid fa-user-lock"></i>
                <span>Giriş Yap / Üye Ol</span>
              </button>
            )}
          </div>
        </div>
      </>
    )}
    </nav>
  );
}
