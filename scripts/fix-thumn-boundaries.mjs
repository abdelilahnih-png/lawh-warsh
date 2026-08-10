/**
 * fix-thumn-boundaries.mjs
 * -------------------------------------------------------
 * تصحيح thumn_number فـ quran-data.json (رواية ورش)
 * بالاعتماد على حدود الثمن الحقيقية لرواية قالون (نفس عدد
 * الآيات 6214، ونفس حدود الحزب/الجزء تقريبا حيت كلاهما عن نافع).
 *
 * السبب: البيانات الحالية كتقسم كل حزب على 8 بالتساوي حسب
 * عدد الآيات (تقريب رياضي)، ماشي حسب الحدود الحقيقية المعتمدة
 * فالمصحف. هادشي كيبان بوضوح فحزب 1: الربع الأول خاصو يوقف
 * فـ 2:5 لكن الداطا الحالية توقفو فـ 2:24.
 *
 * الطريقة: كنجيبو التقسيم الحقيقي ديال قالون (من quran-meta)،
 * وكنطبقوه على آيات ورش "بالموقع النسبي داخل كل حزب" (index)
 * ماشي برقم الآية المباشر - هادشي كيضمن الدقة حتى لو كاين فرق
 * طفيف فترقيم آية هنا ولا هناك بين الروايتين.
 *
 * الاستعمال:
 *   npm install quran-meta
 *   node fix-thumn-boundaries.mjs quran-data.json quran-data-fixed.json
 */

import fs from "node:fs";
import { QuranRiwaya } from "quran-meta";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("الاستعمال: node fix-thumn-boundaries.mjs <input.json> <output.json>");
  process.exit(1);
}

// 1) بيانات ورش الحالية (السورة/الآية/الحزب مضبوطين، الثمن لا)
const warshData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
warshData.sort((a, b) => a.id - b.id);

// 2) بيانات قالون الحقيقية (فيها الثمن الصحيح) لنفس عدد الآيات
const qalun = QuranRiwaya.qalun();

// نبني لكل آية قالون: (hizb, thumunWithinHizb 1-8) بالترتيب المطلق
const qalunAyahList = [];
for (let ayahId = 1; ayahId <= 6214; ayahId++) {
  const meta = qalun.getAyahMeta(ayahId); // يرجع hizb, thumunAlHizbId, etc.
  qalunAyahList.push(meta);
}

// 3) نجمعو آيات قالون حسب الحزب، ونحسبو "الموقع النسبي" لكل ثمن جديد داخل الحزب
function buildRelativeThumnBoundaries(list, hizbKey, thumnKey) {
  const byHizb = new Map();
  for (const row of list) {
    const h = row[hizbKey];
    if (!byHizb.has(h)) byHizb.set(h, []);
    byHizb.get(h).push(row);
  }
  // لكل حزب: شحال ديال الآيات كاينين فكل ثمن (بالترتيب)
  const pattern = new Map(); // hizb -> [عدد آيات ثمن1, عدد آيات ثمن2, ... عدد آيات ثمن8]
  for (const [h, rows] of byHizb) {
    const counts = new Array(8).fill(0);
    for (const r of rows) {
      counts[r[thumnKey] - 1] += 1;
    }
    pattern.set(h, counts);
  }
  return pattern;
}

const qalunPattern = buildRelativeThumnBoundaries(qalunAyahList, "hizb", "thumunAlHizbId");

// 4) كنطبقو نفس "النمط النسبي" (توزيع عدد الآيات) على آيات ورش لكل حزب
const byHizbWarsh = new Map();
for (const row of warshData) {
  const h = row.hizb_number;
  if (!byHizbWarsh.has(h)) byHizbWarsh.set(h, []);
  byHizbWarsh.get(h).push(row);
}

let totalThumn = 0;
for (const [hizbNum, rows] of byHizbWarsh) {
  const counts = qalunPattern.get(hizbNum);
  if (!counts) {
    console.warn(`⚠️  ماكاينش نمط قالون للحزب ${hizbNum}، غادي نقسمو بالتساوي كـ fallback`);
  }
  const totalAyahInHizb = rows.length;
  const totalAyahInQalunHizb = counts ? counts.reduce((a, b) => a + b, 0) : totalAyahInHizb;

  // إعادة توزيع نسبي إذا كان عدد آيات ورش مختلف شوية عن قالون فنفس الحزب
  const scaledCounts = counts
    ? counts.map((c) => Math.round((c / totalAyahInQalunHizb) * totalAyahInHizb))
    : new Array(8).fill(Math.ceil(totalAyahInHizb / 8));

  // تصحيح فرق التقريب باش المجموع يبقى مضبوط
  let diff = totalAyahInHizb - scaledCounts.reduce((a, b) => a + b, 0);
  let i = scaledCounts.length - 1;
  while (diff !== 0 && i >= 0) {
    if (diff > 0) { scaledCounts[i]++; diff--; }
    else if (scaledCounts[i] > 1) { scaledCounts[i]--; diff++; }
    i = i === 0 ? scaledCounts.length - 1 : i - 1;
  }

  let idx = 0;
  for (let t = 0; t < 8; t++) {
    const globalThumn = (hizbNum - 1) * 8 + t + 1;
    for (let k = 0; k < scaledCounts[t] && idx < rows.length; k++, idx++) {
      rows[idx].thumn_number = globalThumn;
    }
    totalThumn = Math.max(totalThumn, globalThumn);
  }
}

fs.writeFileSync(outputPath, JSON.stringify(warshData, null, 2), "utf-8");
console.log(`✅ تصحيح thumn_number كمل. عدد الأثمان: ${totalThumn}. الملف: ${outputPath}`);
console.log("⚠️  ملاحظة مهمة: هاد الطريقة تقريب مبني على نمط قالون، ماشي حدود Warsh رسمية 100%.");
console.log("   للدقة الكاملة، الأفضل تلقى نسخة رقمية من مصحف ورش مع علامات ۞ مؤشرة يدويا.");
