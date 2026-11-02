/**
 * Sandwich Diyarı - PostgreSQL 18 Otomatik Kurulum, Şema ve Canlı Veri Aktarım Aracı
 * Şifre: admin | Port: 5432 | Veritabanı: sandwich_diyari
 */
import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';

const PG_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const POSTGRES_EXE = path.join(PG_BIN, 'postgres.exe');
const PG_CTL = path.join(PG_BIN, 'pg_ctl.exe');
const PSQL = path.join(PG_BIN, 'psql.exe');
const PG_DATA = path.join(process.cwd(), '.pgdata');
const SCHEMA_FILE = path.join(process.cwd(), 'database', 'postgresql_schema.sql');
const DB_JSON = path.join(process.cwd(), 'data', 'db.json');

const env = {
  ...process.env,
  PGPASSWORD: 'admin',
  PGCLIENTENCODING: 'UTF8'
};

function sqlEscape(val) {
  if (val === null || typeof val === 'undefined') return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function runPsql(dbName, args) {
  return execFileSync(PSQL, ['-h', '127.0.0.1', '-p', '5432', '-U', 'postgres', '-d', dbName, ...args], {
    env,
    encoding: 'utf8'
  });
}

async function main() {
  console.log('====================================================================');
  console.log('🐘 POSTGRESQL 18 MOTORU BAŞLATILIYOR & ŞEMA KURULUYOR');
  console.log('====================================================================\n');

  // Remove temporary password file if present
  const tempPass = path.join(process.cwd(), '.pgpass_init.txt');
  if (fs.existsSync(tempPass)) {
    fs.unlinkSync(tempPass);
  }

  // Remove any log file accidentally placed inside .pgdata
  const badLog = path.join(PG_DATA, 'postgres.log');
  if (fs.existsSync(badLog)) {
    try {
      fs.unlinkSync(badLog);
    } catch {}
  }

  // 1. Check / Start PostgreSQL 18 cluster
  let isRunning = false;
  try {
    const statusOut = execFileSync(PG_CTL, ['-D', PG_DATA, 'status'], { env, encoding: 'utf8' });
    if (statusOut.includes('PID')) {
      isRunning = true;
      console.log('✅ PostgreSQL 18 servisi zaten çalışıyor (127.0.0.1:5432).');
    }
  } catch {
    isRunning = false;
  }

  if (!isRunning) {
    console.log('🚀 PostgreSQL 18 sunucusu başlatılıyor (127.0.0.1:5432)...');
    const child = spawn(POSTGRES_EXE, ['-D', PG_DATA], {
      env,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();

    // Wait up to 8 seconds for PostgreSQL 18 to accept connections
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        runPsql('postgres', ['-c', 'SELECT 1;']);
        isRunning = true;
        break;
      } catch {
        // still starting
      }
    }
    if (!isRunning) {
      throw new Error('PostgreSQL 18 sunucusu 8 saniye içinde bağlantıyı kabul etmedi.');
    }
    console.log('✅ PostgreSQL 18 sunucusu başarıyla başlatıldı!');
  }

  // 2. Verify Version
  const ver = runPsql('postgres', ['-t', '-A', '-c', 'SELECT version();']).trim();
  console.log(`📌 Sunucu Sürümü: ${ver}`);

  // 3. Create sandwich_diyari database if not exists
  const exists = runPsql('postgres', [
    '-t',
    '-A',
    '-c',
    "SELECT 1 FROM pg_database WHERE datname = 'sandwich_diyari';"
  ]).trim();

  if (exists !== '1') {
    console.log('📦 "sandwich_diyari" veritabanı oluşturuluyor...');
    runPsql('postgres', ['-c', "CREATE DATABASE sandwich_diyari WITH ENCODING 'UTF8' TEMPLATE template0;"]);
    console.log('✅ "sandwich_diyari" veritabanı oluşturuldu.');
  } else {
    console.log('✅ "sandwich_diyari" veritabanı mevcut.');
  }

  // 4. Apply DDL Schema (postgresql_schema.sql)
  console.log('📜 Tablolar, JSONB GIN İndeksler ve Triggerlar uygulanıyor...');
  runPsql('sandwich_diyari', ['-f', SCHEMA_FILE]);
  console.log('✅ Şema (11 Tablo + İndeksler) başarıyla kuruldu.');

  // 5. Seed Live Data from data/db.json into PostgreSQL 18
  if (fs.existsSync(DB_JSON)) {
    console.log('🔄 data/db.json verileri PostgreSQL 18 tablolarına aktarılıyor...');
    const dbData = JSON.parse(fs.readFileSync(DB_JSON, 'utf8'));
    const seedLines = ['BEGIN;'];

    // Roles
    if (Array.isArray(dbData.roles)) {
      for (const r of dbData.roles) {
        seedLines.push(
          `INSERT INTO "roles" ("id", "name", "code", "color", "description", "is_system", "permissions") VALUES (${sqlEscape(
            r.id
          )}, ${sqlEscape(r.name)}, ${sqlEscape(r.code)}, ${sqlEscape(r.color || 'blue')}, ${sqlEscape(
            r.description || ''
          )}, ${sqlEscape(Boolean(r.isSystem))}, ${sqlEscape(
            JSON.stringify(r.permissions || [])
          )}::jsonb) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "permissions" = EXCLUDED."permissions";`
        );
      }
    }

    // Admin Users
    if (Array.isArray(dbData.adminUsers)) {
      for (const a of dbData.adminUsers) {
        seedLines.push(
          `INSERT INTO "admin_users" ("id", "name", "email", "phone", "pass_hash", "role_id", "role_name", "is_active") VALUES (${sqlEscape(
            a.id
          )}, ${sqlEscape(a.name)}, ${sqlEscape(a.email)}, ${sqlEscape(a.phone || '')}, ${sqlEscape(
            a.pass || 'admin123'
          )}, ${sqlEscape(a.roleId || 'role_super_admin')}, ${sqlEscape(
            a.roleName || 'Süper Yönetici'
          )}, ${sqlEscape(a.isActive !== false)}) ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "phone" = EXCLUDED."phone", "role_id" = EXCLUDED."role_id";`
        );
      }
    }

    // Customers / Users
    if (Array.isArray(dbData.users)) {
      for (const u of dbData.users) {
        seedLines.push(
          `INSERT INTO "users" ("id", "name", "email", "phone", "address", "pass_hash") VALUES (${sqlEscape(
            u.id
          )}, ${sqlEscape(u.name)}, ${sqlEscape(u.email)}, ${sqlEscape(u.phone || '')}, ${sqlEscape(
            u.address || ''
          )}, ${sqlEscape(u.pass || '')}) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "phone" = EXCLUDED."phone", "address" = EXCLUDED."address";`
        );
      }
    }

    // Products
    if (Array.isArray(dbData.products)) {
      for (const p of dbData.products) {
        const desc = p.description || p.desc || 'Özel şef sandviçimiz.';
        seedLines.push(
          `INSERT INTO "products" ("id", "name", "desc", "price", "category", "badge", "image", "calories", "prep_time", "rating", "stock", "track_stock", "is_available", "critical_threshold", "options", "recipe") VALUES (${Number(
            p.id
          )}, ${sqlEscape(p.name)}, ${sqlEscape(desc)}, ${Number(p.price || 100)}, ${sqlEscape(
            p.category || 'sandwich'
          )}, ${sqlEscape(p.badge || null)}, ${sqlEscape(p.image || '')}, ${sqlEscape(
            p.calories || null
          )}, ${sqlEscape(p.prepTime || null)}, ${Number(p.rating || 4.8)}, ${Math.max(
            0,
            Number(p.stock ?? 25)
          )}, ${sqlEscape(p.trackStock !== false)}, ${sqlEscape(p.isAvailable !== false)}, ${Number(
            p.criticalThreshold ?? 5
          )}, ${sqlEscape(JSON.stringify(p.options || []))}::jsonb, ${sqlEscape(
            JSON.stringify(p.recipe || [])
          )}::jsonb) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "price" = EXCLUDED."price", "stock" = EXCLUDED."stock", "is_available" = EXCLUDED."is_available";`
        );
      }
      seedLines.push(`SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM "products"), 1));`);
    }

    // Reviews
    if (Array.isArray(dbData.reviews)) {
      dbData.reviews.forEach((rev, idx) => {
        const revId = Number(rev.id) > 0 && Number(rev.id) < 1000000 ? Number(rev.id) : idx + 1;
        seedLines.push(
          `INSERT INTO "reviews" ("id", "name", "initials", "location", "rating", "comment") VALUES (${revId}, ${sqlEscape(
            rev.name
          )}, ${sqlEscape(rev.initials || 'SD')}, ${sqlEscape(rev.location || 'Torbalı, İzmir')}, ${Number(
            rev.rating || 5
          )}, ${sqlEscape(rev.comment)}) ON CONFLICT ("id") DO UPDATE SET "comment" = EXCLUDED."comment";`
        );
      });
      seedLines.push(`SELECT setval('reviews_id_seq', COALESCE((SELECT MAX(id) FROM "reviews"), 1));`);
    }

    // Orders
    if (Array.isArray(dbData.orders)) {
      for (const o of dbData.orders) {
        const orderId = String(o.id || o.orderNumber);
        const orderNo = String(o.orderNumber || o.id);
        seedLines.push(
          `INSERT INTO "orders" ("id", "order_number", "customer_name", "customer_phone", "customer_address", "order_note", "payment_method", "payment_status", "subtotal", "delivery_fee", "total", "user_email", "status", "is_viewed", "date_label") VALUES (${sqlEscape(
            orderId
          )}, ${sqlEscape(orderNo)}, ${sqlEscape(o.customerName || 'Müşteri')}, ${sqlEscape(
            o.customerPhone || o.phone || ''
          )}, ${sqlEscape(o.customerAddress || o.address || '')}, ${sqlEscape(
            o.orderNote || o.notes || null
          )}, ${sqlEscape(o.paymentMethod || 'Kapıda Nakit')}, ${sqlEscape(
            o.paymentStatus || 'Bekleniyor'
          )}, ${Number(o.subtotal || o.total || 0)}, ${Number(o.deliveryFee || 0)}, ${Number(
            o.total || 0
          )}, ${sqlEscape(o.userEmail || null)}, ${sqlEscape(o.status || 'Yeni')}, ${sqlEscape(
            Boolean(o.isViewed)
          )}, ${sqlEscape(o.date || '01.11.2026')}) ON CONFLICT ("id") DO NOTHING;`
        );
      }
    }

    seedLines.push('COMMIT;');
    const seedFile = path.join(process.cwd(), 'database', 'seed_temp.sql');
    fs.writeFileSync(seedFile, seedLines.join('\n'), 'utf8');
    runPsql('sandwich_diyari', ['-f', seedFile]);
    fs.unlinkSync(seedFile);
  }

  // 6. Query Live Counts from PostgreSQL 18
  const summarySql = `
    SELECT
      (SELECT COUNT(*) FROM "products") AS products,
      (SELECT COUNT(*) FROM "users") AS users,
      (SELECT COUNT(*) FROM "admin_users") AS admin_users,
      (SELECT COUNT(*) FROM "roles") AS roles,
      (SELECT COUNT(*) FROM "orders") AS orders,
      (SELECT COUNT(*) FROM "reviews") AS reviews;
  `;
  const counts = runPsql('sandwich_diyari', ['-t', '-A', '-F', '|', '-c', summarySql]).trim().split('|');

  console.log('\n====================================================================');
  console.log('🎉 POSTGRESQL 18 CANLI TABLO DURUMU (127.0.0.1:5432/sandwich_diyari)');
  console.log('====================================================================');
  console.log(`   • Ürünler (products)        : ${counts[0]} kayıt`);
  console.log(`   • Müşteriler (users)        : ${counts[1]} kayıt`);
  console.log(`   • Yetkililer (admin_users)  : ${counts[2]} kayıt`);
  console.log(`   • Roller (roles)            : ${counts[3]} kayıt`);
  console.log(`   • Siparişler (orders)       : ${counts[4]} kayıt`);
  console.log(`   • Yorumlar (reviews)        : ${counts[5]} kayıt`);
  console.log('====================================================================\n');
}

main().catch((err) => {
  console.error('❌ HATA:', err.message);
  process.exit(1);
});
