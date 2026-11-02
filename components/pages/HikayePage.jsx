'use client';

export default function HikayePage() {
  return (
    <div id="page-hikaye" className="page-content animate-in fade-in duration-300">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
              Torbalı / İzmir • Biz Kimiz?
            </span>
            <h3 className="text-3xl font-extrabold text-stone-900 leading-tight">
              Sandviç Diyarı: Torbalı'nın Gece 03:00'e Kadar Sıcak Lezzet Durağı
            </h3>
            <p className="text-stone-600 leading-relaxed text-sm">
              İzmir Torbalı Mahallesi Hüseyin Kurtuldu Sokak'ta hizmet veren Sandviç Diyarı olarak, enfes çıtır ekmeklerimizi zengin şarküteri, hakiki kasap köftesi ve taze malzemelerle buluşturuyoruz. Sabah 10:00'dan Gece 03:00'e kadar Torbalı'daki ev ve iş yerlerine hızlı paket servisimizle sıcak lezzetleri kapınıza getiriyoruz.
            </p>
            <div className="bg-brand-50/70 border border-brand-200 rounded-2xl p-4 text-xs text-stone-700 leading-relaxed flex items-start gap-3">
              <i className="fa-solid fa-stamp text-brand-600 text-xl mt-0.5"></i>
              <div>
                <strong className="text-brand-900 block font-bold mb-1">Gıda Güvenliği & Kalite Standartlarımız</strong>
                Türk Gıda Kodeksi'nin yürürlüğe giren Et ve Et Ürünleri Tebliği'ne uygun olarak üretilen ürünleri titizlikle kullanmaktayız.
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm text-center">
                <span className="text-brand-600 font-extrabold text-xl block">Gece 03:00</span>
                <span className="text-[11px] text-stone-500 font-medium">Paket Servis</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm text-center">
                <span className="text-brand-600 font-extrabold text-xl block">VISA / MC</span>
                <span className="text-[11px] text-stone-500 font-medium">Kapıda Kart</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm text-center">
                <span className="text-brand-600 font-extrabold text-xl block">40+ Çeşit</span>
                <span className="text-[11px] text-stone-500 font-medium">Zengin Menü</span>
              </div>
            </div>
          </div>
          <div className="relative">
            <img
              src="/images/kasap_sucuk_ekmek.jpg"
              alt="Sandviç Diyarı Hazırlık"
              className="rounded-3xl shadow-xl w-full object-cover h-[400px]"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

