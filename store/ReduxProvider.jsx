'use client';

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { CART_STORAGE_KEY, hydrateCart } from './slices/cartSlice';

export default function ReduxProvider({ children }) {
  useEffect(() => {
    const loadSavedCart = () => {
      try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          store.dispatch(hydrateCart(parsed));
        }
      } catch {}
    };

    // 1. Sayfa açılışında kayıtlı sepeti geri yükle
    loadSavedCart();

    // 2. Sepet her değiştiğinde localStorage'a kaydet
    let lastSerialized = '';
    const unsubscribe = store.subscribe(() => {
      try {
        const { items, coupon } = store.getState().cart;
        const serialized = JSON.stringify({
          items,
          coupon: coupon ? { code: coupon.code } : null,
        });
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          localStorage.setItem(CART_STORAGE_KEY, serialized);
        }
      } catch {}
    });

    // 3. Başka sekmede sepet değişirse bu sekmeyi de senkronize et
    const handleStorage = (e) => {
      if (e.key === CART_STORAGE_KEY) {
        loadSavedCart();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
