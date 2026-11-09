import { createSlice } from '@reduxjs/toolkit';

export const VALID_COUPONS = {
  TORBALI10: { code: 'TORBALI10', type: 'percent', value: 10, label: '%10 Torbalı Özel İndirimi', minSubtotal: 0 },
  GECEIKRAMI: { code: 'GECEIKRAMI', type: 'fixed', value: 50, label: '₺50 Gece Acıkanlara İkram', minSubtotal: 300 },
  SANDVIC: { code: 'SANDVIC', type: 'percent', value: 15, label: '%15 Sandviç Sever İndirimi', minSubtotal: 200 }
};

const calculateTotals = (items, coupon = null) => {
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let discountAmount = 0;
  let activeCoupon = null;

  if (coupon && subtotal > 0) {
    const c = VALID_COUPONS[coupon.code?.toUpperCase()];
    if (c && subtotal >= c.minSubtotal) {
      if (c.type === 'percent') {
        discountAmount = (subtotal * c.value) / 100;
      } else if (c.type === 'fixed') {
        discountAmount = Math.min(subtotal, c.value);
      }
      activeCoupon = { ...c, discountAmount };
    }
  }

  const grandTotal = Math.max(0, subtotal - discountAmount);
  return { totalCount, subtotal, discountAmount, grandTotal, coupon: activeCoupon };
};

const initialState = {
  items: [],
  subtotal: 0,
  discountAmount: 0,
  grandTotal: 0,
  totalCount: 0,
  coupon: null,
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const { product, sauces, extras, note, drink } = action.payload;

      let descriptionDetails = [];
      if (drink) {
        descriptionDetails.push(`İçecek: ${drink}`);
      }
      const sauceEntries = Object.entries(sauces || {}).filter(([_, count]) => count > 0);
      if (sauceEntries.length > 0) {
        const sauceNames = {
          sarimsakli: 'Sarımsaklı Mayonez',
          acisos: 'Özel Acı Sos',
          barbeku: 'Barbekü Sos',
          hardal: 'Ballı Hardal',
          ketcap: 'Ketçap',
          mayonez: 'Mayonez',
          ...(action.payload.sauceLabels || {})
        };
        const formatted = sauceEntries.map(([k, count]) => `${sauceNames[k] || k} (${count} Adet)`);
        descriptionDetails.push(`Soslar: ${formatted.join(', ')}`);
      }

      let extraPrice = 0;
      if (extras && extras.length > 0) {
        descriptionDetails.push(`Ekstralar: ${extras.map(e => e.name).join(', ')}`);
        extraPrice = extras.reduce((sum, e) => sum + e.price, 0);
      }

      if (note && note.trim()) {
        descriptionDetails.push(`Not: "${note.trim()}"`);
      }

      const finalPrice = product.price + extraPrice;
      const cartKey = `${product.id}-${drink || ''}-${JSON.stringify(sauces || {})}-${(extras || []).map(e => e.name).sort().join()}-${note || ''}`;

      const existingIndex = state.items.findIndex(item => item.cartKey === cartKey);
      if (existingIndex >= 0) {
        state.items[existingIndex].quantity += 1;
      } else {
        state.items.push({
          cartKey,
          id: product.id,
          name: product.name,
          price: finalPrice,
          image: product.image,
          details: descriptionDetails.join(' | '),
          quantity: 1,
        });
      }

      const totals = calculateTotals(state.items, state.coupon);
      state.totalCount = totals.totalCount;
      state.subtotal = totals.subtotal;
      state.discountAmount = totals.discountAmount;
      state.grandTotal = totals.grandTotal;
      state.coupon = totals.coupon;
    },

    changeQuantity: (state, action) => {
      const { cartKey, delta } = action.payload;
      const index = state.items.findIndex(item => item.cartKey === cartKey);
      if (index >= 0) {
        state.items[index].quantity += delta;
        if (state.items[index].quantity <= 0) {
          state.items.splice(index, 1);
        }
      }
      const totals = calculateTotals(state.items, state.coupon);
      state.totalCount = totals.totalCount;
      state.subtotal = totals.subtotal;
      state.discountAmount = totals.discountAmount;
      state.grandTotal = totals.grandTotal;
      state.coupon = totals.coupon;
    },

    removeItem: (state, action) => {
      const { cartKey } = action.payload;
      state.items = state.items.filter(item => item.cartKey !== cartKey);
      const totals = calculateTotals(state.items, state.coupon);
      state.totalCount = totals.totalCount;
      state.subtotal = totals.subtotal;
      state.discountAmount = totals.discountAmount;
      state.grandTotal = totals.grandTotal;
      state.coupon = totals.coupon;
    },

    applyCoupon: (state, action) => {
      const code = String(action.payload || '').trim().toUpperCase();
      const valid = VALID_COUPONS[code];
      if (valid) {
        const totals = calculateTotals(state.items, valid);
        state.discountAmount = totals.discountAmount;
        state.grandTotal = totals.grandTotal;
        state.coupon = totals.coupon;
      }
    },

    removeCoupon: (state) => {
      state.coupon = null;
      state.discountAmount = 0;
      state.grandTotal = state.subtotal;
    },

    clearCart: (state) => {
      state.items = [];
      state.subtotal = 0;
      state.discountAmount = 0;
      state.grandTotal = 0;
      state.totalCount = 0;
      state.coupon = null;
    }
  }
});

export const { addToCart, changeQuantity, removeItem, clearCart, applyCoupon, removeCoupon } = cartSlice.actions;
export default cartSlice.reducer;
