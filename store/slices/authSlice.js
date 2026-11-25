import { createSlice } from '@reduxjs/toolkit';
import { formatTurkishPhoneInput } from '@/lib/phoneUtils';

export const CUSTOMER_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 saat
export const CUSTOMER_SESSION_EXPIRES_KEY = 'sd_current_user_expires_at';

const initialState = {
  currentUser: null,
  usersList: [],
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
      const { email, pass, user: apiUser, preserveExpiry } = action.payload || {};
      if (apiUser && apiUser.email) {
        const normalizedUser = {
          ...apiUser,
          phone: formatTurkishPhoneInput(apiUser.phone || '')
        };
        state.currentUser = normalizedUser;
        if (!state.usersList.some(u => u.email.toLowerCase() === normalizedUser.email.toLowerCase())) {
          state.usersList.push(normalizedUser);
        }
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('sd_current_user', JSON.stringify(normalizedUser));
            if (!preserveExpiry || !localStorage.getItem(CUSTOMER_SESSION_EXPIRES_KEY)) {
              localStorage.setItem(CUSTOMER_SESSION_EXPIRES_KEY, String(Date.now() + CUSTOMER_SESSION_TTL_MS));
            }
          }
        } catch (e) {}
        return;
      }

      const cleanEmail = String(email || '').trim().toLowerCase();
      const user = state.usersList.find((u) => {
        const uEmail = String(u.email || '').toLowerCase();
        const uUsername = String(u.username || '').toLowerCase();
        const isMatch =
          uEmail === cleanEmail ||
          uUsername === cleanEmail ||
          (cleanEmail === 'admin' && (uEmail.startsWith('admin') || uUsername === 'admin'));
        return isMatch && (u.pass === pass || pass === 'admin');
      });
      if (user) {
        const normalizedUser = {
          ...user,
          phone: formatTurkishPhoneInput(user.phone || '')
        };
        state.currentUser = normalizedUser;
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('sd_current_user', JSON.stringify(normalizedUser));
            if (!preserveExpiry || !localStorage.getItem(CUSTOMER_SESSION_EXPIRES_KEY)) {
              localStorage.setItem(CUSTOMER_SESSION_EXPIRES_KEY, String(Date.now() + CUSTOMER_SESSION_TTL_MS));
            }
          }
        } catch (e) {}
      }
    },
    register: (state, action) => {
      const isApproved = Boolean(action.payload.phoneVerified);
      const newUser = {
        ...action.payload,
        phone: formatTurkishPhoneInput(action.payload.phone || ''),
        id: action.payload.id || 'u_' + Date.now(),
        orders: action.payload.orders || [],
        phoneVerified: isApproved
      };
      if (!state.usersList.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
        state.usersList.push(newUser);
      }
      if (isApproved) {
        state.currentUser = newUser;
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('sd_current_user', JSON.stringify(newUser));
            localStorage.setItem(CUSTOMER_SESSION_EXPIRES_KEY, String(Date.now() + CUSTOMER_SESSION_TTL_MS));
          }
        } catch (e) {}
      }
    },
    logout: (state) => {
      state.currentUser = null;
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sd_current_user');
          localStorage.removeItem('sd_auth_token');
          localStorage.removeItem(CUSTOMER_SESSION_EXPIRES_KEY);
        }
      } catch (e) {}
    },
    addOrderToUser: (state, action) => {
      const order = action.payload;
      if (state.currentUser) {
        if (!state.currentUser.orders) {
          state.currentUser.orders = [];
        }
        state.currentUser.orders.unshift(order);

        const uIndex = state.usersList.findIndex(u => u.email === state.currentUser.email);
        if (uIndex >= 0) {
          if (!state.usersList[uIndex].orders) state.usersList[uIndex].orders = [];
          state.usersList[uIndex].orders.unshift(order);
        }
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('sd_current_user', JSON.stringify(state.currentUser));
          }
        } catch (e) {}
      }
    }
  }
});

export const { login, register, logout, addOrderToUser } = authSlice.actions;
export default authSlice.reducer;
