'use client';

import { useDispatch, useSelector } from 'react-redux';
import { openOptionsModal, openAuthModal } from '@/store/slices/uiSlice';
import { campaignProducts } from '@/data/initialData';

export default function KampanyalarPage() {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);

  const handleCampaignOrderClick = (menu) => {
    if (!currentUser || !currentUser.email) {
      dispatch(openAuthModal('login'));
      return;
    }
    dispatch(openOptionsModal(menu));
  };

  return (
    <div id="page-kampanyalar" className="page-content animate-in fade-in duration-300">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
            Avantajlı Menü Paketleri
          </span>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-stone-900">
            Doyurucu Menü Fırsatları
          </h3>
          <p className="text-stone-500 text-sm">
            Sandviç, patates kızartması ve soğuk içecek bir arada! Hem lezzetli hem ekonomik menü seçenekleri.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {campaignProducts.map((menu) => {
            const savings = menu.oldPrice ? Math.round(menu.oldPrice - menu.price) : 0;
            return (
              <div
                key={menu.id}
                className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden mb-4 bg-stone-100">
                    <img
                      src={menu.image}
                      alt={menu.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800';
                      }}
                    />
                    <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-md text-stone-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                      {menu.badge}
                    </span>
                    {savings > 0 && (
                      <span className="absolute top-3 right-3 bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
                        -₺{savings} İndirim
                      </span>
                    )}
                  </div>

                  <h4 className="font-extrabold text-lg text-stone-900 group-hover:text-brand-600 transition-colors leading-snug">
                    {menu.name}
                  </h4>
                  <p className="text-stone-500 text-xs mt-2 leading-relaxed">
                    {menu.description}
                  </p>
                </div>

                <div className="pt-4 mt-5 border-t border-stone-100 flex items-center justify-between gap-2">
                  <div>
                    {menu.oldPrice && (
                      <span className="text-xs text-stone-400 line-through block font-medium">
                        ₺{menu.oldPrice.toFixed(2)}
                      </span>
                    )}
                    <span className="text-xl font-extrabold text-brand-600">
                      ₺{menu.price.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCampaignOrderClick(menu)}
                    className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-brand-500/20 transition-all text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <i className={`fa-solid ${currentUser ? 'fa-plus' : 'fa-user-lock'}`}></i> Sepete Ekle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
