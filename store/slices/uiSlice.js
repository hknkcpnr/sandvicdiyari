import { createSlice } from '@reduxjs/toolkit';
import { initialReviews } from '@/data/initialData';

const initialState = {
  activePage: 'home',
  isMobileMenuOpen: false,
  isCartOpen: false,
  isOptionsModalOpen: false,
  selectedProductForOptions: null,
  sauceCounts: {},
  isAuthModalOpen: false,
  authModalTab: 'login',
  authModalNotice: '',
  isProfileModalOpen: false,
  isCheckoutModalOpen: false,
  isMessageModalOpen: false,
  messageModalData: {
    title: 'İşlem Başarılı',
    text: '',
    type: 'success',
  },
  reviews: (initialReviews || []).filter((r) => r.isApproved === true),
  activeAdminTab: 'orders',
  favorites: [],
  onlyFavoritesFilter: false
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActivePage: (state, action) => {
      state.activePage = action.payload;
      state.isMobileMenuOpen = false;
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    toggleMobileMenu: (state) => {
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
    },
    setCartOpen: (state, action) => {
      state.isCartOpen = action.payload;
    },
    toggleCart: (state) => {
      state.isCartOpen = !state.isCartOpen;
    },
    openOptionsModal: (state, action) => {
      state.selectedProductForOptions = action.payload;
      state.sauceCounts = {};
      state.isOptionsModalOpen = true;
    },
    closeOptionsModal: (state) => {
      state.isOptionsModalOpen = false;
      state.selectedProductForOptions = null;
    },
    adjustSauceCount: (state, action) => {
      const { sauceKey, delta } = action.payload;
      const current = state.sauceCounts[sauceKey] || 0;
      state.sauceCounts[sauceKey] = Math.max(0, current + delta);
    },
    openAuthModal: (state, action) => {
      if (typeof action.payload === 'object' && action.payload !== null) {
        state.authModalTab = action.payload.tab || 'login';
        state.authModalNotice = action.payload.notice || '';
      } else {
        state.authModalTab = action.payload || 'login';
        state.authModalNotice = '';
      }
      state.isAuthModalOpen = true;
      state.isMobileMenuOpen = false;
    },
    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
      state.authModalNotice = '';
    },
    setAuthModalTab: (state, action) => {
      state.authModalTab = action.payload;
    },
    openProfileModal: (state) => {
      state.isProfileModalOpen = true;
      state.isMobileMenuOpen = false;
    },
    closeProfileModal: (state) => {
      state.isProfileModalOpen = false;
    },
    openCheckoutModal: (state) => {
      state.isCartOpen = false;
      state.isCheckoutModalOpen = true;
    },
    closeCheckoutModal: (state) => {
      state.isCheckoutModalOpen = false;
    },
    showMessageModal: (state, action) => {
      state.messageModalData = {
        title: action.payload.title || 'Bilgi',
        text: action.payload.text || '',
        type: action.payload.type || 'success',
      };
      state.isMessageModalOpen = true;
    },
    closeMessageModal: (state) => {
      state.isMessageModalOpen = false;
    },
    setReviews: (state, action) => {
      state.reviews = Array.isArray(action.payload) ? action.payload : [];
    },
    updateReviewStatus: (state, action) => {
      const { id, isApproved } = action.payload;
      const rev = state.reviews.find((r) => String(r.id) === String(id));
      if (rev) {
        rev.isApproved = isApproved;
      }
    },
    removeReview: (state, action) => {
      state.reviews = state.reviews.filter((r) => String(r.id) !== String(action.payload));
    },
    addReview: (state, action) => {
      state.reviews.unshift(action.payload);
    },
    setActiveAdminTab: (state, action) => {
      state.activeAdminTab = action.payload;
    },
    setFavorites: (state, action) => {
      state.favorites = Array.isArray(action.payload) ? action.payload : [];
    },
    setOnlyFavoritesFilter: (state, action) => {
      state.onlyFavoritesFilter = Boolean(action.payload);
    },
    toggleFavorite: (state, action) => {
      const payload = action.payload;
      const id = typeof payload === 'object' && payload !== null ? payload.id : null;
      const email =
        typeof payload === 'object' && payload !== null && payload.email
          ? String(payload.email).trim().toLowerCase()
          : '';

      // Güvenlik kilidi: Sadece giriş yapmış üyeler favori ekleyebilir
      if (!email || id === undefined || id === null) {
        return;
      }

      if (state.favorites.includes(id)) {
        state.favorites = state.favorites.filter((f) => f !== id);
      } else {
        state.favorites.push(id);
      }
      try {
        localStorage.setItem(`sd_favorites_${email}`, JSON.stringify(state.favorites));
      } catch (e) {}
    }
  }
});

export const {
  setActivePage,
  toggleMobileMenu,
  setCartOpen,
  toggleCart,
  openOptionsModal,
  closeOptionsModal,
  adjustSauceCount,
  openAuthModal,
  closeAuthModal,
  setAuthModalTab,
  openProfileModal,
  closeProfileModal,
  openCheckoutModal,
  closeCheckoutModal,
  showMessageModal,
  closeMessageModal,
  setReviews,
  updateReviewStatus,
  removeReview,
  addReview,
  setActiveAdminTab,
  setFavorites,
  setOnlyFavoritesFilter,
  toggleFavorite
} = uiSlice.actions;

export default uiSlice.reducer;
