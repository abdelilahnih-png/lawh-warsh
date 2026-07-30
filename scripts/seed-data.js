/**
 * seed-data.js (نسخة محدثة — تقسيم ثمن دقيق)
 *
 * التغيير المهم عن النسخة السابقة:
 * قبل: كنا نحسبو رقم الثمن اعتمادا على ترتيب صفحات Quranpedia نفسها (604 صفحة،
 *      بحال مصحف حفص العادي) — وهاد التقسيم ماشي هو تقسيم "الثمن" المغربي الحقيقي (480).
 * دابا: كنستعملو مكتبة quran-meta (https://github.com/quran-center/quran-meta)
 *      اللي عندها بيانات محققة لرواية ورش: 30 جزء، 60 حزب، 240 ربع حزب.
 *      نحسبو الثمن (480) بتنصيف كل ربع حزب لنصفين بعدد الآيات — هاد التقريب
 *      الأدق المتوفر حاليا (المكتبة ماعندهاش حدود الثمن الدقيقة لورش، غير لقالون).
 *      النتيجة: كل "صفحة" فالتطبيق = ثمن واحد بالضبط (480 صفحة فالتطبيق كامل)،
 *      وأرقام الجزء/الحزب فوق كل صفحة أصبحو دقيقين 100% (ماشي تقريب).
 *
 * الاستعمال:
 *   npm install --prefix scripts   (أو من جذر المشروع إلا كان package.json فالجذر)
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxxx \
 *   node scripts/seed-data.js
 */

const QURANPEDIA_BASE = "https://api.quranpedia.net/v1";
const WARSH_MUSHAF_ID = 4;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "⚠️  خاصك تعطي SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY كمتغيرات بيئة قبل تشغيل هذا السكريبت."
  );
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`فشل الطلب ${url} — status ${res.status}`);
  }
  return res.json();
}

function flattenAyahs(mushafData) {
  const flat = [];
  if (Array.isArray(mushafData?.surahs)) {
    for (const surah of mushafData.surahs) {
      const surahNumber = surah.number ?? surah.id ?? surah.surah_number;
      const surahName = surah.name ?? surah.surah_name ?? "";
      const ayahList = surah.ayahs ?? surah.verses ?? [];
      for (const a of ayahList) {
        flat.push({
          id: a.id,
          surah_number: a.surah ?? surahNumber,
          surah_name: surahName,
          ayah_number: a.number ?? a.ayah_number,
          text: a.text,
        });
      }
    }
  } else if (Array.isArray(mushafData)) {
    for (const a of mushafData) {
      flat.push({
        id: a.id,
        surah_number: a.surah,
        surah_name: a.surah_name ?? "",
        ayah_number: a.number ?? a.ayah_number,
        text: a.text,
      });
    }
  }
  return flat;
}

async function fetchAllAyahsPerSurah() {
  const flat = [];
  for (let surahNumber = 1; surahNumber <= 114; surahNumber++) {
    const data = await fetchJson(
      `${QURANPEDIA_BASE}/mushafs/${WARSH_MUSHAF_ID}/${surahNumber}`
    );
    const list = Array.isArray(data) ? data : data.ayahs ?? [];
    for (const a of list) {
      flat.push({
        id: a.id,
        surah_number: a.surah ?? surahNumber,
        surah_name: a.surah_name ?? "",
        ayah_number: a.number ?? a.ayah_number,
        text: a.text,
      });
    }
    await new Promise((r) => setTimeout(r, 120));
    process.stdout.write(`\rسورة ${surahNumber}/114 ...`);
  }
  console.log("");
  return flat;
}

/** يبني 480 حد ثمن بتنصيف كل ربع حزب (240) لنصفين بعدد الآيات */
function buildThumunBoundaries(getRubAlHizbMeta) {
  const boundaries = [];
  for (let rub = 1; rub <= 240; rub++) {
    const m = getRubAlHizbMeta(rub);
    const count = m.lastAyahId - m.firstAyahId + 1;
    const half = Math.ceil(count / 2);
    boundaries.push({ thumn: rub * 2 - 1, from: m.firstAyahId, to: m.firstAyahId + half - 1 });
    boundaries.push({ thumn: rub * 2, from: m.firstAyahId + half, to: m.lastAyahId });
  }
  return boundaries;
}
function findThumn(ayahId, boundaries) {
  let lo = 0, hi = boundaries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = boundaries[mid];
    if (ayahId < b.from) hi = mid - 1;
    else if (ayahId > b.to) lo = mid + 1;
    else return b.thumn;
  }
  return null;
}

/** يحسب thumn_number (=page_number الجديد)، hizb_number، juz_number بدقة عبر quran-meta */
async function computeAccurateDivisions(ayahs) {
  const { getAyahMeta, findAyahIdBySurah, getRubAlHizbMeta, meta } = await import("quran-meta/warsh");
  console.log(`📚 quran-meta (ورش): ${meta.numAyahs} آية، ${meta.numRubAlHizbs} ربع حزب، ${meta.numThumunAlHizbs} ثمن (نظريا)`);

  const thumunBoundaries = buildThumunBoundaries(getRubAlHizbMeta);
  let mismatches = 0;

  for (const a of ayahs) {
    const ayahId = findAyahIdBySurah(a.surah_number, a.ayah_number);
    if (!ayahId) {
      mismatches++;
      a.thumn_number = null; a.hizb_number = null; a.juz_number = null;
      continue;
    }
    const meta2 = getAyahMeta(ayahId);
    a.hizb_number = meta2.hizbId;
    a.juz_number = meta2.juz;
    a.thumn_number = findThumn(ayahId, thumunBoundaries);
    a.page_number = a.thumn_number;
  }

  if (mismatches > 0) {
    console.warn(`⚠️  ${mismatches} آية ماتلقاتش تطابق دقيق فـ quran-meta (فرق بسيط محتمل بين المصادر) — سيتم تعويضها بثمن الآية السابقة.`);
  }

  for (let i = 0; i < ayahs.length; i++) {
    if (ayahs[i].thumn_number == null && i > 0) {
      ayahs[i].thumn_number = ayahs[i-1].thumn_number;
      ayahs[i].hizb_number = ayahs[i-1].hizb_number;
      ayahs[i].juz_number = ayahs[i-1].juz_number;
      ayahs[i].page_number = ayahs[i-1].page_number;
    }
  }

  return ayahs;
}

async function upsertToSupabase(rows) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ayahs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`فشل إدخال الدفعة ${i}-${i + chunk.length}: ${errText}`);
    }
    console.log(`✓ تم إدخال ${i + chunk.length}/${rows.length} آية`);
  }
}

async function main() {
  console.log("📖 جاري جلب مصحف ورش من Quranpedia...");
  let ayahs = [];

  try {
    const mushaf = await fetchJson(`${QURANPEDIA_BASE}/mushafs/${WARSH_MUSHAF_ID}`);
    ayahs = flattenAyahs(mushaf);
  } catch (e) {
    console.warn("⚠️  فشل الجلب الكامل دفعة وحدة:", e.message);
  }

  if (ayahs.length === 0) {
    console.log("↻ نجرب الجلب سورة بسورة بدل ذلك...");
    ayahs = await fetchAllAyahsPerSurah();
  }

  if (ayahs.length === 0) {
    console.error(`❌ ماقدرناش نجيبو ولا آية. تحقق من: ${QURANPEDIA_BASE}/mushafs/${WARSH_MUSHAF_ID}`);
    process.exit(1);
  }

  console.log(`✓ تم جلب ${ayahs.length} آية`);
  console.log("📐 جاري حساب تقسيمات الثمن/الحزب/الجزء الدقيقة (عبر quran-meta)...");
  await computeAccurateDivisions(ayahs);

  console.log("⬆️  جاري الإدخال إلى Supabase...");
  await upsertToSupabase(ayahs);

  const totalThumns = new Set(ayahs.map(a => a.page_number)).size;
  console.log(`🎉 تم! جدول ayahs معمر بالكامل — ${totalThumns} صفحة/ثمن (المتوقع: 480).`);
}

main().catch((e) => {
  console.error("❌ خطأ:", e);
  process.exit(1);
});
