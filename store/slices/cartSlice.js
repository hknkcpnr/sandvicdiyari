import { createSlice } from '@reduxjs/toolkit';
import { resolveSauceImage, resolveExtraImage } from '@/lib/productOptionsDefaults';

export const CART_STORAGE_KEY = 'sandwich_diyari_cart_v1';

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
      const { product, sauces, extras, note, drink, drinkPrice = 0, removedIngredients } = action.payload;

      let descriptionDetails = [];
      if (Array.isArray(removedIngredients) && removedIngredients.length > 0) {
        descriptionDetails.push(`Çıkarılanlar: ${removedIngredients.join(', ')}`);
      }
      const drinkExtraPrice = Math.max(0, Number(drinkPrice) || 0);
      const formattedDrinkPrice = Number.isInteger(drinkExtraPrice)
        ? drinkExtraPrice.toFixed(0)
        : drinkExtraPrice.toFixed(2);
      if (drink) {
        descriptionDetails.push(
          drinkExtraPrice > 0 ? `İçecek: ${drink} (+₺${formattedDrinkPrice})` : `İçecek: ${drink}`
        );
      }
      const sauceEntries = Object.entries(sauces || {}).filter(([_, count]) => count > 0);
      const totalSauceCount = sauceEntries.reduce((sum, [_, count]) => sum + (Number(count) || 0), 0);
      const freeLimit = typeof action.payload.freeSauceLimit === 'number' ? action.payload.freeSauceLimit : 2;
      const extraPricePerSauce = typeof action.payload.extraSaucePrice === 'number' ? action.payload.extraSaucePrice : 5;
      const chargeableSauceCount = Math.max(0, totalSauceCount - freeLimit);
      const extraSauceFee = chargeableSauceCount * extraPricePerSauce;

      let selectedSaucesList = [];
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
        const sauceImages = action.payload.sauceImages || {};
        selectedSaucesList = sauceEntries.map(([k, count]) => {
          const sauceName = sauceNames[k] || k;
          return {
            id: k,
            name: sauceName,
            count: Number(count) || 1,
            image: resolveSauceImage({
              id: k,
              name: sauceName,
              image: sauceImages[k] || '',
            }),
          };
        });
        const formatted = sauceEntries.map(([k, count]) => `${sauceNames[k] || k} (${count}x)`);
        let sauceText = `Soslar: ${formatted.join(', ')}`;
        if (chargeableSauceCount > 0) {
          sauceText += ` (+${chargeableSauceCount}x Ekstra Sos: +₺${extraSauceFee.toFixed(2)})`;
        }
        descriptionDetails.push(sauceText);
      }

      let extraPrice = 0;
      let selectedExtrasList = [];
      if (extras && extras.length > 0) {
        descriptionDetails.push(`Ekstralar: ${extras.map(e => e.name).join(', ')}`);
        extraPrice = extras.reduce((sum, e) => sum + e.price, 0);
        selectedExtrasList = extras.map((e) => ({
          id: e.id || e.name,
          name: e.name,
          price: Number(e.price) || 0,
          image: resolveExtraImage(e) || '',
        }));
      }

      if (note && note.trim()) {
        descriptionDetails.push(`Not: "${note.trim()}"`);
      }

      const removedKey = Array.isArray(removedIngredients) ? [...removedIngredients].sort().join(',') : '';
      const finalPrice = product.price + extraPrice + extraSauceFee + drinkExtraPrice;
      const cartKey = `${product.id}-${drink || ''}-${drinkExtraPrice}-${JSON.stringify(sauces || {})}-${(extras || []).map(e => e.name).sort().join()}-${removedKey}-${note || ''}`;

      const qtyToAdd = Math.max(1, Math.min(99, Number(action.payload.quantity) || 1));
      const existingIndex = state.items.findIndex(item => item.cartKey === cartKey);
      if (existingIndex >= 0) {
        state.items[existingIndex].quantity += qtyToAdd;
        if (!Array.isArray(state.items[existingIndex].selectedSauces) && selectedSaucesList.length > 0) {
          state.items[existingIndex].selectedSauces = selectedSaucesList;
        }
        if (!Array.isArray(state.items[existingIndex].selectedExtras) && selectedExtrasList.length > 0) {
          state.items[existingIndex].selectedExtras = selectedExtrasList;
        }
      } else {
        state.items.push({
          cartKey,
          id: product.id,
          name: product.name,
          price: finalPrice,
          image: product.image,
          details: descriptionDetails.join(' | '),
          selectedSauces: selectedSaucesList,
          selectedExtras: selectedExtrasList,
          removedIngredients: Array.isArray(removedIngredients) ? removedIngredients : [],
          quantity: qtyToAdd,
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
    },

    hydrateCart: (state, action) => {
      const payload = action.payload || {};
      const safeItems = Array.isArray(payload.items)
        ? payload.items.filter((it) => it && typeof it === 'object' && it.name && Number(it.quantity) > 0)
        : [];
      const couponObj = payload.coupon?.code ? VALID_COUPONS[String(payload.coupon.code).toUpperCase()] || null : null;
      state.items = safeItems;
      const totals = calculateTotals(state.items, couponObj);
      state.totalCount = totals.totalCount;
      state.subtotal = totals.subtotal;
      state.discountAmount = totals.discountAmount;
      state.grandTotal = totals.grandTotal;
      state.coupon = totals.coupon;
    }
  }
});

export const { addToCart, changeQuantity, removeItem, clearCart, applyCoupon, removeCoupon, hydrateCart } = cartSlice.actions;
export default cartSlice.reducer;
