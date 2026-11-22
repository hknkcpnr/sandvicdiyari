import { spawn } from 'child_process';
import http from 'http';

const TEST_PORT = 3005;
const TEST_URL = `http://127.0.0.1:${TEST_PORT}`;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Sunucu ${url} adresinde dinlemeye başlayamadı (zaman aşımı).`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

async function run() {
  console.log(`🚀 Next.js üretim sunucusu (Port: ${TEST_PORT}) başlatılıyor...`);
  
  const server = spawn('node', ['./node_modules/next/dist/bin/next', 'start', '-p', String(TEST_PORT)], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'production' }
  });

  try {
    console.log(`⏳ Sunucunun ${TEST_PORT} portunda hazır olması bekleniyor...`);
    await waitForServer(TEST_URL, 25000);
    console.log(`✅ Sunucu hazır (${TEST_URL})! Yük ve stres testi başlatılıyor...\n`);

    // Testi çalıştır
    await new Promise((resolve, reject) => {
      const tester = spawn('node', ['scripts/load-test.mjs'], {
        stdio: 'inherit',
        env: { ...process.env, TEST_BASE_URL: TEST_URL }
      });
      tester.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Test süreci hata koduyla bitti: ${code}`));
      });
    });
  } catch (err) {
    console.error('Yük testi hatası:', err.message);
  } finally {
    console.log('\n🛑 Test tamamlandı. Sunucu temiz şekilde durduruluyor...');
    try {
      server.kill('SIGTERM');
      setTimeout(() => {
        try { server.kill('SIGKILL'); } catch {}
      }, 1000);
    } catch {}
  }
}

run();
