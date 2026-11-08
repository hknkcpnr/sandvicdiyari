'use client';

export default function AdminPagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 6,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 6, 10, 20, 50],
  itemLabel = 'kayıt',
}) {
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, totalItems);

  // Build visible page numbers with ellipsis if needed
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);

    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) {
      pages.push(i);
    }
    if (right < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="bg-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-stone-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-poppins">
      {/* Left: Range Info & Page Size Selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full sm:w-auto text-stone-500">
        <span>
          Toplam <strong className="font-extrabold text-stone-900">{totalItems}</strong> {itemLabel}tan{' '}
          <strong className="font-extrabold text-stone-900">
            {startIdx}&ndash;{endIdx}
          </strong>{' '}
          arası gösteriliyor
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-400 font-semibold">Sayfa başı:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                if (onPageChange) onPageChange(1);
              }}
              aria-label="Sayfa başına gösterilecek kayıt sayısı"
              className="app-select bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-brand-400 text-stone-800 font-bold text-xs rounded-xl pl-2.5 pr-7 py-1 cursor-pointer focus:outline-none"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} {itemLabel}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Controls */}
      <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="h-8 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Önceki Sayfa"
        >
          <i className="fa-solid fa-chevron-left text-[10px]"></i>
          <span className="hidden xs:inline">Önceki</span>
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) =>
            p === '...' ? (
              <span
                key={`ellipsis-${idx}`}
                className="w-7 h-8 flex items-center justify-center text-stone-400 font-bold select-none"
              >
                &hellip;
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange && onPageChange(p)}
                className={`min-w-[32px] h-8 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  p === safePage
                    ? 'bg-gradient-to-r from-stone-900 to-stone-800 text-white shadow-xs ring-2 ring-stone-900/15'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200/80'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange && onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="h-8 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Sonraki Sayfa"
        >
          <span className="hidden xs:inline">Sonraki</span>
          <i className="fa-solid fa-chevron-right text-[10px]"></i>
        </button>
      </div>
    </div>
  );
}

