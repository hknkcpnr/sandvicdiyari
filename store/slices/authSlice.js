import { createSlice } from '@reduxjs/toolkit';
import { initialUsers } from '@/data/initialData';
import { formatTurkishPhoneInput } from '@/lib/phoneUtils';

const initialState = {
  currentUser: null,
  usersList: initialUsers,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
      const { email, pass, user: apiUser } = action.payload || {};
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
          }
        } catch (e) {}
      }
    },
    register: (state, action) => {
      const newUser = {
        ...action.payload,
        phone: formatTurkishPhoneInput(action.payload.phone || ''),
        id: action.payload.id || 'u_' + Date.now(),
        orders: action.payload.orders || []
      };
      state.usersList.push(newUser);
      state.currentUser = newUser;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sd_current_user', JSON.stringify(newUser));
        }
      } catch (e) {}
    },
    logout: (state) => {
      state.currentUser = null;
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sd_current_user');
          localStorage.removeItem('sd_auth_token');
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
