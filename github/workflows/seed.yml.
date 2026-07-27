/**
 * seed-data.js
 * سكريبت يشتغل مرة وحدة (من الطرفية، بلا حاجة للمتصفح):
 *   1. يجيب مصحف ورش كامل (id=4) من Quranpedia API
 *   2. يحسب رقم الثمن (thumn_number) لكل آية اعتمادا على page_number
 *      (480 ثمن = 604 صفحات تقريبا فمصحف حفص، وقد يختلف قليلا فمصحف ورش
 *       لأن عدد صفحات ورش غير ثابت بين الطبعات. الحل الأسلم: كل صفحة = ثمن،
 *       ونرقمها بالتسلسل حسب عدد الصفحات الفعلي المرجّع من الـ API، بدل
 *       الافتراض المسبق ب480. عدّل QUARTERS_PER_PAGE تحت إلا بغيتي تقسيم مغاير)
 *   3. يدخل النتيجة لجدول `ayahs` فـ Supabase عبر REST (بلا حاجة لمكتبة @supabase/supabase-js)
 *
 * الاستعمال:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxxx \
 *   node scripts/seed-data.js
 *
 * ملاحظة: خدم بـ service_role key هنا (ماشي anon)، لأن الإدخال الجماعي
 * محتاج يتجاوز RLS. ماتخزنش هاد المفتاح فالكود ديال الفرونت إند أبدا.
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

/**
 * Quranpedia قد يرجع البيانات بأحد شكلين حسب الـ endpoint:
 *  - GET /mushafs/{id} → { ..., surahs: [ { ayahs: [...] } ] }  (متداخل)
 *  - أو GET /mushafs/{id}/{surah} لكل سورة على حدة → array مباشر
 * هاد الدالة كتطبع الشكل وتتعامل مع الحالتين.
 */
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
          page_number: a.page_number,
        });
      }
    }
  } else if (Array.isArray(mushafData)) {
    // شكل بديل: array مباشر من الآيات
    for (const a of mushafData) {
      flat.push({
        id: a.id,
        surah_number: a.surah,
        surah_name: a.surah_name ?? "",
        ayah_number: a.number ?? a.ayah_number,
        text: a.text,
        page_number: a.page_number,
      });
    }
  }

  return flat;
}

/** إلا ماكانتش السور متداخلة فـ mushafs/{id}، نجيبو كل سورة على حدة (1-114) */
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
        page_number: a.page_number,
      });
    }
    // احترام rate limit ديال API (600 طلب/دقيقة تقريبا حسب التوثيق)
    await new Promise((r) => setTimeout(r, 120));
    process.stdout.write(`\rسورة ${surahNumber}/114 ...`);
  }
  console.log("");
  return flat;
}

/** يحسب thumn_number, hizb_number, juz_number اعتمادا على تسلسل الصفحات الفعلي */
function computeDivisions(ayahs) {
  const pages = [...new Set(ayahs.map((a) => a.page_number))].sort(
    (a, b) => a - b
  );
  const totalPages = pages.length;
  const pageIndex = new Map(pages.map((p, i) => [p, i + 1])); // 1-based

  // فاللوح المغربي: كل صفحة = ثمن. الجزء = 1/30، الحزب = 1/60 (نصف جزء)
  for (const a of ayahs) {
    const thumn = pageIndex.get(a.page_number); // 1..totalPages
    a.thumn_number = thumn;
    a.hizb_number = Math.ceil((thumn / totalPages) * 60);
    a.juz_number = Math.ceil((thumn / totalPages) * 30);
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
    const mushaf = await fetchJson(
      `${QURANPEDIA_BASE}/mushafs/${WARSH_MUSHAF_ID}`
    );
    ayahs = flattenAyahs(mushaf);
  } catch (e) {
    console.warn("⚠️  فشل الجلب الكامل دفعة وحدة:", e.message);
  }

  if (ayahs.length === 0) {
    console.log("↻ نجرب الجلب سورة بسورة بدل ذلك...");
    ayahs = await fetchAllAyahsPerSurah();
  }

  if (ayahs.length === 0) {
    console.error(
      "❌ ماقدرناش نجيبو ولا آية. تحقق من استجابة API يدويا:\n" +
        `${QURANPEDIA_BASE}/mushafs/${WARSH_MUSHAF_ID}`
    );
    process.exit(1);
  }

  console.log(`✓ تم جلب ${ayahs.length} آية`);
  console.log("📐 جاري حساب تقسيمات الثمن/الحزب/الجزء...");
  computeDivisions(ayahs);

  console.log("⬆️  جاري الإدخال إلى Supabase...");
  await upsertToSupabase(ayahs);

  console.log("🎉 تم! جدول ayahs معمر بالكامل.");
}

main().catch((e) => {
  console.error("❌ خطأ:", e);
  process.exit(1);
});
