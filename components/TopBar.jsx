'use client';

import { useState, useEffect } from 'react';
import { getRestaurantStatus } from '@/lib/openingHours';

export default function TopBar() {
  const [status, setStatus] = useState(getRestaurantStatus());
  const [contact, setContact] = useState({
    phone1: '0552 104 55 35',
    phone2: '0232 856 81 21',
    visible: true,
  });

  const loadContact = () => {
    fetch('/api/site-content')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data?.contactBar) {
          setContact(res.data.contactBar);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadContact();
    const handleStorage = (e) => {
      if (e.key === 'sandwich_site_content_updated') loadContact();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(getRestaurantStatus());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  if (contact.visible === false) return null;

  return (
    <div className="hidden md:block bg-stone-900 text-stone-300 text-xs py-2 px-4 border-b border-stone-800">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1.5">
        <div className="flex items-center gap-3.5 flex-wrap justify-center sm:justify-start">
          {/* Live Open / Closed Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              status.isOpen
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${status.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            <span>{status.isOpen ? 'Siparişe Açık (25-35 dk)' : 'Şu an Kapalı (10:00 Açılış)'}</span>
          </span>

          {contact.phone2 && (
            <>
              <span className="text-stone-700 hidden sm:inline">&bull;</span>
              {status.isOpen ? (
                <a
                  href={`tel:${contact.phone2.replace(/\s+/g, '')}`}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                  title="Sabit Hat"
                >
                  <i className="fa-solid fa-phone text-brand-500"></i>
                  <span>{contact.phone2}</span>
                </a>
              ) : (
                <span
                  className="text-stone-500 flex items-center gap-1.5 cursor-not-allowed opacity-60"
                  title="Restoranımız saat 03:00 - 10:00 arası kapalıdır"
                >
                  <i className="fa-solid fa-phone text-stone-600"></i>
                  <span className="line-through">{contact.phone2}</span>
                  <span className="text-[10px] text-stone-500">(Kapalı)</span>
                </span>
              )}
            </>
          )}

          {contact.phone1 && (
            <>
              <span className="text-stone-700 hidden sm:inline">&bull;</span>
              {status.isOpen ? (
                <a
                  href={`tel:${contact.phone1.replace(/\s+/g, '')}`}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                  title="Alo Paket Cep"
                >
                  <i className="fa-solid fa-mobile-screen text-brand-500"></i>
                  <span className="font-semibold text-white">{contact.phone1}</span>
                </a>
              ) : (
                <span
                  className="text-stone-500 flex items-center gap-1.5 cursor-not-allowed opacity-60"
                  title="Restoranımız saat 03:00 - 10:00 arası kapalıdır"
                >
                  <i className="fa-solid fa-mobile-screen text-stone-600"></i>
                  <span className="font-semibold text-stone-500 line-through">{contact.phone1}</span>
                  <span className="text-[10px] text-stone-500">(Kapalı)</span>
                </span>
              )}
            </>
          )}

          <span className="text-stone-700 hidden sm:inline">&bull;</span>
          {status.isOpen ? (
            <a
              href={`https://wa.me/90${(contact.phone1 || '05521045535').replace(/[^0-9]/g, '').replace(/^0/, '')}?text=Merhaba,%20Sandviç%20Diyarı'ndan%20sipariş%20vermek%20istiyorum`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 font-semibold"
              title="WhatsApp Sipariş Hattı"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i>
              <span>WhatsApp Sipariş</span>
            </a>
          ) : (
            <span
              className="text-stone-500 flex items-center gap-1.5 cursor-not-allowed opacity-60"
              title="Saat 03:00 - 10:00 arasında WhatsApp sipariş hattı kapalıdır"
            >
              <i className="fa-brands fa-whatsapp text-sm text-stone-600"></i>
              <span>WhatsApp (03:00 - 10:00 Kapalı)</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-brand-400 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-motorcycle text-brand-500"></i>
            <span>Torbalı / İzmir &bull; Gece 03:00&apos;e Kadar Paket Servis!</span>
          </span>
        </div>
      </div>
    </div>
  );
}
