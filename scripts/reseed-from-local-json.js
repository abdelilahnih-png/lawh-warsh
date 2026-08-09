/**
 * reseed-from-local-json.js
 *
 * ليش هاد السكريبت؟
 * جدول `ayahs` فـ Supabase كيبان فيه خلل (ناقص علامات ۞ الثمن — كيبينو غير ~55 حزب
 * و28 جزء عوض 60 و30)، على الأرجح بسبب مشكل ترميز (encoding) وقع أثناء أول إدخال
 * للبيانات عبر seed-data.js الأصلي. الملف المحلي `quran-data.json` (اللي معانا هنا)
 * تم التحقق منه بدقة (6214 آية، 480 ثمن، 60 حزب، 30 جزء — مطابق للمرجع)، فهاد
 * السكريبت كيمسح جدول Supabase بالكامل ويعاود يعمره بهاد النسخة المضمونة، بلا
 * ما يحتاج يرجع يطلب Quranpedia من جديد.
 *
 * الاستعمال:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxxx \
 *   node scripts/reseed-from-local-json.js
 */

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("⚠️  خاصك تعطي SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY كمتغيرات بيئة.");
  process.exit(1);
}

async function main() {
  const jsonPath = path.join(__dirname, "..", "quran-data.json");
  console.log("📖 قراءة الملف المحلي:", jsonPath);
  const rows = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`✓ ${rows.length} آية فالملف المحلي`);

  // تحقق أمان قبل ما نمسحو أي حاجة
  if (rows.length < 6200) {
    console.error("❌ الملف المحلي ناقص هو الآخر (أقل من 6200 آية) — توقفنا بلا ما نمسحو Supabase.");
    process.exit(1);
  }
  const markerCount = rows.filter(r => r.text && r.text.includes("\u06DE")).length;
  console.log(`✓ عدد الآيات اللي فيها علامة ۞: ${markerCount} (المتوقع قريب من 480)`);

  console.log("🗑️  مسح جدول ayahs الحالي فـ Supabase...");
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/ayahs?id=gt.0`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!delRes.ok) {
    console.error("❌ فشل المسح:", await delRes.text());
    process.exit(1);
  }
  console.log("✓ تم المسح");

  console.log("⬆️  إدخال البيانات المصححة...");
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ayahs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error(`❌ فشل إدخال الدفعة ${i}-${i + chunk.length}:`, await res.text());
      process.exit(1);
    }
    console.log(`✓ ${i + chunk.length}/${rows.length}`);
  }

  console.log("\n🎉 تم! جدول ayahs دابا مطابق تماما للملف المحلي المصحح.");
}

main().catch((e) => {
  console.error("❌ خطأ:", e);
  process.exit(1);
});
