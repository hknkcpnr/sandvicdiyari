'use client';

import { useState, useEffect, useRef } from 'react';
import { getRestaurantStatus } from '@/lib/openingHours';

export default function DraggableContactButton() {
  const [position, setPosition] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState(getRestaurantStatus());
  const [contact, setContact] = useState({
    phone1: '0552 104 55 35',
    phone2: '0232 856 81 21',
  });

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  // Ekran boyutuna göre başlangıç konumu (Sağ alt, parmak hizası - 50x50 buton)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const defaultX = Math.max(12, window.innerWidth - 64);
      const defaultY = Math.max(100, window.innerHeight - 130);
      setPosition({ x: defaultX, y: defaultY });

      const handleResize = () => {
        setPosition((prev) => {
          if (!prev) return { x: defaultX, y: defaultY };
          return {
            x: Math.min(prev.x, window.innerWidth - 60),
            y: Math.min(prev.y, window.innerHeight - 66),
          };
        });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // İletişim verisini yükle
  useEffect(() => {
    fetch('/api/site-content')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data?.contactBar) {
          setContact(res.data.contactBar);
        }
      })
      .catch(() => {});
  }, []);

  // Restoran açık/kapalı durumu periyodik güncelle
  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(getRestaurantStatus());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Dokunmatik / Pointer Sürükleme Mantığı
  const handlePointerDown = (e) => {
    // Sadece sol tık veya tek parmak dokunuşu
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position?.x ?? 0,
      initialY: position?.y ?? 0,
      hasMoved: false,
    };
    setIsDragging(true);

    const handlePointerMove = (moveEvent) => {
      const currentX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
      const currentY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (currentX === undefined || currentY === undefined) return;

      const dx = currentX - dragRef.current.startX;
      const dy = currentY - dragRef.current.startY;

      // 6px tolerans - tık ile sürüklemeyi ayırt et
      if (!dragRef.current.hasMoved && Math.hypot(dx, dy) > 6) {
        dragRef.current.hasMoved = true;
        setIsOpen(false); // Sürüklenirken menüyü kapat
      }

      if (dragRef.current.hasMoved) {
        const nextX = Math.max(10, Math.min(window.innerWidth - 60, dragRef.current.initialX + dx));
        const nextY = Math.max(64, Math.min(window.innerHeight - 66, dragRef.current.initialY + dy));
        setPosition({ x: nextX, y: nextY });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);

      // Eğer sürüklenmediyse, butona tıklanmış demektir (menüyü aç/kapat)
      if (!dragRef.current.hasMoved) {
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);
  };

  if (!position) return null;

  const phone1Raw = (contact.phone1 || '0552 104 55 35').replace(/\s+/g, '');
  const phone2Raw = (contact.phone2 || '0232 856 81 21').replace(/\s+/g, '');
  const waPhone = phone1Raw.replace(/[^0-9]/g, '').replace(/^0/, '');
  const waUrl = `https://wa.me/90${waPhone}?text=${encodeURIComponent(
    "Merhaba Sandviç Diyarı, sipariş vermek istiyorum."
  )}`;

  // Menü konumu: buton ekranın alt yarısındaysa yukarı açılsın, üst yarısındaysa aşağı açılsın
  const isBottomHalf = position.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);
  const isRightHalf = position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 : 200);

  return (
    <div
      className="md:hidden fixed z-50 select-none touch-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
      }}
    >
      {/* SÜRÜKLENEBİLİR YUVARLAK BUTON (Kullanıcı İsteği: Tam 50x50 Boyut, Sade & Net) */}
      <div className="relative">
        <button
          type="button"
          onPointerDown={handlePointerDown}
          className={`relative w-[50px] h-[50px] rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 cursor-grab active:cursor-grabbing border-2 border-white ${
            isOpen
              ? 'bg-stone-900 shadow-stone-900/50 rotate-90'
              : 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-green-400 shadow-[0_8px_24px_rgba(16,185,129,0.5)]'
          } ${isDragging ? 'scale-105 shadow-emerald-500/80' : ''}`}
          aria-label="WhatsApp ve Telefon İletişim Butonu (Sürüklenebilir)"
          title="Sipariş & İletişim (Taşımak için basılı tutup sürükleyin)"
        >
          {isOpen ? (
            <i className="fa-solid fa-xmark text-xl"></i>
          ) : (
            <div className="relative flex items-center justify-center">
              {/* WhatsApp İkonu */}
              <i className="fa-brands fa-whatsapp text-[28px] drop-shadow-sm"></i>
              {/* Telefon İkon Rozeti (Büyütüldü & Yana Doğru Kaydırıldı) */}
              <span className="absolute -bottom-1 -right-2.5 w-6 h-6 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center text-[11px] text-stone-950 font-black shadow-md">
                <i className="fa-solid fa-phone"></i>
              </span>
            </div>
          )}
        </button>
      </div>

      {/* AÇILIR HIZLI ARAMA & WHATSAPP KARTI (Animasyonlu Açılış) */}
      {isOpen && (
        <div
          className={`absolute ${
            isBottomHalf ? 'bottom-16 origin-bottom' : 'top-16 origin-top'
          } ${
            isRightHalf ? 'right-0 origin-right' : 'left-0 origin-left'
          } w-72 bg-white rounded-3xl p-4 shadow-2xl border border-stone-200 animate-menu-pop z-50`}
        >
          {/* Kart Başlığı */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-100">
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Hızlı Sipariş &amp; İletişim
              </span>
              <h4 className="text-sm font-extrabold text-stone-900">Sandviç Diyarı Torbalı</h4>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                status.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {status.isOpen ? 'Açık' : 'Kapalı'}
            </span>
          </div>

          {/* İletişim Butonları */}
          <div className="space-y-2">
            {/* 1. WhatsApp Butonu */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0">
                <i className="fa-brands fa-whatsapp"></i>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block text-white font-extrabold text-xs">WhatsApp Sipariş Hattı</span>
                <span className="text-[11px] text-emerald-100 font-medium block truncate">
                  {contact.phone1 || '0552 104 55 35'}
                </span>
              </div>
              <i className="fa-solid fa-arrow-up-right-from-square text-xs text-white/80 pr-1"></i>
            </a>

            {/* 2. Alo Paket Cep Arama */}
            <a
              href={`tel:${phone1Raw}`}
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-black/10 flex items-center justify-center text-base shrink-0">
                <i className="fa-solid fa-phone-volume"></i>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block text-stone-950 font-extrabold text-xs">Alo Paket Cep (Hemen Ara)</span>
                <span className="text-[11px] text-stone-800 font-medium block truncate">
                  {contact.phone1 || '0552 104 55 35'}
                </span>
              </div>
              <i className="fa-solid fa-phone text-xs text-stone-900/60 pr-1"></i>
            </a>

            {/* 3. Sabit Hat */}
            {contact.phone2 && (
              <a
                href={`tel:${phone2Raw}`}
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-3 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold text-xs border border-stone-200 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-600 flex items-center justify-center text-xs shrink-0">
                  <i className="fa-solid fa-phone"></i>
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <span className="text-[10px] text-stone-400 block font-normal">Restoran Sabit Hat</span>
                  <span className="text-xs font-bold text-stone-800">{contact.phone2}</span>
                </div>
              </a>
            )}
          </div>

          {/* Alt Bilgi */}
          <div className="pt-2.5 mt-2.5 border-t border-stone-100 text-center">
            <span className="text-[10px] font-semibold text-stone-400 block">
              <i className="fa-solid fa-clock text-amber-500 mr-1"></i>
              Hergün 10:00 &ndash; Gece 03:00 Paket Servis
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

