import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { rawPrisma } from '@/lib/prisma';
import { assertProtectedApiAccess } from '@/lib/security/auth';
import { handleApiError } from '@/lib/security/errors';

export const dynamic = 'force-dynamic';

function getFolderSize(dirPath) {
  let size = 0;
  try {
    const list = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of list) {
      const full = path.join(dirPath, item.name);
      try {
        if (item.isDirectory()) {
          size += getFolderSize(full);
        } else if (item.isFile()) {
          size += fs.statSync(full).size;
        }
      } catch {}
    }
  } catch {}
  return size;
}

export async function GET(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/admin/storage' });
    const cwd = process.cwd();

    // 1. Disk usage via statfs
    let disk = null;
    try {
      const stat = fs.statfsSync(cwd);
      const totalBytes = Number(stat.blocks) * Number(stat.bsize);
      const freeBytes = Number(stat.bfree) * Number(stat.bsize);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      disk = {
        totalBytes,
        freeBytes,
        usedBytes,
        totalGB: (totalBytes / (1024 ** 3)).toFixed(2),
        freeGB: (freeBytes / (1024 ** 3)).toFixed(2),
        usedGB: (usedBytes / (1024 ** 3)).toFixed(2),
        usedPercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
      };
    } catch (e) {
      console.warn('statfs warning:', e.message);
    }

    // 2. Project directory breakdown
    const publicSize = getFolderSize(path.join(cwd, 'public'));
    const nextSize = getFolderSize(path.join(cwd, '.next'));
    const nodeModulesSize = getFolderSize(path.join(cwd, 'node_modules'));
    const uploadsSize = getFolderSize(path.join(cwd, 'public', 'uploads'));
    let dbJsonSize = 0;
    try {
      dbJsonSize = fs.statSync(path.join(cwd, 'data', 'db.json')).size;
    } catch {}

    const totalProjectBytes = publicSize + nextSize + nodeModulesSize + dbJsonSize;

    // 3. PostgreSQL database size via rawPrisma
    let database = {
      connected: false,
      sizeBytes: 0,
      sizePretty: '0 MB',
      counts: {
        orders: 0,
        products: 0,
        users: 0,
        settings: 0,
      }
    };

    try {
      if (rawPrisma) {
        const dbSizeResult = await rawPrisma.$queryRawUnsafe(
          'SELECT pg_database_size(current_database())::text as db_bytes, pg_size_pretty(pg_database_size(current_database())) as db_pretty'
        );
        if (Array.isArray(dbSizeResult) && dbSizeResult[0]) {
          database.connected = true;
          database.sizeBytes = Number(dbSizeResult[0].db_bytes || 0);
          database.sizePretty = String(dbSizeResult[0].db_pretty || '0 MB');
        }

        const [orderCount, productCount, userCount, settingCount] = await Promise.all([
          rawPrisma.order?.count?.().catch(() => 0) ?? 0,
          rawPrisma.product?.count?.().catch(() => 0) ?? 0,
          rawPrisma.user?.count?.().catch(() => 0) ?? 0,
          rawPrisma.systemSetting?.count?.().catch(() => 0) ?? 0,
        ]);

        database.counts = {
          orders: orderCount,
          products: productCount,
          users: userCount,
          settings: settingCount,
        };
      }
    } catch (dbErr) {
      console.warn('Prisma storage check fallback:', dbErr.message);
    }

    // 4. Memory usage
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const processMem = process.memoryUsage();

    return NextResponse.json({
      success: true,
      data: {
        disk,
        project: {
          totalBytes: totalProjectBytes,
          totalGB: (totalProjectBytes / (1024 ** 3)).toFixed(2),
          totalMB: (totalProjectBytes / (1024 ** 2)).toFixed(1),
          breakdown: {
            nodeModulesMB: (nodeModulesSize / (1024 ** 2)).toFixed(1),
            nextBuildMB: (nextSize / (1024 ** 2)).toFixed(1),
            publicMediaMB: (publicSize / (1024 ** 2)).toFixed(1),
            uploadsMB: (uploadsSize / (1024 ** 2)).toFixed(1),
            dbJsonKB: (dbJsonSize / 1024).toFixed(1),
          }
        },
        database,
        memory: {
          totalGB: (totalMemBytes / (1024 ** 3)).toFixed(1),
          usedGB: (usedMemBytes / (1024 ** 3)).toFixed(1),
          freeGB: (freeMemBytes / (1024 ** 3)).toFixed(1),
          processHeapMB: (processMem.heapUsed / (1024 ** 2)).toFixed(1),
          processRssMB: (processMem.rss / (1024 ** 2)).toFixed(1),
        },
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/storage', request);
  }
}
