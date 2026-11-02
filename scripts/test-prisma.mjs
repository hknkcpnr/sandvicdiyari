/**
 * Sandwich Diyarı - Canlı @prisma/client & PostgreSQL 18.6 Doğrulama Testi
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPrismaLive() {
  console.log('====================================================================');
  console.log('💎 PRISMA ORM (v6.4.1) & POSTGRESQL 18.6 CANLI BAĞLANTI TESTİ');
  console.log('====================================================================\n');

  await prisma.$connect();
  console.log('✅ PrismaClient.$connect() -> PostgreSQL 18.6 (127.0.0.1:5432) bağlantısı başarılı!');

  const [productCount, userCount, roleCount, adminCount, orderCount, reviewCount] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.role.count(),
    prisma.adminUser.count(),
    prisma.order.count(),
    prisma.review.count()
  ]);

  const sampleProducts = await prisma.product.findMany({
    take: 3,
    orderBy: { id: 'asc' },
    select: { id: true, name: true, price: true, category: true, stock: true }
  });

  const roles = await prisma.role.findMany({
    select: { code: true, name: true }
  });

  console.log(`📦 prisma.product.count()    : ${productCount} ürün`);
  console.log(`👤 prisma.user.count()       : ${userCount} üye müşteri`);
  console.log(`🛡️ prisma.role.count()       : ${roleCount} RBAC rol modeli (${roles.map((r) => r.code).join(', ')})`);
  console.log(`👨‍💼 prisma.adminUser.count()  : ${adminCount} yetkili personel`);
  console.log(`🧾 prisma.order.count()      : ${orderCount} sipariş`);
  console.log(`⭐ prisma.review.count()     : ${reviewCount} değerlendirme\n`);

  console.log('🔍 Örnek Prisma Ürün Sorgusu (prisma.product.findMany):');
  for (const p of sampleProducts) {
    console.log(`   • #${p.id} ${p.name} — ₺${Number(p.price).toFixed(2)} (Stok: ${p.stock})`);
  }

  await prisma.$disconnect();
  console.log('\n====================================================================');
  console.log('🎉 PRISMA ORM + POSTGRESQL 18.6 %100 AKTİF VE DOĞRULANDI!');
  console.log('====================================================================');
}

verifyPrismaLive().catch(async (err) => {
  console.error('❌ Prisma Bağlantı Hatası:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});

