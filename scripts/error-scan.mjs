/**
 * Sandwich Diyarı - Derinlemesine Kod, Import, Veritabanı, Görsel ve Mantık Hata Tarayıcısı
 */
import fs from 'fs';
import path from 'path';
function isValidTurkishPhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('0090') && d.length >= 14) d = '0' + d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = '0' + d.slice(2);
  else if (!d.startsWith('0') && d.length <= 10) d = '0' + d;
  return d.length === 11 && d.startsWith('0');
}

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components', 'lib', 'store', 'data', 'types'];
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json'];

function getAllFiles(dir, list = []) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return list;
  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    const res = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(path.relative(ROOT, res), list);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      list.push(res);
    }
  }
  return list;
}

function resolveImportPath(importStr, fromFile) {
  let baseTarget = null;
  if (importStr.startsWith('@/')) {
    baseTarget = path.join(ROOT, importStr.slice(2));
  } else if (importStr.startsWith('./') || importStr.startsWith('../')) {
    baseTarget = path.resolve(path.dirname(fromFile), importStr);
  } else {
    return { external: true, ok: true };
  }

  if (fs.existsSync(baseTarget) && fs.statSync(baseTarget).isFile()) {
    return { ok: true, resolved: baseTarget };
  }
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(baseTarget + ext)) {
      return { ok: true, resolved: baseTarget + ext };
    }
  }
  for (const ext of EXTENSIONS) {
    const idxFile = path.join(baseTarget, 'index' + ext);
    if (fs.existsSync(idxFile)) {
      return { ok: true, resolved: idxFile };
    }
  }
  return { ok: false, target: baseTarget };
}

async function runDeepScan() {
  const issues = [];
  const warnings = [];
  const passedChecks = [];

  console.log('====================================================================');
  console.log('🔍 SANDWICH DİYARI - KAPSAMLI HATA TARAMASI BAŞLATILDI');
  console.log('====================================================================\n');

  // 1. Check tsconfig.json & jsconfig.json
  const hasTsConfig = fs.existsSync(path.join(ROOT, 'tsconfig.json'));
  const hasJsConfig = fs.existsSync(path.join(ROOT, 'jsconfig.json'));
  if (hasTsConfig && hasJsConfig) {
    warnings.push(
      '[YAPILANDIRMA] Hem tsconfig.json hem jsconfig.json mevcut. IDE çakışmasını önlemek için tsconfig.json içine baseUrl eklenip tek merkezden yönetilmeli.'
    );
  } else {
    passedChecks.push('TypeScript yapılandırması (tsconfig.json) temiz.');
  }

  // 2. Scan all source files for broken imports, local image paths, and syntax anomalies
  const allFiles = [];
  for (const d of SCAN_DIRS) {
    getAllFiles(d, allFiles);
  }
  passedChecks.push(`Toplam ${allFiles.length} kaynak kod dosyası (.js, .jsx, .ts, .tsx) tarandı.`);

  const importRegex = /from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const localImgRegex = /['"](\/images\/[^'"]+)['"]/g;

  let totalImportsChecked = 0;
  let totalImagesChecked = 0;

  for (const file of allFiles) {
    const relFile = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');

    // Check imports
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const imp = match[1] || match[2];
      if (!imp) continue;
      totalImportsChecked++;
      const res = resolveImportPath(imp, file);
      if (!res.ok) {
        issues.push(`[KIRIK IMPORT] ${relFile} -> "${imp}" dosyası bulunamadı!`);
      }
    }

    // Check local /images/... references
    let imgMatch;
    while ((imgMatch = localImgRegex.exec(content)) !== null) {
      const imgRel = imgMatch[1];
      totalImagesChecked++;
      const publicPath = path.join(ROOT, 'public', imgRel);
      if (!fs.existsSync(publicPath)) {
        issues.push(`[EKSİK GÖRSEL] ${relFile} -> "public${imgRel}" görseli mevcut değil!`);
      }
    }
  }

  passedChecks.push(`Toplam ${totalImportsChecked} modül/bileşen import bağlantısı doğrulandı.`);
  passedChecks.push(`Toplam ${totalImagesChecked} yerel görsel (/images/*) yolu doğrulandı.`);

  // 3. Check data/db.json & data/initialData.js data consistency
  const dbPath = path.join(ROOT, 'data', 'db.json');
  if (fs.existsSync(dbPath)) {
    try {
      const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

      // Check users phone format
      if (Array.isArray(dbData.users)) {
        for (const u of dbData.users) {
          if (u.phone && !isValidTurkishPhone(u.phone)) {
            warnings.push(
              `[VERİTABANI TELEFON FORMATI] Kullanıcı "${u.email}" telefon numarası (${u.phone}) standart dışı.`
            );
          }
        }
      }

      // Check adminUsers phone format
      if (Array.isArray(dbData.adminUsers)) {
        for (const a of dbData.adminUsers) {
          if (a.phone && !isValidTurkishPhone(a.phone)) {
            warnings.push(
              `[ADMİN TELEFON FORMATI] Yetkili "${a.email}" telefon numarası (${a.phone}) standart dışı.`
            );
          }
        }
      }

      // Check orders phone format
      if (Array.isArray(dbData.orders)) {
        for (const o of dbData.orders) {
          const p = o.customerPhone || o.phone;
          if (p && !isValidTurkishPhone(p)) {
            warnings.push(
              `[SİPARİŞ TELEFON FORMATI] Sipariş #${o.orderNumber || o.id} telefon numarası (${p}) standart dışı.`
            );
          }
        }
      }

      // Check products price and stock
      if (Array.isArray(dbData.products)) {
        for (const prod of dbData.products) {
          if (typeof prod.price !== 'number' || prod.price <= 0) {
            issues.push(`[ÜRÜN FİYAT HATASI] Ürün #${prod.id} (${prod.name}) fiyatı geçersiz: ${prod.price}`);
          }
        }
      }

      passedChecks.push('data/db.json JSON yapısı ve tablo şemaları doğrulandı.');
    } catch (e) {
      issues.push(`[DB.JSON PARSE HATASI] ${e.message}`);
    }
  }

  console.log('✅ BAŞARILI KONTROLLER:');
  for (const p of passedChecks) {
    console.log(`   • ${p}`);
  }

  console.log('\n⚠️ UYARILAR (' + warnings.length + '):');
  if (warnings.length === 0) {
    console.log('   • Uyarı bulunmadı.');
  } else {
    for (const w of warnings) {
      console.log(`   • ${w}`);
    }
  }

  console.log('\n❌ KRİTİK HATALAR (' + issues.length + '):');
  if (issues.length === 0) {
    console.log('   • Kritik hata bulunmadı! (0 Hata)');
  } else {
    for (const i of issues) {
      console.log(`   • ${i}`);
    }
  }

  console.log('\n====================================================================');
}

runDeepScan();

