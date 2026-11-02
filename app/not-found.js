import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-900 text-white p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center text-3xl mb-4 border border-brand-500/30">
        <i className="fa-solid fa-burger"></i>
      </div>
      <h2 className="text-3xl font-extrabold mb-2">404 - Sayfa Bulunamadı</h2>
      <p className="text-stone-400 text-sm max-w-md mb-6">
        Aradığınız lezzet veya sayfa mevcut değil ya da taşınmış olabilir.
      </p>
      <Link
        href="/"
        className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-xl transition-all text-xs"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
