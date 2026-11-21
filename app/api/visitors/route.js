import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { rawPrisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/security/errors';
import { getCookieValue } from '@/lib/security/auth';

export const dynamic = 'force-dynamic';

const VISITOR_SETTING_KEY = 'site_visitor_stats';

let memoryVisitorStats = {
  totalUniqueVisits: 0,
  daily: {}
};

function getIstanbulDateString(dateObj = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  } catch {
    return dateObj.toISOString().slice(0, 10);
  }
}

function hashFingerprint(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
}

async function readVisitorStats() {
  try {
    if (rawPrisma && rawPrisma.systemSetting) {
      const rec = await rawPrisma.systemSetting.findUnique({
        where: { key: VISITOR_SETTING_KEY }
      });
      if (rec && rec.value && typeof rec.value === 'object') {
        const val = rec.value;
        memoryVisitorStats = {
          totalUniqueVisits: Number(val.totalUniqueVisits) || 0,
          daily: val.daily && typeof val.daily === 'object' ? val.daily : {}
        };
        return memoryVisitorStats;
      }
    }
  } catch (err) {
    console.warn('Prisma visitor stats read fallback:', err.message);
  }
  return memoryVisitorStats;
}

async function writeVisitorStats(stats) {
  memoryVisitorStats = stats;
  try {
    if (rawPrisma && rawPrisma.systemSetting) {
      await rawPrisma.systemSetting.upsert({
        where: { key: VISITOR_SETTING_KEY },
        update: { value: stats },
        create: { key: VISITOR_SETTING_KEY, value: stats }
      });
    }
  } catch (err) {
    console.warn('Prisma visitor stats write fallback:', err.message);
  }
}

function summarizeVisitorStats(stats) {
  const dailyMap = stats?.daily || {};
  const now = new Date();
  const todayKey = getIstanbulDateString(now);
  const yesterdayKey = getIstanbulDateString(new Date(now.getTime() - 24 * 3600 * 1000));

  let last7DaysCount = 0;
  let last30DaysCount = 0;
  for (let i = 0; i < 30; i++) {
    const dKey = getIstanbulDateString(new Date(now.getTime() - i * 24 * 3600 * 1000));
    const c = Number(dailyMap[dKey]?.count || 0);
    if (i < 7) last7DaysCount += c;
    last30DaysCount += c;
  }

  const dailyCounts = {};
  let computedTotal = 0;
  for (const [k, v] of Object.entries(dailyMap)) {
    const c = Number(v?.count || 0);
    dailyCounts[k] = c;
    computedTotal += c;
  }

  return {
    todayKey,
    todayCount: Number(dailyMap[todayKey]?.count || 0),
    yesterdayCount: Number(dailyMap[yesterdayKey]?.count || 0),
    last7DaysCount,
    last30DaysCount,
    totalCount: Math.max(Number(stats?.totalUniqueVisits || 0), computedTotal),
    dailyCounts
  };
}

export async function GET() {
  try {
    const stats = await readVisitorStats();
    return NextResponse.json({
      success: true,
      data: summarizeVisitorStats(stats)
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      data: summarizeVisitorStats(memoryVisitorStats)
    });
  }
}

export async function POST(request) {
  try {
    const todayKey = getIstanbulDateString(new Date());
    const cookieVisitedDay = getCookieValue(request, 'sd_visited_day');

    let body = {};
    try {
      body = await request.json();
    } catch {}

    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim().slice(0, 120) : '';
    const ip = getClientIp(request);
    const ua = (request.headers.get('user-agent') || 'unknown').slice(0, 250);

    const devFp = deviceId ? `d_${hashFingerprint(deviceId)}` : null;
    const netFp = `n_${hashFingerprint(`${ip}|${ua}`)}`;

    const stats = await readVisitorStats();
    const daily = { ...(stats.daily || {}) };
    const todayRecord = daily[todayKey] || { count: 0, fingerprints: [] };
    const fpList = Array.isArray(todayRecord.fingerprints) ? [...todayRecord.fingerprints] : [];

    const alreadyVisitedToday =
      cookieVisitedDay === todayKey ||
      (devFp && fpList.includes(devFp)) ||
      fpList.includes(netFp);

    if (!alreadyVisitedToday) {
      if (devFp && !fpList.includes(devFp)) fpList.push(devFp);
      if (!fpList.includes(netFp)) fpList.push(netFp);

      daily[todayKey] = {
        count: Number(todayRecord.count || 0) + 1,
        fingerprints: fpList.slice(-5000)
      };

      // Prune fingerprint arrays from days older than 14 days to keep DB record lightweight
      const cutoffDate = getIstanbulDateString(new Date(Date.now() - 14 * 24 * 3600 * 1000));
      for (const [dKey, rec] of Object.entries(daily)) {
        if (dKey < cutoffDate && rec && Array.isArray(rec.fingerprints) && rec.fingerprints.length > 0) {
          daily[dKey] = { count: Number(rec.count || 0) };
        }
      }

      const nextStats = {
        totalUniqueVisits: Number(stats.totalUniqueVisits || 0) + 1,
        daily
      };
      await writeVisitorStats(nextStats);
    }

    const summary = summarizeVisitorStats(memoryVisitorStats);
    const response = NextResponse.json({
      success: true,
      alreadyCounted: alreadyVisitedToday,
      data: summary
    });

    response.headers.append(
      'Set-Cookie',
      `sd_visited_day=${todayKey}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly`
    );
    return response;
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: summarizeVisitorStats(memoryVisitorStats)
    });
  }
}
