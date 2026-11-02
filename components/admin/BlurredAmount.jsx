'use client';

/**
 * ============================================================================
 * BlurredAmount: Finansal Gizlilik & Ciro Koruma Bileşeni
 * ============================================================================
 * Yalnızca Süper Admin ve 'view_revenue' iznine sahip personellerin net
 * görebildiği, diğer kullanıcılarda ise bulanık (blur) ve kilitli görünen bileşen.
 */
export default function BlurredAmount({
  amount,
  canView = false,
  className = '',
  placeholder = '₺•••,••',
  blurClass = 'blur-[5px]'
}) {
  if (canView) {
    return <span className={className}>{amount}</span>;
  }

  return (
    <span
      className={`relative inline-flex items-center gap-1 select-none cursor-not-allowed group ${className}`}
      title="Ciro ve ücret bilgisi gizlidir. Bu veriyi yalnızca yönetici izni olan yetkililer görebilir."
    >
      <span className={`filter ${blurClass} select-none pointer-events-none opacity-60 font-mono tracking-wider transition-all`}>
        {amount || placeholder}
      </span>
      <span className="text-[10px] text-stone-400 group-hover:text-amber-600 transition-colors inline-flex items-center shrink-0">
        <i className="fa-solid fa-lock text-[9px] ml-0.5"></i>
      </span>
    </span>
  );
}

