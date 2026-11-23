'use client';

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { closeCheckoutModal, openAuthModal, showMessageModal } from '@/store/slices/uiSlice';
import { clearCart } from '@/store/slices/cartSlice';
import { addOrderToUser, login } from '@/store/slices/authSlice';
import { getRestaurantStatus, TORBALI_NEIGHBORHOODS, MIN_ORDER_AMOUNT } from '@/lib/openingHours';
import { formatTurkishPhoneInput, isValidTurkishPhone } from '@/lib/phoneUtils';
import { getOrderPauseState, formatOrderPauseMessage } from '@/lib/orderPause';

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
  const [orderPause, setOrderPause] = useState({ paused: false });

  // Yönetici sipariş alımını geçici durdurduysa checkout ekranında göster
  useEffect(() => {
    if (!isCheckoutModalOpen) return;
    let cancelled = false;
    const loadPause = () => {
      fetch('/api/admin/settings', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled && j?.data) setOrderPause(getOrderPauseState(j.data));
        })
        .catch(() => {});
    };
    loadPause();
    const timer = setInterval(loadPause, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isCheckoutModalOpen]);

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
    const totalItemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const previewThumbs = items.filter((item) => item?.image).slice(0, 3);

    return (
      <div
        id="checkout-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-md overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) dispatch(closeCheckoutModal());
        }}
      >
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2rem] max-w-3xl w-full shadow-2xl border border-white/15 relative overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 grid grid-cols-1 md:grid-cols-12">
          {/* Sol Görsel Vitrin Paneli */}
          <div className="md:col-span-5 relative min-h-[210px] md:min-h-[450px] bg-stone-950 overflow-hidden flex flex-col justify-between p-5 sm:p-6">
            <img
              src="/images/reviews_showcase.jpg"
              alt="Sandviç Diyarı Lezzetleri"
              className="absolute inset-0 w-full h-full object-cover object-center scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/55 to-stone-950/20" />

            {/* Üst Rozet */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 bg-amber-500/95 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                <i className="fa-solid fa-fire text-[10px]"></i>
                Sıcak &amp; Taze
              </span>
              {/* Mobil Kapat Butonu */}
              <button
                type="button"
                onClick={() => dispatch(closeCheckoutModal())}
                aria-label="Kapat"
                className="md:hidden w-9 h-9 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Alt Özet Kartı */}
            <div className="relative z-10 space-y-3 mt-auto pt-8">
              <div>
                <p className="text-amber-300 text-[10px] font-black uppercase tracking-widest mb-1">
                  Sandviç Diyarı
                </p>
                <h4 className="text-white text-xl sm:text-2xl font-black leading-tight drop-shadow-sm">
                  Lezzet kapınıza bir adım uzakta
                </h4>
              </div>

              {totalItemCount > 0 && (
                <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {previewThumbs.length > 0 ? (
                      <div className="flex -space-x-2.5 shrink-0">
                        {previewThumbs.map((item, idx) => (
                          <img
                            key={`${item.id || idx}-${idx}`}
                            src={item.image}
                            alt={item.name}
                            className="w-9 h-9 rounded-full object-cover border-2 border-stone-900 bg-stone-800"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-bag-shopping"></i>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider">
                        Sepetiniz
                      </p>
                      <p className="text-xs font-extrabold text-white truncate">
                        {totalItemCount} Ürün Seçildi
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-amber-400">
                      ₺{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sağ Aksiyon Paneli */}
          <div className="md:col-span-7 bg-stone-50/90 p-5 sm:p-7 flex flex-col justify-between relative">
            {/* Masaüstü Kapat Butonu */}
            <button
              type="button"
              onClick={() => dispatch(closeCheckoutModal())}
              aria-label="Kapat"
              className="hidden md:flex absolute top-5 right-5 w-9 h-9 rounded-full bg-white border border-stone-200 text-stone-500 hover:text-stone-900 hover:border-stone-300 items-center justify-center shadow-2xs transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>

            <div className="space-y-5">
              {/* Başlık */}
              <div className="space-y-1.5 pr-0 md:pr-10">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/90 border border-amber-200/80 px-2.5 py-1 rounded-full">
                  <i className="fa-solid fa-bag-shopping text-[10px]"></i>
                  Sipariş Adımı
                </div>
                <h3 className="text-2xl sm:text-[26px] font-black text-stone-900 tracking-tight">
                  Siparişe Devam Edin
                </h3>
                <p className="text-stone-500 text-xs sm:text-sm leading-relaxed">
                  Üye olmadan <strong>hızlıca devam edebilir</strong> veya hesabınızla giriş yaparak adres bilgilerinizi otomatik kullanabilirsiniz.
                </p>
              </div>

              {/* Aksiyon Butonları */}
              <div className="space-y-3">
                {/* 1. Seçenek: Misafir Olarak Devam Et */}
                <button
                  type="button"
                  onClick={() => setIsGuestCheckout(true)}
                  className="w-full group bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 text-left">
                    <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-bolt text-amber-300 text-lg"></i>
                    </div>
                    <div>
                      <span className="block font-black text-sm sm:text-base leading-tight">
                        Misafir Olarak Devam Et
                      </span>
                      <span className="block text-[11px] font-medium text-emerald-100 mt-0.5">
                        Üyelik gerekmez • 30 saniyede sipariş
                      </span>
                    </div>
                  </div>
                  <i className="fa-solid fa-arrow-right text-sm text-white/80 group-hover:translate-x-1 transition-transform shrink-0"></i>
                </button>

                {/* Ayraç */}
                <div className="relative py-1 flex items-center justify-center">
                  <div className="absolute inset-x-0 h-px bg-stone-200" />
                  <span className="relative bg-stone-50 px-3 text-[11px] font-bold text-stone-400">
                    veya hesabınızla devam edin
                  </span>
                </div>

                {/* Giriş Yap & Kayıt Ol */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(closeCheckoutModal());
                      dispatch(openAuthModal('login'));
                    }}
                    className="bg-stone-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-2xl text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
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
                    className="bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold py-3.5 px-4 rounded-2xl text-xs sm:text-sm shadow-sm shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <i className="fa-solid fa-user-plus"></i>
                    <span>Kayıt Ol</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Alt Güven Bilgisi ve Geri Dön */}
            <div className="pt-5 mt-5 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-500">
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-wallet text-amber-500"></i>
                  Kapıda Ödeme
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-motorcycle text-emerald-600"></i>
                  Hızlı Kurye
                </span>
              </div>

              <button
                type="button"
                onClick={() => dispatch(closeCheckoutModal())}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left text-[10px]"></i>
                Vazgeç ve Sepete Dön
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmitOrder = async (e, sendViaWhatsApp = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (items.length === 0) return;

    if (orderPause.paused) {
      setErrorMsg(formatOrderPauseMessage(orderPause));
      return;
    }

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

      if (isGuestMode) {
        const nextGuestUser = currentUser && currentUser.isGuest
          ? { ...currentUser, lastOrderId: createdOrder.id }
          : {
              id: `guest_${Date.now()}`,
              name: name.trim(),
              phone: formattedPhone,
              address: fullAddress,
              email: effectiveEmail,
              isGuest: true,
              phoneVerified: true,
              lastOrderId: createdOrder.id,
              createdAt: new Date().toISOString(),
            };
        dispatch(login({ user: nextGuestUser }));
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
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative space-y-3.5 animate-in fade-in zoom-in-95 duration-200 my-auto sm:my-6 max-h-[94vh] sm:max-h-[92vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
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

        {orderPause.paused && (
          <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs sm:text-sm p-3.5 rounded-2xl flex items-start gap-2.5">
            <i className="fa-solid fa-hourglass-half shrink-0 text-amber-600 mt-0.5"></i>
            <div>
              <strong className="block font-extrabold">Şu an geçici olarak sipariş alamıyoruz</strong>
              <span>{formatOrderPauseMessage(orderPause)}</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm p-3.5 rounded-2xl flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation shrink-0 text-rose-500"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1 tracking-wide">
                Ad Soyad <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="order-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-semibold text-stone-800"
                placeholder="Ad Soyad"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1 tracking-wide">
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
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-semibold text-stone-800"
                placeholder="0532 123 45 67"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide">
                  Teslimat Bölgesi / Mahalle <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-brand-600 font-bold">
                  Min: ₺{selectedNh.minAmount}
                </span>
              </div>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="app-select w-full bg-stone-50 hover:bg-white border border-stone-200 hover:border-brand-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-bold text-stone-800 cursor-pointer shadow-2xs transition-all"
              >
                {TORBALI_NEIGHBORHOODS.map((nh) => (
                  <option key={nh.name} value={nh.name}>
                    {nh.name} &bull; Min: ₺{nh.minAmount} ({nh.estimate})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1 tracking-wide">
                Sipariş Notu / Daire &amp; Kat{' '}
                <span className="text-stone-400 font-normal lowercase">(isteğe bağlı)</span>
              </label>
              <input
                type="text"
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-medium text-stone-800"
                placeholder="Örn: 3. Kat Daire 7, zile basmayın..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1 tracking-wide">
                Açık Adres (Sokak, Bina No, Torbalı) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="order-address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-medium text-stone-800"
                placeholder="Örn: Hüseyin Kurtuldu Sok. No:32..."
              />
            </div>

            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1 tracking-wide">
                Ödeme Yöntemi (Kapıda Teslim)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${paymentMethod === 'Kapıda Nakit'
                    ? 'border-brand-500 bg-brand-50/50 shadow-2xs'
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
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <i className="fa-solid fa-wallet text-brand-600"></i> Kapıda Nakit
                  </span>
                </label>

                <label
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${paymentMethod === 'Kapıda Kredi Kartı'
                    ? 'border-brand-500 bg-brand-50/50 shadow-2xs'
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
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <i className="fa-solid fa-credit-card text-brand-600"></i> Kapıda Kart
                  </span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2 bg-stone-50 rounded-xl px-3 py-2 border border-stone-200 flex md:flex-col justify-between md:justify-center items-center">
              <span className="text-stone-500 font-bold text-[10px] uppercase">Toplam</span>
              <span className="text-base font-black text-brand-600 leading-tight">₺{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 flex items-center gap-1.5 px-1">
            <i className="fa-solid fa-shield-halved text-emerald-600"></i>
            <span>
              Siparişi onaylayarak iletişim ve adres bilgilerinizin <strong>6698 sayılı KVKK</strong> kapsamında yalnızca sipariş teslimatı amacıyla işlenmesini kabul etmiş olursunuz.
            </span>
          </p>

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
              disabled={isSubmitting || orderPause.paused}
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
                disabled={isSubmitting || orderPause.paused}
                onClick={(e) => handleSubmitOrder(e, true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-emerald-600/20 text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
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
