'use client';

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { closeCheckoutModal, openAuthModal, showMessageModal } from '@/store/slices/uiSlice';
import { clearCart } from '@/store/slices/cartSlice';
import { addOrderToUser, login } from '@/store/slices/authSlice';
import { getRestaurantStatus, TORBALI_NEIGHBORHOODS, MIN_ORDER_AMOUNT } from '@/lib/openingHours';
import { formatTurkishPhoneInput, isValidTurkishPhone } from '@/lib/phoneUtils';

export default function CheckoutModal() {
  const dispatch = useDispatch();
  const { isCheckoutModalOpen } = useSelector((state) => state.ui);
  const { items, grandTotal } = useSelector((state) => state.cart);
  const { currentUser } = useSelector((state) => state.auth);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState(TORBALI_NEIGHBORHOODS[0].name);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Kapıda Nakit');
  const [isGuestCheckout, setIsGuestCheckout] = useState(false);
  const [confirmationMethod, setConfirmationMethod] = useState('whatsapp');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const restaurantStatus = getRestaurantStatus();

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setPhone(formatTurkishPhoneInput(currentUser.phone || ''));
      setAddress(currentUser.address || '');
      setErrorMsg('');
    } else {
      setName('');
      setPhone('');
      setAddress('');
    }
    setIsGuestCheckout(false);
    setConfirmationMethod('whatsapp');
  }, [currentUser, isCheckoutModalOpen]);

  if (!isCheckoutModalOpen) return null;

  // GİRİŞ / MİSAFİR KONTROLÜ: Kullanıcı oturum açmamışsa ve misafir moduna geçmediyse seçim sun
  if ((!currentUser || !currentUser.email) && !isGuestCheckout) {
    return (
      <div
        id="checkout-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm"
      >
        <div className="bg-white rounded-3xl max-w-lg w-full p-7 sm:p-9 shadow-2xl relative text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-amber-200 shadow-inner">
            <i className="fa-solid fa-bag-shopping"></i>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-stone-900">
              Siparişe Devam Edin
            </h3>
            <p className="text-stone-500 text-xs sm:text-sm leading-relaxed">
              Üye olmadan <strong>Misafir Olarak Devam Et</strong> butonuna tıklayarak bilgilerinizi girebilir veya hesabınıza giriş yapabilirsiniz.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            {/* 1. Seçenek: Misafir Olarak Devam Et */}
            <button
              type="button"
              onClick={() => setIsGuestCheckout(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-600/25 text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <i className="fa-solid fa-bolt text-amber-300 text-base"></i>
              <span>Misafir Olarak Devam Et</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  dispatch(closeCheckoutModal());
                  dispatch(openAuthModal('login'));
                }}
                className="bg-stone-900 hover:bg-black text-white font-bold py-3 px-3 rounded-2xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Giriş Yap</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch(closeCheckoutModal());
                  dispatch(openAuthModal('register'));
                }}
                className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-3 rounded-2xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-user-plus"></i>
                <span>Kayıt Ol</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dispatch(closeCheckoutModal())}
            className="text-xs font-bold text-stone-400 hover:text-stone-700 pt-1 cursor-pointer"
          >
            Vazgeç ve Sepete Dön
          </button>
        </div>
      </div>
    );
  }

  const handleSubmitOrder = async (e, sendViaWhatsApp = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (items.length === 0) return;

    if ((!currentUser || !currentUser.email) && !isGuestCheckout) {
      setErrorMsg('Sipariş verebilmek için üye girişi yapmanız veya misafir olarak devam etmeniz zorunludur.');
      return;
    }

    const selectedNhObj =
      TORBALI_NEIGHBORHOODS.find((n) => n.name === neighborhood) || TORBALI_NEIGHBORHOODS[0];
    const neighborhoodMin = selectedNhObj.minAmount || MIN_ORDER_AMOUNT;

    if (grandTotal < neighborhoodMin) {
      setErrorMsg(
        `${selectedNhObj.name} için minimum paket servis tutarı ₺${neighborhoodMin}.00'dir (Sepetiniz: ₺${grandTotal.toFixed(2)}).`
      );
      return;
    }

    if (!name.trim() || !address.trim()) {
      setErrorMsg('Lütfen ad soyad ve açık teslimat adresi alanlarını eksiksiz doldurunuz.');
      return;
    }

    if (!isValidTurkishPhone(phone)) {
      setErrorMsg('Lütfen geçerli bir telefon numarası giriniz (Örn: 0532 123 45 67).');
      return;
    }

    const formattedPhone = formatTurkishPhoneInput(phone);

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const fullAddress = `[${neighborhood}] ${address.trim()}`;
      const isGuestMode = isGuestCheckout || Boolean(currentUser?.isGuest);
      const cleanDigits = phone.replace(/\D/g, '');
      const guestEmail = `misafir_${cleanDigits.slice(-10) || Date.now()}@sandwichdiyari.com`;
      const effectiveEmail = currentUser?.email || guestEmail;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: formattedPhone,
          phone: formattedPhone,
          customerAddress: fullAddress,
          address: fullAddress,
          neighborhood,
          paymentMethod,
          items,
          orderNote: notes.trim(),
          notes: notes.trim(),
          userEmail: effectiveEmail,
          isGuest: isGuestMode,
          confirmationMethod: isGuestMode ? confirmationMethod : undefined,
          isScheduled: !restaurantStatus.isOpen,
          scheduledFor: !restaurantStatus.isOpen ? '10:00 Sabah Açılış Siparişi' : null,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Sipariş oluşturulamadı.');
      }

      const createdOrder = json.data;

      if (!currentUser && isGuestCheckout) {
        dispatch(
          login({
            user: {
              id: `guest_${Date.now()}`,
              name: name.trim(),
              phone: formattedPhone,
              address: fullAddress,
              email: effectiveEmail,
              isGuest: true,
              phoneVerified: true,
              createdAt: new Date().toISOString(),
            },
          })
        );
      }

      try {
        localStorage.setItem('sd_new_order_alert', String(Date.now()));
        localStorage.setItem('sd_last_order', JSON.stringify(createdOrder));
        localStorage.setItem('sandwich_inventory_updated', Date.now().toString());
        window.dispatchEvent(new Event('sd_order_created'));
      } catch (e) { }

      // Add to user in Redux
      dispatch(
        addOrderToUser({
          id: createdOrder.orderNumber || createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          date: createdOrder.date || new Date().toLocaleDateString('tr-TR'),
          total: createdOrder.total || grandTotal,
          items: items.map((i) => `${i.name} (${i.quantity}x)`).join(', ') + ` [${paymentMethod}]`,
          paymentMethod,
          customerName: name.trim(),
          phone: formattedPhone,
          address: fullAddress,
          status: createdOrder.status || 'Yeni',
        })
      );

      // Saat 03:00 - 10:00 arasında WhatsApp bildirim mesajı ASLA tetiklenmez
      if (sendViaWhatsApp && restaurantStatus.isOpen) {
        const itemsText = items
          .map(
            (i) =>
              `• ${i.quantity}x ${i.name} (₺${(i.price * i.quantity).toFixed(2)})${i.details ? `\n   ${i.details}` : ''
              }`
          )
          .join('\n');
        const waMsg = encodeURIComponent(
          `🥪 *SANDVİÇ DİYARI SİPARİŞİ* (No: #${createdOrder.orderNumber || createdOrder.id})\n\n` +
          `👤 *Müşteri:* ${name.trim()} (${effectiveEmail})\n` +
          `📞 *Telefon:* ${formattedPhone}\n` +
          `📍 *Mahalle / Bölge:* ${neighborhood}\n` +
          `🏠 *Adres:* ${address.trim()}\n` +
          (notes.trim() ? `📝 *Not:* ${notes.trim()}\n` : '') +
          `💳 *Ödeme:* ${paymentMethod}\n\n` +
          `📦 *Ürünler:*\n${itemsText}\n\n` +
          `💰 *Toplam:* ₺${grandTotal.toFixed(2)}\n` +
          `🛵 *Paket Servis:* Ücretsiz`
        );
        window.open(`https://wa.me/905521045535?text=${waMsg}`, '_blank');
      }

      dispatch(closeCheckoutModal());
      dispatch(clearCart());

      dispatch(
        showMessageModal({
          title: !restaurantStatus.isOpen ? 'Açılış Siparişiniz Alındı! ⏰' : 'Siparişiniz Alındı! 🛵',
          text: !restaurantStatus.isOpen
            ? `Sipariş Numaranız: ${createdOrder.orderNumber || createdOrder.id}\nRestoranımız kapalı olduğundan sabah saat 10:00'da ilk sırada taze hazırlanarak adresinize ulaştırılacaktır.`
            : `Sipariş Numaranız: ${createdOrder.orderNumber || createdOrder.id}\nÖdeme (${paymentMethod}) teslimatta kapıda alınacaktır.${sendViaWhatsApp ? '\nSipariş detayınız WhatsApp üzerinden restoranımıza iletildi!' : ''
            } Şimdiden afiyet olsun!`,
          type: 'success',
        })
      );
    } catch (err) {
      setErrorMsg(err.message || 'Sipariş iletilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedNh =
    TORBALI_NEIGHBORHOODS.find((n) => n.name === neighborhood) || TORBALI_NEIGHBORHOODS[0];

  return (
    <div
      id="checkout-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-9 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-brand-200 shrink-0">
              <i className="fa-solid fa-bag-shopping"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  Sipariş &amp; Teslimat Bilgileri
                </h3>
                <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isGuestCheckout || currentUser?.isGuest
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {isGuestCheckout || currentUser?.isGuest
                    ? `Misafir Siparişi${name ? `: ${name}` : ''}`
                    : `Üye: ${currentUser?.name}`}
                </span>
              </div>
              <p className="text-stone-500 text-xs sm:text-sm">
                Teslimat bilgilerinizi kontrol edip kapıda ödeme yönteminizi seçiniz.
              </p>
            </div>
          </div>

          {!restaurantStatus.isOpen ? (
            <div className="hidden sm:inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-full text-xs font-bold shrink-0">
              <i className="fa-solid fa-clock text-amber-700"></i>
              <span>10:00 Açılış Siparişi</span>
            </div>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold shrink-0">
              <i className="fa-solid fa-motorcycle text-emerald-600"></i>
              <span>
                {neighborhood}: {selectedNh.estimate}
              </span>
            </div>
          )}
        </div>

        {/* Misafir Siparişi Onay Tercihi (Aranmak İstiyorum / WhatsApp'tan Onay) */}
        {(isGuestCheckout || currentUser?.isGuest) && (
          <div className="space-y-2 bg-stone-50 border border-stone-200/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wide">
                Sipariş Onay Tercihiniz <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-stone-500 font-semibold">
                Yönetim paneline doğrudan iletilir
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmationMethod('phone')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  confirmationMethod === 'phone'
                    ? 'border-brand-500 bg-brand-50/90 shadow-xs'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${
                  confirmationMethod === 'phone'
                    ? 'bg-brand-500 text-white'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  <i className="fa-solid fa-phone-volume"></i>
                </div>
                <div>
                  <span className="font-extrabold text-xs text-stone-900 block">
                    Aranmak İstiyorum
                  </span>
                  <span className="text-[10px] text-stone-500 leading-tight block mt-0.5">
                    Telefon ile aranarak sipariş onayı vermek istiyorum.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConfirmationMethod('whatsapp')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  confirmationMethod === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50/90 shadow-xs'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base ${
                  confirmationMethod === 'whatsapp'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 text-emerald-600'
                }`}>
                  <i className="fa-brands fa-whatsapp"></i>
                </div>
                <div>
                  <span className="font-extrabold text-xs text-stone-900 block">
                    WhatsApp'tan Onay
                  </span>
                  <span className="text-[10px] text-stone-500 leading-tight block mt-0.5">
                    WhatsApp mesajı ile siparişimi onaylamak istiyorum.
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm p-3.5 rounded-2xl flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation shrink-0 text-rose-500"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1.5 tracking-wide">
                Ad Soyad <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="order-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 font-semibold text-stone-800"
                placeholder="Ad Soyad"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1.5 tracking-wide">
                Telefon Numarası <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                id="order-phone"
                inputMode="numeric"
                maxLength={14}
                required
                value={phone}
                onChange={(e) => {
                  setPhone(formatTurkishPhoneInput(e.target.value));
                  setErrorMsg('');
                }}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 font-semibold text-stone-800"
                placeholder="0532 123 45 67"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide">
                  Teslimat Bölgesi / Mahalle <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-brand-600 font-bold">
                  Min: ₺{selectedNh.minAmount}
                </span>
              </div>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="app-select w-full bg-stone-50 hover:bg-white border border-stone-200 hover:border-brand-400 rounded-2xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-bold text-stone-800 cursor-pointer shadow-2xs transition-all"
              >
                {TORBALI_NEIGHBORHOODS.map((nh) => (
                  <option key={nh.name} value={nh.name}>
                    {nh.name} &bull; Min: ₺{nh.minAmount} ({nh.estimate})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1.5 tracking-wide">
                Sipariş Notu / Daire &amp; Kat{' '}
                <span className="text-stone-400 font-normal lowercase">(isteğe bağlı)</span>
              </label>
              <input
                type="text"
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-medium text-stone-800"
                placeholder="Örn: 3. Kat Daire 7, zile basmayın..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1.5 tracking-wide">
              Açık Adres (Sokak, Bina No, Torbalı) <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="order-address"
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-medium text-stone-800 resize-none"
              placeholder="Örn: Hüseyin Kurtuldu Sok. No:32 Torbalı / İzmir..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8">
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1.5 tracking-wide">
                Ödeme Yöntemi (Kapıda Teslim)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${paymentMethod === 'Kapıda Nakit'
                    ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                    : 'border-stone-200 bg-stone-50 hover:border-brand-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value="Kapıda Nakit"
                    checked={paymentMethod === 'Kapıda Nakit'}
                    onChange={() => setPaymentMethod('Kapıda Nakit')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs sm:text-sm font-bold text-stone-800 flex items-center gap-2">
                    <i className="fa-solid fa-wallet text-brand-600"></i> Kapıda Nakit
                  </span>
                </label>

                <label
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${paymentMethod === 'Kapıda Kredi Kartı'
                    ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                    : 'border-stone-200 bg-stone-50 hover:border-brand-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value="Kapıda Kredi Kartı"
                    checked={paymentMethod === 'Kapıda Kredi Kartı'}
                    onChange={() => setPaymentMethod('Kapıda Kredi Kartı')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs sm:text-sm font-bold text-stone-800 flex items-center gap-2">
                    <i className="fa-solid fa-credit-card text-brand-600"></i> Kapıda Kart
                  </span>
                </label>
              </div>
            </div>

            <div className="md:col-span-4 bg-stone-50 rounded-2xl p-3.5 border border-stone-200 flex justify-between items-center">
              <span className="text-stone-500 font-bold text-xs">Toplam:</span>
              <span className="text-xl font-black text-brand-600">₺{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${restaurantStatus.isOpen ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 pt-2 border-t border-stone-100`}>
            <button
              type="button"
              onClick={() => dispatch(closeCheckoutModal())}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-3.5 rounded-2xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-brand-500/20 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  <span>İşleniyor...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i>
                  <span>{restaurantStatus.isOpen ? 'Siparişi Onayla' : 'Sabah 10:00 İçin Siparişi Onayla'}</span>
                </>
              )}
            </button>
            {restaurantStatus.isOpen && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleSubmitOrder(e, true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-emerald-600/20 text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <i className="fa-brands fa-whatsapp text-base"></i>
                <span>WhatsApp ile Ver</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
