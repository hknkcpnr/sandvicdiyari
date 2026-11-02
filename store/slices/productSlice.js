import { createSlice } from '@reduxjs/toolkit';
import { initialProducts } from '@/data/initialData';

const initialState = {
  items: initialProducts,
  category: 'all',
  searchQuery: '',
};

export const productSlice = createSlice({
  name: 'product',
  initialState,
  reducers: {
    setCategory: (state, action) => {
      state.category = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setProducts: (state, action) => {
      state.items = action.payload;
    },
    addProduct: (state, action) => {
      const existingId = action.payload.id;
      const newId = existingId || (state.items.length > 0 ? Math.max(...state.items.map(p => Number(p.id) || 0)) + 1 : 1);
      const newProduct = { ...action.payload, id: newId };
      const idx = state.items.findIndex(p => String(p.id) === String(newId));
      if (idx >= 0) {
        state.items[idx] = newProduct;
      } else {
        state.items.unshift(newProduct);
      }
    },
    updateProduct: (state, action) => {
      const index = state.items.findIndex(p => String(p.id) === String(action.payload.id));
      if (index >= 0) {
        state.items[index] = { ...state.items[index], ...action.payload };
      }
    },
    deleteProduct: (state, action) => {
      state.items = state.items.filter(p => String(p.id) !== String(action.payload));
    }
  }
});

export const { setCategory, setSearchQuery, setProducts, addProduct, updateProduct, deleteProduct } = productSlice.actions;
export default productSlice.reducer;
