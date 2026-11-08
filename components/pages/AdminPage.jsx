'use client';

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addProduct, deleteProduct } from '@/store/slices/productSlice';
import { showMessageModal, setActiveAdminTab } from '@/store/slices/uiSlice';

export default function AdminPage() {
  const dispatch = useDispatch();
  const { items: products } = useSelector((state) => state.product);
  const { activeAdminTab } = useSelector((state) => state.ui);

  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loadingOrders, setLoadingOrders] = useState(false);

  // New product form
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('sandwich');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdBadge, setNewProdBadge] = useState('');
  const [newProdImage, setNewProdImage] = useState('/images/hero_banner.jpg');

  // Load orders from API
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders');
      const json = await res.json();
      if (json.success) {
        setOrders(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
        dispatch(
          showMessageModal({
            title: 'Durum Güncellendi',
            text: `Sipariş #${orderId} durumu "${newStatus}" olarak ayarlandı.`,
            type: 'success',
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    const pass = prompt(`Sipariş #${orderId} kalıcı olarak silinecektir.\nLütfen onaylamak için yönetici şifrenizi giriniz:`, '');
    if (!pass) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass, restoreStock: true })
      });
      const json = await res.json();
      if (json.success) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        dispatch(
          showMessageModal({
            title: 'Sipariş Silindi 🗑️',
            text: json.message || 'Sipariş başarıyla silindi.',
            type: 'success'
          })
        );
      } else {
        alert(json.error || 'Silme işlemi başarısız.');
      }
    } catch (e) {
      alert('Sipariş silinirken bağlantı hatası oluştu.');
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;

    const prodData = {
      name: newProdName,
      category: newProdCategory,
      price: parseFloat(newProdPrice),
      description: newProdDesc,
      badge: newProdBadge,
      image: newProdImage,
    };

    dispatch(addProduct(prodData));

    // Save to server DB as well
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodData),
      });
    } catch (err) {
      console.error(err);
    }

    dispatch(
      showMessageModal({
        title: 'Ürün Eklendi',
        text: `"${newProdName}" başarıyla menüye eklendi ve tüm platformlara senkronize edildi.`,
        type: 'success',
      })
    );

    setNewProdName('');
    setNewProdPrice('');
    setNewProdDesc('');
    setNewProdBadge('');
  };

  const handleDeleteProduct = async (id) => {
    dispatch(deleteProduct(id));
    dispatch(
      showMessageModal({
        title: 'Ürün Silindi',
        text: 'Ürün menüden kaldırıldı.',
        type: 'success',
      })
    );
  };

  const filteredOrders =
    filterStatus === 'all'
      ? orders
      : filterStatus === 'active'
      ? orders.filter((o) => o.status !== 'Teslim Edildi' && o.status !== 'İptal')
      : orders.filter((o) => o.status === filterStatus);

  return (
    <div id="page-admin" className="page-content min-h-screen py-4 sm:py-8 px-3.5 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Admin Header */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-stone-200 shadow-sm mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-500 text-white rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-lg shadow-brand-500/20 shrink-0">
            <i className="fa-solid fa-gauge-high"></i>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-3xl font-extrabold text-stone-900 truncate">
                Yönetim Paneli & API Merkezi
              </h2>
              <span className="bg-green-100 text-green-700 font-bold px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs">
                Canlı Bağlantı
              </span>
            </div>
            <p className="text-stone-500 text-xs sm:text-sm mt-0.5 line-clamp-2">
              Tek bir veri kaynağı üzerinden Web, Mobil Uygulamalar ve Kurye sipariş takibi.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-stone-100 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => dispatch(setActiveAdminTab('orders'))}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeAdminTab === 'orders'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-bell mr-1.5"></i> Siparişler ({orders.length})
          </button>
          <button
            onClick={() => dispatch(setActiveAdminTab('products'))}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeAdminTab === 'products'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-utensils mr-1.5"></i> Ürün Yönetimi
          </button>
          <button
            onClick={() => dispatch(setActiveAdminTab('mobile'))}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeAdminTab === 'mobile'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-mobile-screen mr-1.5"></i> Mobil API
          </button>
        </div>
      </div>

      {/* TAB 1: SİPARİŞ YÖNETİMİ */}
      {activeAdminTab === 'orders' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <span className="text-xs font-bold uppercase text-stone-500 shrink-0 mr-1">Filtre:</span>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                  filterStatus === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Tümü ({orders.length})
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                  filterStatus === 'active'
                    ? 'bg-brand-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Aktif Siparişler
              </button>
              <button
                onClick={() => setFilterStatus('Teslim Edildi')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                  filterStatus === 'Teslim Edildi'
                    ? 'bg-brand-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Teslim Edilenler
              </button>
            </div>

            <button
              onClick={fetchOrders}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center justify-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200 cursor-pointer self-start sm:self-auto"
            >
              <i className={`fa-solid fa-rotate-right ${loadingOrders ? 'fa-spin' : ''}`}></i>
              Yenile
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-stone-200 text-stone-400">
                <i className="fa-solid fa-inbox text-4xl mb-3"></i>
                <p className="font-semibold text-stone-600 text-sm">Bu filtrelere uygun sipariş bulunmuyor.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isDelivered = order.status === 'Teslim Edildi';
                const isCancelled = order.status === 'İptal';

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-stone-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col lg:flex-row justify-between gap-4 sm:gap-6"
                  >
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="font-extrabold text-stone-900 text-sm sm:text-base">
                          Sipariş No: {order.orderNumber || order.id}
                        </span>
                        <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[11px] sm:text-xs">
                          {order.paymentMethod || 'Kapıda Nakit'}
                        </span>
                        <span
                          className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs ${
                            isDelivered
                              ? 'bg-green-100 text-green-700'
                              : isCancelled
                              ? 'bg-red-100 text-red-700'
                              : 'bg-brand-100 text-brand-700'
                          }`}
                        >
                          {order.status || 'Sipariş Alındı'}
                        </span>
                        <span className="text-[11px] sm:text-xs text-stone-400">{order.date}</span>
                      </div>

                      <div className="text-xs space-y-1.5 text-stone-700 bg-stone-50 p-3 rounded-xl sm:rounded-2xl border border-stone-100">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <p>
                            <strong>Müşteri:</strong> {order.customerName}
                          </p>
                          {order.phone && (
                            <a
                              href={`tel:${order.phone}`}
                              className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-brand-100"
                            >
                              <i className="fa-solid fa-phone text-[10px]"></i>
                              {order.phone}
                            </a>
                          )}
                        </div>
                        <p className="line-clamp-2">
                          <strong>Teslimat Adresi:</strong> {order.address}
                        </p>
                        {order.notes && (
                          <p className="text-brand-700 font-medium">
                            <strong>Not:</strong> "{order.notes}"
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-stone-600 line-clamp-3">
                        <strong>Ürünler:</strong>{' '}
                        {Array.isArray(order.items)
                          ? order.items
                              .map((i) =>
                                typeof i === 'string'
                                  ? i
                                  : `${i.name} (x${i.quantity})${i.details ? ` [${i.details}]` : ''}`
                              )
                              .join(', ')
                          : order.items}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col justify-between items-stretch sm:items-end gap-3 shrink-0 pt-3.5 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                      <div className="flex sm:flex-col justify-between items-center sm:items-end">
                        <span className="text-xs text-stone-400 sm:text-right">Tutar</span>
                        <span className="text-lg sm:text-xl font-extrabold text-brand-600 sm:text-right">
                          ₺{Number(order.total || order.subtotal || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 justify-end">
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'Hazırlanıyor')}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Hazırlanıyor
                        </button>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'Kuryede')}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Kuryede
                        </button>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'Teslim Edildi')}
                          className="bg-green-600 hover:bg-green-700 text-white text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Teslim Edildi
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 text-[11px] sm:text-xs font-bold p-2 sm:px-2.5 rounded-lg border border-stone-200 transition-colors cursor-pointer text-center"
                          title="Siparişi Sil (Yönetici Onaylı)"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ÜRÜN YÖNETİMİ */}
      {activeAdminTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Yeni Ürün / Menü Ekleme Formu */}
          <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-xl text-stone-900 flex items-center gap-2">
              <i className="fa-solid fa-plus-circle text-brand-600"></i> Yeni Ürün veya Menü Ekle
            </h3>
            <p className="text-xs text-stone-500">
              Buraya eklediğiniz ürünler tek data üzerinden hem web sitemizde hem de mobil uygulamada anında listelenir.
            </p>

            <form onSubmit={handleCreateProduct} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Ürün Adı
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Örn: Mega Gurme Burger Menü"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-stone-800 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Kategori / Tür
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="app-select w-full bg-stone-50 hover:bg-white border border-stone-200 hover:border-brand-400 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-brand-500 shadow-2xs transition-all cursor-pointer"
                  >
                    <option value="menu">Menü (Avantajlı Menülü Satış)</option>
                    <option value="sandwich">Sandviç (Bireysel Satış)</option>
                    <option value="snack">Atıştırmalık (Bireysel)</option>
                    <option value="drink">İçecek (Bireysel)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                    Fiyat (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="199.99"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-medium text-stone-800 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Rozet / Etiket
                </label>
                <input
                  type="text"
                  value={newProdBadge}
                  onChange={(e) => setNewProdBadge(e.target.value)}
                  placeholder="Örn: Yeni Çıktı, Gurme, Avantajlı Menü"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-stone-800 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Görsel Seçimi
                </label>
                <select
                  value={newProdImage}
                  onChange={(e) => setNewProdImage(e.target.value)}
                  className="app-select w-full bg-stone-50 hover:bg-white border border-stone-200 hover:border-brand-400 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-brand-500 shadow-2xs transition-all cursor-pointer"
                >
                  <option value="/images/kasap_kofte_ekmek.jpg">Kasap Köfte Ekmek Görseli</option>
                  <option value="/images/megzi_durum.jpg">Megzi Dürüm Görseli</option>
                  <option value="/images/ayvalik_tostu.jpg">Ayvalık Tostu Görseli</option>
                  <option value="/images/kasap_sucuk_ekmek.jpg">Kasap Sucuğu Sandviç Görseli</option>
                  <option value="/images/cheeseburger.jpg">Cheeseburger / Hamburger Görseli</option>
                  <option value="/images/hero_banner.jpg">Gourmet Burger & Menü Görseli</option>
                  <option value="/images/crispy_chicken_menu.jpg">Çıtır Tavuk Kova Görseli</option>
                  <option value="/images/loaded_cheddar_fries.jpg">Loaded Cheddar Patates Görseli</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Açıklama / İçindekiler
                </label>
                <textarea
                  rows={3}
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  placeholder="Özel sos, taze yeşillikler, büyük boy patates..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
              >
                Ürünü Kaydet ve Yayınla
              </button>
            </form>
          </div>

          {/* Mevcut Ürünler Listesi */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="font-extrabold text-xl text-stone-900">
              Menüdeki Aktif Ürünler ({products.length})
            </h3>
            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover bg-stone-100 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=200';
                      }}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-stone-900 truncate block">
                        {p.name}
                      </span>
                      <span className="text-xs text-stone-400 capitalize">
                        {p.category === 'menu' ? '🍱 Avantajlı Menü' : '🥪 Bireysel Satış'} &bull; ₺{p.price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="text-stone-400 hover:text-red-500 text-sm p-2 transition-colors cursor-pointer"
                    title="Ürünü Sil"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MOBİL UYGULAMA & API ENTEGRASYON HUB'I */}
      {activeAdminTab === 'mobile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
                Merkezi Veri & Mobil Entegrasyon
              </span>
              <h3 className="text-2xl font-extrabold text-stone-900">
                Tek Veri Tabanı, Çift Platform (Web + Mobil)
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed max-w-3xl">
                Mobil uygulamalarınız (React Native / Flutter / Swift / Kotlin) aşağıdaki REST API uç noktaları üzerinden doğrudan giriş yapabilir, ürünleri senkronize edebilir ve tamamen elden ödemeli siparişler oluşturabilir.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Endpoint 1 */}
              <div className="bg-stone-900 text-white p-5 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="bg-green-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                    POST
                  </span>
                  <span className="text-stone-400 font-sans text-[11px]">Mobil Kullanıcı Girişi</span>
                </div>
                <div className="text-brand-400 font-bold">/api/auth/login</div>
                <p className="text-stone-400 font-sans text-xs">
                  Mobil uygulamanın kullanıcı girişi yapmasını sağlar. Giriş başarılı olunca kullanıcı bilgileri ve Bearer Token döner.
                </p>
                <div className="bg-stone-950 p-2.5 rounded-lg text-stone-300">
                  {`{ "email": "demo@sandwichdiyari.com", "pass": "123456" }`}
                </div>
              </div>

              {/* Endpoint 2 */}
              <div className="bg-stone-900 text-white p-5 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                    GET
                  </span>
                  <span className="text-stone-400 font-sans text-[11px]">Menü & Ürünleri Çek</span>
                </div>
                <div className="text-brand-400 font-bold">/api/products</div>
                <p className="text-stone-400 font-sans text-xs">
                  Web ve Mobil için menülü ve bireysel tüm ürünleri çeker. `?category=menu` ile filtrelenebilir.
                </p>
                <div className="bg-stone-950 p-2.5 rounded-lg text-stone-300">
                  {`Response: { "success": true, "count": 10, "data": [...] }`}
                </div>
              </div>

              {/* Endpoint 3 */}
              <div className="bg-stone-900 text-white p-5 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="bg-green-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                    POST
                  </span>
                  <span className="text-stone-400 font-sans text-[11px]">Mobil Sipariş Oluştur</span>
                </div>
                <div className="text-brand-400 font-bold">/api/orders</div>
                <p className="text-stone-400 font-sans text-xs">
                  Mobilden sipariş oluşturur. Ödeme "Kapıda Nakit" veya "Kapıda Kredi Kartı" olarak kaydedilir.
                </p>
                <div className="bg-stone-950 p-2.5 rounded-lg text-stone-300">
                  {`{ "customerName": "Ali", "paymentMethod": "Kapıda Nakit", "items": [...] }`}
                </div>
              </div>

              {/* Endpoint 4 */}
              <div className="bg-stone-900 text-white p-5 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="bg-amber-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                    PATCH
                  </span>
                  <span className="text-stone-400 font-sans text-[11px]">Kurye Durum Güncelle</span>
                </div>
                <div className="text-brand-400 font-bold">/api/orders/[id]</div>
                <p className="text-stone-400 font-sans text-xs">
                  Kurye veya mutfak panelinden siparişin durumunu anlık günceller (Sipariş Alındı -&gt; Kuryede -&gt; Teslim Edildi).
                </p>
                <div className="bg-stone-950 p-2.5 rounded-lg text-stone-300">
                  {`{ "status": "Kuryede" }`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
