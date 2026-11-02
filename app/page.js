'use client';

import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setProducts } from '@/store/slices/productSlice';
import { login } from '@/store/slices/authSlice';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// Customer Pages
import HomePage from '@/components/pages/HomePage';
import MenuPage from '@/components/pages/MenuPage';
import KampanyalarPage from '@/components/pages/KampanyalarPage';
import HikayePage from '@/components/pages/HikayePage';
import IletisimPage from '@/components/pages/IletisimPage';

// Modals
import OptionsModal from '@/components/modals/OptionsModal';
import CartDrawer from '@/components/modals/CartDrawer';
import AuthModal from '@/components/modals/AuthModal';
import ProfileModal from '@/components/modals/ProfileModal';
import CheckoutModal from '@/components/modals/CheckoutModal';
import MessageModal from '@/components/modals/MessageModal';
import LiveOrderTracker from '@/components/LiveOrderTracker';
import FloatingCartBar from '@/components/FloatingCartBar';

export default function Home() {
  const dispatch = useDispatch();
  const { activePage } = useSelector((state) => state.ui);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('sd_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.email) {
          dispatch(login({ user: parsedUser }));
        }
      }
    } catch (e) {}

    const loadProducts = () => {
      fetch('/api/products')
        .then((res) => res.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            dispatch(setProducts(res.data));
          }
        })
        .catch((err) => console.error('Ürünler yüklenirken hata:', err));
    };

    loadProducts();

    // Cross-tab real-time sync when admin changes inventory
    const handleStorageChange = (e) => {
      if (e.key === 'sandwich_inventory_updated') {
        loadProducts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', loadProducts);

    // Periodic lightweight sync every 3 seconds for instant reaction
    const pollInterval = setInterval(loadProducts, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', loadProducts);
      clearInterval(pollInterval);
    };
  }, [dispatch]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Contact Bar */}
      <TopBar />

      {/* Main Navbar */}
      <Navbar />

      {/* Active Customer Page View */}
      <main className="flex-grow">
        {activePage === 'home' && <HomePage />}
        {activePage === 'menu' && <MenuPage />}
        {activePage === 'kampanyalar' && <KampanyalarPage />}
        {activePage === 'hikaye' && <HikayePage />}
        {activePage === 'iletisim' && <IletisimPage />}
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Interactive Global Modals */}
      <OptionsModal />
      <CartDrawer />
      <AuthModal />
      <ProfileModal />
      <CheckoutModal />
      <MessageModal />
      <LiveOrderTracker />
      <FloatingCartBar />
    </div>
  );
}
