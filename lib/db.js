import fs from 'fs';
import path from 'path';
import { initialProducts, initialUsers, initialReviews, initialIngredients } from '@/data/initialData';
import { hashPassword, verifyPassword } from '@/lib/security/auth';
import { DEFAULT_SITE_CONTENT } from './siteContentDefaults';

export { DEFAULT_SITE_CONTENT };

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Valid status transitions map
export const VALID_STATUS_TRANSITIONS = {
  'Yeni': ['Görüntülendi', 'Onaylandı', 'İptal Edildi'],
  'Görüntülendi': ['Onaylandı', 'İptal Edildi'],
  'Onaylandı': ['Hazırlanıyor', 'İptal Edildi'],
  'Hazırlanıyor': ['Hazır', 'İptal Edildi'],
  'Hazır': ['Kurye Teslim Aldı', 'Yolda', 'İptal Edildi'],
  'Kurye Teslim Aldı': ['Yolda', 'Teslim Edildi', 'İptal Edildi'],
  'Yolda': ['Teslim Edildi', 'İptal Edildi'],
  'Teslim Edildi': [], // Terminal state
  'İptal Edildi': []   // Terminal state
};

// Migrate legacy orders to ensure backwards compatibility
function migrateOrder(order) {
  if (!order) return null;
  const migrated = { ...order };

  // Normalize legacy status names
  if (migrated.status === 'Sipariş Alındı') {
    migrated.status = 'Yeni';
  } else if (migrated.status === 'Kuryede') {
    migrated.status = 'Yolda';
  } else if (migrated.status === 'İptal') {
    migrated.status = 'İptal Edildi';
  }

  // Ensure isViewed
  if (typeof migrated.isViewed === 'undefined') {
    migrated.isViewed = migrated.status !== 'Yeni';
  }
  if (!migrated.viewedAt && migrated.isViewed) {
    migrated.viewedAt = migrated.createdAt || new Date().toISOString();
  }

  // Ensure paymentStatus
  if (!migrated.paymentStatus) {
    migrated.paymentStatus = migrated.status === 'Teslim Edildi' ? 'Ödendi' : 'Bekleniyor';
  }

  // Ensure statusHistory
  if (!migrated.statusHistory || !Array.isArray(migrated.statusHistory) || migrated.statusHistory.length === 0) {
    migrated.statusHistory = [
      {
        status: 'Yeni',
        timestamp: migrated.createdAt || new Date().toISOString(),
        user: 'Sistem',
        note: 'Sipariş sisteme ulaştı.'
      }
    ];
    if (migrated.status !== 'Yeni') {
      migrated.statusHistory.push({
        status: migrated.status,
        timestamp: migrated.updatedAt || migrated.createdAt || new Date().toISOString(),
        user: 'Yönetici',
        note: `Durum güncellendi: ${migrated.status}`
      });
    }
  }

  return migrated;
}

// High-Speed Write-Through RAM Cache for Concurrent Requests
let memoryDbCache = null;
let memoryDbMtimeMs = 0;

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = {
        products: initialProducts,
        users: initialUsers,
        orders: [
          {
            id: 'SD-9281',
            orderNumber: 'SD-9281',
            customerName: 'Demo Kullanıcı',
            phone: '0850 123 45 67',
            address: 'Moda Cad. No: 12 Kadıköy/İstanbul',
            paymentMethod: 'Kapıda Nakit',
            paymentStatus: 'Ödendi',
            items: [
              {
                id: 1,
                name: 'Kanka Menü',
                quantity: 1,
                price: 249.99,
                details: 'Soslar: Sarımsaklı Mayonez (1 Adet)'
              }
            ],
            subtotal: 249.99,
            total: 249.99,
            status: 'Teslim Edildi',
            isViewed: true,
            viewedAt: '2026-10-24T14:30:00Z',
            viewedBy: 'Restoran Yöneticisi',
            date: '24.10.2026',
            createdAt: '2026-10-24T14:28:00Z',
            updatedAt: '2026-10-24T15:00:00Z',
            statusHistory: [
              { status: 'Yeni', timestamp: '2026-10-24T14:28:00Z', user: 'Müşteri', note: 'Sipariş oluşturuldu.' },
              { status: 'Görüntülendi', timestamp: '2026-10-24T14:30:00Z', user: 'Restoran Yöneticisi', note: 'Sipariş detayları açıldı.' },
              { status: 'Onaylandı', timestamp: '2026-10-24T14:31:00Z', user: 'Restoran Yöneticisi', note: 'Sipariş onaylandı.' },
              { status: 'Hazırlanıyor', timestamp: '2026-10-24T14:32:00Z', user: 'Mutfak', note: 'Hazırlığa başlandı.' },
              { status: 'Hazır', timestamp: '2026-10-24T14:45:00Z', user: 'Mutfak', note: 'Paketlendi ve kurye bekliyor.' },
              { status: 'Kurye Teslim Aldı', timestamp: '2026-10-24T14:48:00Z', user: 'Kurye', note: 'Sipariş teslim alındı.' },
              { status: 'Yolda', timestamp: '2026-10-24T14:50:00Z', user: 'Kurye', note: 'Adrese doğru yola çıkıldı.' },
              { status: 'Teslim Edildi', timestamp: '2026-10-24T15:00:00Z', user: 'Kurye', note: 'Kapıda nakit ödeme alınarak teslim edildi.' }
            ]
          }
        ],
        reviews: initialReviews,
        feedback: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf8');
      memoryDbCache = initialDb;
      memoryDbMtimeMs = Date.now();
      return initialDb;
    }

    const stat = fs.statSync(DB_FILE);
    if (memoryDbCache && stat.mtimeMs === memoryDbMtimeMs) {
      return memoryDbCache;
    }

    const content = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed.orders && Array.isArray(parsed.orders)) {
      parsed.orders = parsed.orders.map(migrateOrder);
    }
    if (!Array.isArray(parsed.phoneOtps)) {
      parsed.phoneOtps = [];
    }
    memoryDbCache = parsed;
    memoryDbMtimeMs = stat.mtimeMs;
    return parsed;
  } catch (err) {
    console.error('Error reading DB:', err);
    if (memoryDbCache) return memoryDbCache;
    return {
      products: initialProducts,
      users: initialUsers,
      orders: [],
      reviews: initialReviews,
      feedback: []
    };
  }
}

function writeDb(data) {
  try {
    memoryDbCache = data;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    const stat = fs.statSync(DB_FILE);
    memoryDbMtimeMs = stat.mtimeMs;
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Normalize product with direct simple stock and availability
export function normalizeProduct(p) {
  if (!p) return null;
  const stock = typeof p.stock === 'number' ? Math.max(0, p.stock) : (p.stock === null ? null : 25);
  const trackStock = typeof p.trackStock === 'boolean' ? p.trackStock : true;
  const criticalThreshold = typeof p.criticalThreshold === 'number' ? Math.max(0, p.criticalThreshold) : 5;

  let isAvailable = true;
  if (p.isAvailable === false) {
    isAvailable = false;
  } else if (trackStock && stock === 0) {
    isAvailable = false;
  }

  let status = 'in_stock';
  if (!isAvailable || (trackStock && stock === 0)) {
    status = 'out_of_stock';
  } else if (trackStock && stock !== null && stock <= criticalThreshold) {
    status = 'low_stock';
  }

  const description = p.description || p.desc || '';

  return {
    ...p,
    description,
    desc: p.desc || description,
    stock,
    isAvailable,
    trackStock,
    criticalThreshold,
    status,
    maxPortions: stock !== null ? stock : 999
  };
}

// Backward compatibility export
export function evaluateProductAvailability(product) {
  const norm = normalizeProduct(product);
  return {
    isAvailable: norm.isAvailable,
    maxPortions: norm.maxPortions,
    missingIngredients: norm.isAvailable ? [] : [{ name: norm.name, stock: norm.stock, required: 1 }]
  };
}

export const db = {
  // Products
  getProducts: () => {
    const data = readDb();
    return data.products.map(normalizeProduct);
  },
  getProductById: (id) => {
    const data = readDb();
    const p = data.products.find(prod => String(prod.id) === String(id));
    return normalizeProduct(p);
  },
  addProduct: (product) => {
    const data = readDb();
    const newId = data.products.length > 0 ? Math.max(...data.products.map(p => Number(p.id) || 0)) + 1 : 1;
    const newProduct = {
      ...product,
      id: newId,
      stock: typeof product.stock === 'number' ? product.stock : (product.stock === null ? null : 25),
      isAvailable: typeof product.isAvailable === 'boolean' ? product.isAvailable : true,
      trackStock: typeof product.trackStock === 'boolean' ? product.trackStock : true,
      criticalThreshold: typeof product.criticalThreshold === 'number' ? product.criticalThreshold : 5,
      recipe: product.recipe || []
    };
    data.products.unshift(newProduct);
    writeDb(data);
    return normalizeProduct(newProduct);
  },
  updateProduct: (id, updates) => {
    const data = readDb();
    const idx = data.products.findIndex(p => String(p.id) === String(id));
    if (idx >= 0) {
      data.products[idx] = { ...data.products[idx], ...updates };
      writeDb(data);
      return normalizeProduct(data.products[idx]);
    }
    return null;
  },
  updateProductStock: (id, updates = {}) => {
    const data = readDb();
    const idx = data.products.findIndex(p => String(p.id) === String(id));
    if (idx >= 0) {
      const prod = data.products[idx];
      if (typeof updates.isAvailable === 'boolean') {
        prod.isAvailable = updates.isAvailable;
        if (prod.isAvailable && typeof prod.stock === 'number' && prod.stock <= 0) {
          prod.stock = 15;
        }
      }
      if (typeof updates.trackStock === 'boolean') {
        prod.trackStock = updates.trackStock;
      }
      if (typeof updates.criticalThreshold !== 'undefined') {
        prod.criticalThreshold = Math.max(0, Number(updates.criticalThreshold) || 5);
      }
      if (typeof updates.stock !== 'undefined') {
        if (updates.stock === null) {
          prod.stock = null;
        } else {
          prod.stock = Math.max(0, Number(updates.stock) || 0);
          if (prod.stock === 0) {
            prod.isAvailable = false;
          } else if (prod.stock > 0 && prod.isAvailable === false && typeof updates.isAvailable === 'undefined') {
            prod.isAvailable = true;
          }
        }
      } else if (typeof updates.delta !== 'undefined') {
        const cur = typeof prod.stock === 'number' ? prod.stock : 25;
        prod.stock = Math.max(0, cur + Number(updates.delta));
        if (prod.stock === 0) {
          prod.isAvailable = false;
        } else if (prod.stock > 0 && prod.isAvailable === false && typeof updates.isAvailable === 'undefined') {
          prod.isAvailable = true;
        }
      }
      writeDb(data);
      return normalizeProduct(prod);
    }
    return null;
  },
  bulkUpdateProductStocks: (action, amount = 20) => {
    const data = readDb();
    data.products = data.products.map(p => {
      const prod = { ...p };
      if (action === 'set_all_available') {
        prod.isAvailable = true;
        if (typeof prod.stock === 'number' && prod.stock <= 0) {
          prod.stock = 20;
        }
      } else if (action === 'refill_all') {
        const cur = typeof prod.stock === 'number' ? prod.stock : 20;
        prod.stock = cur + Number(amount || 20);
        prod.isAvailable = true;
      } else if (action === 'reset_all') {
        prod.stock = 25;
        prod.isAvailable = true;
      }
      return prod;
    });
    writeDb(data);
    return data.products.map(normalizeProduct);
  },
  deleteProduct: (id) => {
    const data = readDb();
    const prevLen = data.products.length;
    data.products = data.products.filter(p => String(p.id) !== String(id));
    writeDb(data);
    return data.products.length < prevLen;
  },

  // Ingredients & Inventory Management
  getIngredients: () => {
    const data = readDb();
    if (!data.ingredients || !Array.isArray(data.ingredients)) {
      data.ingredients = initialIngredients;
      writeDb(data);
    }
    return data.ingredients;
  },

  updateIngredientStock: (id, newStock) => {
    const data = readDb();
    if (!data.ingredients) data.ingredients = initialIngredients;
    const idx = data.ingredients.findIndex(i => String(i.id) === String(id));
    if (idx >= 0) {
      data.ingredients[idx].stock = Math.max(0, Number(newStock) || 0);
      writeDb(data);
      return data.ingredients[idx];
    }
    return null;
  },

  adjustIngredientStock: (id, delta) => {
    const data = readDb();
    if (!data.ingredients) data.ingredients = initialIngredients;
    const idx = data.ingredients.findIndex(i => String(i.id) === String(id));
    if (idx >= 0) {
      const current = Number(data.ingredients[idx].stock) || 0;
      data.ingredients[idx].stock = Math.max(0, current + Number(delta));
      writeDb(data);
      return data.ingredients[idx];
    }
    return null;
  },

  updateIngredient: (id, updates) => {
    const data = readDb();
    if (!data.ingredients) data.ingredients = initialIngredients;
    const idx = data.ingredients.findIndex(i => String(i.id) === String(id));
    if (idx >= 0) {
      data.ingredients[idx] = { ...data.ingredients[idx], ...updates };
      writeDb(data);
      return data.ingredients[idx];
    }
    return null;
  },

  addIngredient: (ingredient) => {
    const data = readDb();
    if (!data.ingredients) data.ingredients = initialIngredients;
    const id = ingredient.id || `ing-${Date.now()}`;
    const newIng = {
      id,
      name: ingredient.name,
      category: ingredient.category || 'Genel',
      unit: ingredient.unit || 'Adet',
      stock: Math.max(0, Number(ingredient.stock) || 0),
      criticalThreshold: Math.max(0, Number(ingredient.criticalThreshold) || 5),
      icon: ingredient.icon || '📦',
      description: ingredient.description || ''
    };
    data.ingredients.push(newIng);
    writeDb(data);
    return newIng;
  },

  deleteIngredient: (id) => {
    const data = readDb();
    if (!data.ingredients) return false;
    const prev = data.ingredients.length;
    data.ingredients = data.ingredients.filter(i => String(i.id) !== String(id));
    writeDb(data);
    return data.ingredients.length < prev;
  },

  // Stock deduction for orders
  depleteIngredientsForOrder: (orderItems) => {
    if (!Array.isArray(orderItems)) return;
    const data = readDb();
    if (!data.ingredients) data.ingredients = initialIngredients;

    for (const item of orderItems) {
      const orderQty = Number(item.quantity) || 1;
      const product = data.products.find(p => String(p.id) === String(item.id) || p.name === item.name);
      if (product && Array.isArray(product.recipe)) {
        for (const recipeItem of product.recipe) {
          const ingIdx = data.ingredients.findIndex(i => String(i.id) === String(recipeItem.ingredientId));
          if (ingIdx >= 0) {
            const needed = (Number(recipeItem.quantity) || 1) * orderQty;
            data.ingredients[ingIdx].stock = Math.max(0, (Number(data.ingredients[ingIdx].stock) || 0) - needed);
          }
        }
      }
    }
    writeDb(data);
  },

  // Stock restoration for cancelled orders
  restoreIngredientsForOrder: (orderItems) => {
    if (!Array.isArray(orderItems)) return;
    const data = readDb();
    if (!data.ingredients) return;

    for (const item of orderItems) {
      const orderQty = Number(item.quantity) || 1;
      const product = data.products.find(p => String(p.id) === String(item.id) || p.name === item.name);
      if (product && Array.isArray(product.recipe)) {
        for (const recipeItem of product.recipe) {
          const ingIdx = data.ingredients.findIndex(i => String(i.id) === String(recipeItem.ingredientId));
          if (ingIdx >= 0) {
            const toReturn = (Number(recipeItem.quantity) || 1) * orderQty;
            data.ingredients[ingIdx].stock = (Number(data.ingredients[ingIdx].stock) || 0) + toReturn;
          }
        }
      }
    }
    writeDb(data);
  },

  // Update recipe for a product
  updateProductRecipe: (productId, recipe) => {
    const data = readDb();
    const idx = data.products.findIndex(p => String(p.id) === String(productId));
    if (idx >= 0) {
      data.products[idx].recipe = recipe;
      writeDb(data);
      return data.products[idx];
    }
    return null;
  },

  // Orders
  getOrders: () => readDb().orders,
  getOrderById: (id) => {
    const orders = readDb().orders;
    return orders.find(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));
  },
  createOrder: (orderData) => {
    const data = readDb();
    if (!data.ingredients) data.ingredients = initialIngredients;

    // Check product availability and stock
    if (Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const orderQty = Number(item.quantity) || 1;
        const product = data.products.find(p => String(p.id) === String(item.id) || p.name === item.name);
        if (product) {
          const isAvail = product.isAvailable !== false;
          if (!isAvail) {
            throw new Error(`"${product.name}" şu anda tükendiği için sipariş verilemez.`);
          }
          const track = product.trackStock !== false;
          const currentStock = typeof product.stock === 'number' ? product.stock : 25;
          if (track && currentStock < orderQty) {
            throw new Error(`"${product.name}" için yeterli stok bulunmuyor (Mevcut: ${currentStock}, İstenen: ${orderQty}).`);
          }
        }
      }

      // Automatically deplete product stock
      for (const item of orderData.items) {
        const orderQty = Number(item.quantity) || 1;
        const pIdx = data.products.findIndex(p => String(p.id) === String(item.id) || p.name === item.name);
        if (pIdx >= 0) {
          const product = data.products[pIdx];
          if (product.trackStock !== false) {
            const currentStock = typeof product.stock === 'number' ? product.stock : 25;
            product.stock = Math.max(0, currentStock - orderQty);
            if (product.stock === 0) {
              product.isAvailable = false;
            }
          }
        }
      }
    }

    const orderNumber = 'SD-' + Math.floor(1000 + Math.random() * 9000);
    const nowIso = new Date().toISOString();

    const newOrder = {
      id: orderNumber,
      orderNumber,
      ...orderData,
      status: 'Yeni',
      isViewed: false,
      viewedAt: null,
      viewedBy: null,
      paymentStatus: 'Bekleniyor',
      date: new Date().toLocaleDateString('tr-TR'),
      createdAt: nowIso,
      updatedAt: nowIso,
      statusHistory: [
        {
          status: 'Yeni',
          timestamp: nowIso,
          user: orderData.customerName || 'Müşteri',
          note: 'Sipariş web üzerinden oluşturuldu.'
        }
      ]
    };

    data.orders.unshift(newOrder);

    // If user exists, also update user's orders history
    if (orderData.userEmail) {
      const uIdx = data.users.findIndex(u => u.email === orderData.userEmail);
      if (uIdx >= 0) {
        if (!data.users[uIdx].orders) data.users[uIdx].orders = [];
        data.users[uIdx].orders.unshift({
          id: orderNumber,
          date: newOrder.date,
          total: newOrder.total,
          items: (orderData.items || []).map(i => `${i.name} (${i.quantity} Adet)`).join(', ') + ` [${orderData.paymentMethod}]`,
          status: 'Yeni'
        });
      }
    }

    writeDb(data);
    return newOrder;
  },

  // View order (Logs viewed, but DOES NOT confirm the order!)
  viewOrder: (id, userName = 'Restoran Yetkilisi') => {
    const data = readDb();
    const idx = data.orders.findIndex(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));
    if (idx >= 0) {
      const order = data.orders[idx];
      const nowIso = new Date().toISOString();

      if (!order.isViewed) {
        order.isViewed = true;
        order.viewedAt = nowIso;
        order.viewedBy = userName;
        order.updatedAt = nowIso;

        if (order.status === 'Yeni') {
          order.status = 'Görüntülendi';
          order.statusHistory.push({
            status: 'Görüntülendi',
            timestamp: nowIso,
            user: userName,
            note: 'Yetkili çalışan sipariş detaylarını açtı.'
          });
        }
        writeDb(data);
      }
      return order;
    }
    return null;
  },

  // Update order status with State Machine validation and audit trail
  updateOrderStatus: (id, newStatus, user = 'Restoran Yetkilisi', note = '', reason = '') => {
    const data = readDb();
    const idx = data.orders.findIndex(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));
    if (idx >= 0) {
      const order = data.orders[idx];
      const currentStatus = order.status;

      // Cannot update already completed or cancelled orders
      if (currentStatus === 'Teslim Edildi' || currentStatus === 'İptal Edildi') {
        throw new Error(`Sipariş "${currentStatus}" durumundadır. Tekrar değiştirilemez.`);
      }

      // Check transition validity
      const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(newStatus)) {
        throw new Error(`Geçersiz durum geçişi: "${currentStatus}" aşamasından doğrudan "${newStatus}" yapılamaz.`);
      }

      const nowIso = new Date().toISOString();
      order.status = newStatus;
      order.updatedAt = nowIso;

      if (newStatus === 'Teslim Edildi') {
        order.paymentStatus = 'Ödendi';
      } else if (newStatus === 'İptal Edildi') {
        order.cancellationReason = reason || note || 'Belirtilmedi';
        if (order.paymentStatus === 'Ödendi') {
          order.paymentStatus = 'İade Edildi';
        }
        // Restore product stock
        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            const orderQty = Number(item.quantity) || 1;
            const pIdx = data.products.findIndex(p => String(p.id) === String(item.id) || p.name === item.name);
            if (pIdx >= 0) {
              const product = data.products[pIdx];
              if (product.trackStock !== false) {
                const currentStock = typeof product.stock === 'number' ? product.stock : 0;
                product.stock = currentStock + orderQty;
                if (product.stock > 0) {
                  product.isAvailable = true;
                }
              }
            }
          }
        }
      }

      order.statusHistory.push({
        status: newStatus,
        timestamp: nowIso,
        user: user,
        note: note || (newStatus === 'İptal Edildi' ? `İptal gerekçesi: ${order.cancellationReason}` : `Durum "${newStatus}" olarak güncellendi.`)
      });

      writeDb(data);
      return order;
    }
    return null;
  },

  // Update payment status explicitly
  updatePaymentStatus: (id, paymentStatus, user = 'Yönetici') => {
    const data = readDb();
    const idx = data.orders.findIndex(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));
    if (idx >= 0) {
      const order = data.orders[idx];
      order.paymentStatus = paymentStatus;
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date().toISOString(),
        user: user,
        note: `Ödeme durumu "${paymentStatus}" olarak güncellendi.`
      });
      writeDb(data);
      return order;
    }
    return null;
  },

  // Assign courier or update delivery details
  updateCourier: (id, courierName, user = 'Yönetici') => {
    const data = readDb();
    const idx = data.orders.findIndex(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));
    if (idx >= 0) {
      const order = data.orders[idx];
      order.courierName = courierName;
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date().toISOString(),
        user: user,
        note: courierName ? `Kurye atandı: ${courierName}` : 'Kurye ataması kaldırıldı.'
      });
      writeDb(data);
      return order;
    }
    return null;
  },

  // Courier Complete Delivery (Handles status + payment in one atomic call)
  completeDeliveryByCourier: (id, courierName, paymentCollectedMethod = null) => {
    const data = readDb();
    const idx = data.orders.findIndex(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));
    if (idx >= 0) {
      const order = data.orders[idx];
      const nowIso = new Date().toISOString();
      order.status = 'Teslim Edildi';
      order.paymentStatus = 'Ödendi';
      if (paymentCollectedMethod) {
        order.paymentMethod = paymentCollectedMethod;
      }
      if (courierName) {
        order.courierName = courierName;
        order.deliveredBy = courierName;
      }
      order.deliveredAt = nowIso;
      order.updatedAt = nowIso;
      order.statusHistory.push({
        status: 'Teslim Edildi',
        timestamp: nowIso,
        user: courierName || 'Kurye',
        note: `Sipariş kurye (${courierName || 'Yetkili'}) tarafından teslim edildi. Tahsilat: ${order.paymentMethod} (₺${order.total || order.subtotal})`
      });
      writeDb(data);
      return order;
    }
    return null;
  },

  // Delete order permanently
  deleteOrder: (id, restoreStock = false) => {
    const data = readDb();
    const idx = data.orders.findIndex(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));
    if (idx >= 0) {
      const removedOrder = data.orders[idx];

      // Restore product stock if requested and order wasn't already cancelled
      if (restoreStock && Array.isArray(removedOrder.items) && removedOrder.status !== 'İptal Edildi') {
        for (const item of removedOrder.items) {
          const orderQty = Number(item.quantity) || 1;
          const pIdx = data.products.findIndex(p => String(p.id) === String(item.id) || p.name === item.name);
          if (pIdx >= 0) {
            const product = data.products[pIdx];
            if (product.trackStock !== false) {
              const currentStock = typeof product.stock === 'number' ? product.stock : 0;
              product.stock = currentStock + orderQty;
              if (product.stock > 0) product.isAvailable = true;
            }
          }
        }
      }

      data.orders.splice(idx, 1);
      writeDb(data);
      return removedOrder;
    }
    return null;
  },

  // Users & Auth
  getUsers: () => readDb().users,
  findUserByEmail: (emailOrUsername) => {
    const clean = String(emailOrUsername || '').trim().toLowerCase();
    const data = readDb();
    return (data.users || []).find((u) => {
      const uEmail = String(u.email || '').trim().toLowerCase();
      const uUsername = String(u.username || '').trim().toLowerCase();
      const uShort = uEmail.split('@')[0];
      return (
        uEmail === clean ||
        uUsername === clean ||
        uShort === clean ||
        (clean === 'admin' && (uEmail.startsWith('admin') || uUsername === 'admin'))
      );
    });
  },
  authenticateUser: (email, pass) => {
    const user = db.findUserByEmail(email);
    if (!user) return null;
    if (!verifyPassword(pass, user.pass) && user.pass !== pass) return null;
    return user;
  },
  createUser: (userData) => {
    const data = readDb();
    const newUser = {
      ...userData,
      pass: hashPassword(userData.pass),
      id: 'u_' + Date.now(),
      orders: [],
      phoneVerified: Boolean(userData.phoneVerified),
      phoneVerifiedAt: userData.phoneVerified
        ? (userData.phoneVerifiedAt || new Date().toISOString())
        : null,
      createdAt: new Date().toISOString()
    };
    data.users.push(newUser);
    writeDb(data);
    return newUser;
  },
  updateUserPhoneVerified: (emailOrPhone, isVerified = true) => {
    const data = readDb();
    const clean = String(emailOrPhone || '').replace(/\D/g, '');
    const cleanEmail = String(emailOrPhone || '').trim().toLowerCase();
    const user = (data.users || []).find((u) => {
      const uPhone = String(u.phone || '').replace(/\D/g, '');
      const uEmail = String(u.email || '').trim().toLowerCase();
      return (
        (clean && uPhone && (uPhone.endsWith(clean) || clean.endsWith(uPhone))) ||
        uEmail === cleanEmail
      );
    });
    if (user) {
      user.phoneVerified = Boolean(isVerified);
      user.phoneVerifiedAt = isVerified ? new Date().toISOString() : null;
      writeDb(data);
      return user;
    }
    return null;
  },

  // WhatsApp OTP İşlemleri
  savePhoneOtp: ({ phone, otpHash, expiresAt }) => {
    const data = readDb();
    data.phoneOtps = data.phoneOtps || [];
    const newOtp = {
      id: 'otp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      phone: String(phone || '').replace(/\D/g, ''),
      otpHash: String(otpHash),
      expiresAt: new Date(expiresAt).toISOString(),
      attempts: 0,
      createdAt: new Date().toISOString(),
      usedAt: null
    };
    data.phoneOtps.push(newOtp);
    writeDb(data);
    return newOtp;
  },

  getLatestPhoneOtp: (phone) => {
    const data = readDb();
    const clean = String(phone || '').replace(/\D/g, '');
    const matching = (data.phoneOtps || []).filter((o) => {
      const oPhone = String(o.phone || '').replace(/\D/g, '');
      return oPhone === clean || (clean.length >= 10 && oPhone.endsWith(clean.slice(-10)));
    });
    if (!matching.length) return null;
    return matching[matching.length - 1];
  },

  canSendOtp: (phone) => {
    const latest = db.getLatestPhoneOtp(phone);
    if (!latest) return { allowed: true, waitSeconds: 0 };
    const elapsedMs = Date.now() - new Date(latest.createdAt).getTime();
    if (elapsedMs < 60 * 1000) {
      return {
        allowed: false,
        waitSeconds: Math.ceil((60000 - elapsedMs) / 1000)
      };
    }
    return { allowed: true, waitSeconds: 0 };
  },

  incrementOtpAttempts: (id) => {
    const data = readDb();
    const rec = (data.phoneOtps || []).find((o) => o.id === id);
    if (rec) {
      rec.attempts = (rec.attempts || 0) + 1;
      writeDb(data);
      return rec.attempts;
    }
    return 0;
  },

  markOtpUsed: (id) => {
    const data = readDb();
    const rec = (data.phoneOtps || []).find((o) => o.id === id);
    if (rec) {
      rec.usedAt = new Date().toISOString();
      writeDb(data);
      return true;
    }
    return false;
  },
  deleteUser: (idOrEmail) => {
    const data = readDb();
    const target = String(idOrEmail || '').trim().toLowerCase();
    data.users = (data.users || []).filter(
      (u) => String(u.id).toLowerCase() !== target && String(u.email || '').toLowerCase() !== target
    );
    writeDb(data);
    return true;
  },
  getUserByIdOrEmail: (idOrEmail) => {
    const data = readDb();
    const target = String(idOrEmail || '').trim().toLowerCase();
    return (data.users || []).find(
      (u) => String(u.id).toLowerCase() === target || String(u.email || '').toLowerCase() === target
    );
  },
  toggleUserBlock: (id, isBlocked, reason = '') => {
    const data = readDb();
    const idx = (data.users || []).findIndex(
      (u) => String(u.id) === String(id) || u.email.toLowerCase() === String(id).toLowerCase()
    );
    if (idx !== -1) {
      data.users[idx].isBlocked = Boolean(isBlocked);
      data.users[idx].blockReason = isBlocked ? (reason || 'Yönetici tarafından engellendi') : '';
      data.users[idx].blockedAt = isBlocked ? new Date().toISOString() : null;
      writeDb(data);
      return data.users[idx];
    }
    return null;
  },
  sendNotificationToUser: (userIdOrAll, notification) => {
    const data = readDb();
    const notifObj = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: notification.title || 'Bilgilendirme',
      message: notification.message || '',
      channel: notification.channel || 'system',
      createdAt: new Date().toISOString(),
      read: false
    };

    if (userIdOrAll === 'all') {
      (data.users || []).forEach((u) => {
        if (!Array.isArray(u.notifications)) u.notifications = [];
        u.notifications.unshift(notifObj);
      });
      writeDb(data);
      return { count: (data.users || []).length, notification: notifObj };
    }

    const idx = (data.users || []).findIndex(
      (u) => String(u.id) === String(userIdOrAll) || u.email.toLowerCase() === String(userIdOrAll).toLowerCase()
    );
    if (idx !== -1) {
      if (!Array.isArray(data.users[idx].notifications)) data.users[idx].notifications = [];
      data.users[idx].notifications.unshift(notifObj);
      writeDb(data);
      return { user: data.users[idx], notification: notifObj };
    }
    return null;
  },
  updateUser: (id, updates) => {
    const data = readDb();
    const idx = (data.users || []).findIndex(
      (u) => String(u.id) === String(id) || u.email.toLowerCase() === String(id).toLowerCase()
    );
    if (idx !== -1) {
      data.users[idx] = {
        ...data.users[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      writeDb(data);
      return data.users[idx];
    }
    return null;
  },

  // Reviews & Feedback
  getReviews: (approvedOnly = false) => {
    const list = readDb().reviews || [];
    if (approvedOnly) {
      return list.filter((r) => r.isApproved === true);
    }
    return list;
  },
  createReview: (review) => {
    const data = readDb();
    const newRev = {
      id: Date.now(),
      ...review,
      isApproved: typeof review.isApproved === 'boolean' ? review.isApproved : false,
      initials: (review.name || 'Misafir').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
      createdAt: new Date().toISOString()
    };
    if (!Array.isArray(data.reviews)) data.reviews = [];
    data.reviews.unshift(newRev);
    writeDb(data);
    return newRev;
  },
  updateReview: (id, updates) => {
    const data = readDb();
    if (!Array.isArray(data.reviews)) data.reviews = [];
    const idx = data.reviews.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) return null;
    data.reviews[idx] = { ...data.reviews[idx], ...updates };
    writeDb(data);
    return data.reviews[idx];
  },
  deleteReview: (id) => {
    const data = readDb();
    if (!Array.isArray(data.reviews)) return false;
    data.reviews = data.reviews.filter((r) => String(r.id) !== String(id));
    writeDb(data);
    return true;
  },
  getFeedbacks: () => readDb().feedback || [],
  createFeedback: (feedback) => {
    const data = readDb();
    const newFb = {
      id: Date.now(),
      ...feedback,
      createdAt: new Date().toISOString()
    };
    data.feedback.unshift(newFb);
    writeDb(data);
    return newFb;
  },

  // ==========================================
  // ROLES & ADMIN STAFF USERS (RBAC)
  // ==========================================
  getRoles: () => {
    const data = readDb();
    if (!Array.isArray(data.roles) || data.roles.length === 0) {
      data.roles = [
        {
          id: 'role_super_admin',
          name: 'Süper Yönetici',
          code: 'super_admin',
          color: 'rose',
          description: 'Tüm sistem ayarları, kullanıcı/rol yönetimi, finansal raporlar ve operasyon üzerinde tam yetki.',
          isSystem: true,
          permissions: ['overview', 'orders', 'inventory', 'products', 'users', 'reviews', 'api', 'delete_order', 'manage_prices', 'view_revenue', 'settings', 'site_content']
        },
        {
          id: 'role_manager',
          name: 'Şube Müdürü',
          code: 'branch_manager',
          color: 'indigo',
          description: 'Ciro takibi, sipariş operasyonu, stok güncelleme, menü yönetimi ve müşteri yorumları yetkisi.',
          isSystem: true,
          permissions: ['overview', 'orders', 'inventory', 'products', 'reviews', 'manage_prices']
        },
        {
          id: 'role_cashier',
          name: 'Kasiyer & Sipariş Sorumlusu',
          code: 'cashier',
          color: 'amber',
          description: 'Yeni siparişleri onaylama, fiş yazdırma, kurye atama ve anlık stok takibi yetkisi.',
          isSystem: true,
          permissions: ['overview', 'orders', 'inventory']
        },
        {
          id: 'role_kitchen',
          name: 'Mutfak Şefi / Usta',
          code: 'kitchen',
          color: 'emerald',
          description: 'Mutfak sipariş ekranı (hazırlanıyor/hazır) ve ürün stok durumu yönetimi.',
          isSystem: true,
          permissions: ['orders', 'inventory']
        }
      ];
      writeDb(data);
    }
    return data.roles;
  },

  saveRole: (rolePayload) => {
    const data = readDb();
    const roles = db.getRoles();
    data.roles = roles;

    if (rolePayload.id) {
      const idx = data.roles.findIndex(r => String(r.id) === String(rolePayload.id));
      if (idx >= 0) {
        data.roles[idx] = {
          ...data.roles[idx],
          name: rolePayload.name || data.roles[idx].name,
          color: rolePayload.color || data.roles[idx].color || 'blue',
          description: rolePayload.description ?? data.roles[idx].description,
          permissions: Array.isArray(rolePayload.permissions) ? rolePayload.permissions : data.roles[idx].permissions
        };
        writeDb(data);
        return data.roles[idx];
      }
    }

    const newRole = {
      id: 'role_' + Date.now(),
      name: rolePayload.name,
      code: (rolePayload.name || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-3),
      color: rolePayload.color || 'blue',
      description: rolePayload.description || 'Özel tanımlanmış yetki rolü.',
      isSystem: false,
      permissions: Array.isArray(rolePayload.permissions) ? rolePayload.permissions : ['orders']
    };
    data.roles.push(newRole);
    writeDb(data);
    return newRole;
  },

  deleteRole: (roleId) => {
    const data = readDb();
    const roles = db.getRoles();
    const target = roles.find(r => String(r.id) === String(roleId));
    if (!target) return false;
    if (target.code === 'super_admin') {
      throw new Error('Süper Yönetici rolü sistem güvenliği için silinemez.');
    }
    data.roles = roles.filter(r => String(r.id) !== String(roleId));
    writeDb(data);
    return true;
  },

  getAdminUsers: () => {
    const data = readDb();
    if (!Array.isArray(data.adminUsers) || data.adminUsers.length === 0) {
      data.adminUsers = [
        {
          id: 'adm_1',
          name: 'Süper Yönetici',
          email: 'admin',
          phone: '0552 104 55 35',
          pass: 'admin',
          roleId: 'role_super_admin',
          roleName: 'Süper Yönetici',
          isActive: true,
          createdAt: '2026-10-01T10:00:00Z'
        }
      ];
      writeDb(data);
    }
    return data.adminUsers;
  },

  saveAdminUser: (userPayload) => {
    const data = readDb();
    const adminUsers = db.getAdminUsers();
    const roles = db.getRoles();
    data.adminUsers = adminUsers;

    const matchedRole = roles.find(r => String(r.id) === String(userPayload.roleId)) || roles[0];

    if (userPayload.id) {
      const idx = data.adminUsers.findIndex(u => String(u.id) === String(userPayload.id));
      if (idx >= 0) {
        data.adminUsers[idx] = {
          ...data.adminUsers[idx],
          name: userPayload.name || data.adminUsers[idx].name,
          email: userPayload.email || data.adminUsers[idx].email,
          phone: userPayload.phone ?? data.adminUsers[idx].phone,
          ...(userPayload.pass ? { pass: hashPassword(userPayload.pass) } : {}),
          roleId: matchedRole.id,
          roleName: matchedRole.name,
          isActive: typeof userPayload.isActive === 'boolean' ? userPayload.isActive : data.adminUsers[idx].isActive
        };
        writeDb(data);
        return data.adminUsers[idx];
      }
    }

    // Check duplicate email
    if (data.adminUsers.some(u => u.email.toLowerCase() === String(userPayload.email || '').toLowerCase())) {
      throw new Error('Bu e-posta / kullanıcı adı ile kayıtlı bir yetkili zaten mevcut.');
    }

    const newAdmin = {
      id: 'adm_' + Date.now(),
      name: userPayload.name,
      email: userPayload.email,
      phone: userPayload.phone || '',
      pass: hashPassword(userPayload.pass || '123456'),
      roleId: matchedRole.id,
      roleName: matchedRole.name,
      isActive: typeof userPayload.isActive === 'boolean' ? userPayload.isActive : true,
      createdAt: new Date().toISOString()
    };
    data.adminUsers.push(newAdmin);
    writeDb(data);
    return newAdmin;
  },

  deleteAdminUser: (userId) => {
    const data = readDb();
    const adminUsers = db.getAdminUsers();
    const target = adminUsers.find(u => String(u.id) === String(userId));
    if (!target) return false;
    if (target.email.toLowerCase() === 'admin@sandwichdiyari.com') {
      throw new Error('Ana Süper Yönetici hesabı silinemez.');
    }
    data.adminUsers = adminUsers.filter(u => String(u.id) !== String(userId));
    writeDb(data);
    return true;
  },

  authenticateAdmin: (emailOrUsername, pass) => {
    const adminUsers = db.getAdminUsers();
    const roles = db.getRoles();
    const cleanInput = String(emailOrUsername || '').trim().toLowerCase();

    const found = adminUsers.find(u => {
      const uEmail = String(u.email || '').toLowerCase();
      const uShort = uEmail.split('@')[0];
      const isMatch =
        uEmail === cleanInput ||
        uShort === cleanInput ||
        (cleanInput === 'admin' && uEmail.startsWith('admin')) ||
        (uEmail === 'admin' && cleanInput.startsWith('admin'));
      return isMatch && verifyPassword(pass, u.pass);
    });

    if (!found) return null;
    if (found.isActive === false) {
      throw new Error('Bu kullanıcı hesabı pasif durumdadır. Yönetici ile iletişime geçin.');
    }

    const roleObj = roles.find(r => String(r.id) === String(found.roleId)) || roles[0];
    return {
      id: found.id,
      name: found.name,
      email: found.email,
      phone: found.phone,
      role: roleObj.name,
      roleId: roleObj.id,
      roleColor: roleObj.color || 'rose',
      permissions: roleObj.permissions || ['overview', 'orders', 'inventory', 'products', 'users', 'reviews', 'api', 'view_revenue', 'settings', 'site_content']
    };
  },

  verifyAdminActionPassword: (pass, requiredPermission = 'delete_order') => {
    if (!pass) return false;
    const adminUsers = db.getAdminUsers();
    const roles = db.getRoles();

    return adminUsers.some(u => {
      if (u.isActive === false) return false;
      if (!verifyPassword(pass, u.pass)) return false;
      const roleObj = roles.find(r => String(r.id) === String(u.roleId));
      if (!roleObj) return true;
      return !requiredPermission || (Array.isArray(roleObj.permissions) && roleObj.permissions.includes(requiredPermission));
    });
  },

  getSiteContent: () => {
    const data = readDb();
    if (!data.siteContent) {
      data.siteContent = DEFAULT_SITE_CONTENT;
      writeDb(data);
    }
    return {
      ...DEFAULT_SITE_CONTENT,
      ...data.siteContent,
      hero: { ...DEFAULT_SITE_CONTENT.hero, ...(data.siteContent.hero || {}) },
      campaignsSection: { ...DEFAULT_SITE_CONTENT.campaignsSection, ...(data.siteContent.campaignsSection || {}) },
      newMenusSection: { ...DEFAULT_SITE_CONTENT.newMenusSection, ...(data.siteContent.newMenusSection || {}) },
      featuresSection: {
        ...DEFAULT_SITE_CONTENT.featuresSection,
        ...(data.siteContent.featuresSection || {}),
        items: Array.isArray(data.siteContent.featuresSection?.items) && data.siteContent.featuresSection.items.length > 0
          ? data.siteContent.featuresSection.items
          : DEFAULT_SITE_CONTENT.featuresSection.items
      },
      reviewsSection: { ...DEFAULT_SITE_CONTENT.reviewsSection, ...(data.siteContent.reviewsSection || {}) },
      contactBar: { ...DEFAULT_SITE_CONTENT.contactBar, ...(data.siteContent.contactBar || {}) }
    };
  },

  saveSiteContent: (newContent) => {
    const data = readDb();
    const current = db.getSiteContent();
    data.siteContent = {
      ...current,
      ...newContent,
      hero: { ...current.hero, ...(newContent.hero || {}) },
      campaignsSection: { ...current.campaignsSection, ...(newContent.campaignsSection || {}) },
      newMenusSection: { ...current.newMenusSection, ...(newContent.newMenusSection || {}) },
      featuresSection: {
        ...current.featuresSection,
        ...(newContent.featuresSection || {}),
        items: Array.isArray(newContent.featuresSection?.items)
          ? newContent.featuresSection.items
          : current.featuresSection.items
      },
      reviewsSection: { ...current.reviewsSection, ...(newContent.reviewsSection || {}) },
      contactBar: { ...current.contactBar, ...(newContent.contactBar || {}) }
    };
    writeDb(data);
    return data.siteContent;
  }
};
