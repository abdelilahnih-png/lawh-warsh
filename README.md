# لوح ورش — Lawh Warsh 📖

مصحف إلكتروني برواية **ورش عن نافع من طريق الأزرق**، مستوحى من تصميم اللوح المغربي التقليدي.
ملف HTML واحد (Vanilla JS)، متصل بـ Supabase، وقابل للنشر على GitHub Pages.

## 1) إعداد Supabase
1. أنشئ مشروع جديد على [supabase.com](https://supabase.com).
2. من **SQL Editor**، شغّل محتوى `scripts/schema.sql` كاملاً.
3. من **Authentication → Providers**، فعّل **Anonymous Sign-In**.
4. من **Project Settings → API**، خذ:
   - `Project URL` → حطه فـ `CONFIG.SUPABASE_URL` فـ `index.html`
   - `anon public key` → حطه فـ `CONFIG.SUPABASE_ANON_KEY` فـ `index.html`
   - `service_role key` (سري، ما تحطوش فـ index.html) → يستعمل غير محليا للـ seed

## 2) تعمير النص (مرة وحدة فقط)
```bash
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=xxxx
node scripts/seed-data.js
```
هذا السكريبت كيجيب مصحف ورش الكامل من Quranpedia API (`GET /v1/mushafs/4`) ويعمر جدول `ayahs`.
- إلا رجع الـ endpoint البيانات بشكل مختلف عما هو متوقع، السكريبت كيتحول تلقائيا لجلب كل سورة على حدة (114 طلب).
- تحقق من الاستجابة الفعلية على `https://api.quranpedia.net/v1/mushafs/4` قبل التشغيل الكامل، وعدّل دالة `flattenAyahs` فـ `scripts/seed-data.js` إلا لزم الأمر — بنية JSON للـ APIs العمومية تتغير أحيانا بلا إشعار.

## 3) القراء (mp3quran.net)
التطبيق كيجيب تلقائيا لائحة القراء لرواية "Warsh A'n Nafi' Men Tariq Alazraq" من:
- `GET /api/v3/riwayat?language=ar` (لجيب id ديال الرواية)
- `GET /api/v3/moshaf?language=ar&rewaya={id}` (لجيب القراء + السيرفر)

القارئ الافتراضي: **عمر القزابري** (البحث بجزء من الاسم `القزابري`).
إلا تعطل الـ API، كاين قائمة احتياطية `CONFIG.FALLBACK_RECITERS` فـ `index.html` — زيد فيها قراء جدد بسهولة بلا ما تبدل المنطق.

**تكرار الآيات:** التطبيق كيجرب أولا `GET /api/v3/ayat_timing?surah=X&read=Y` باش يكرر بدقة (من توقيت البداية للنهاية). إلا ماكانش التوقيت متوفر لقارئ معين، كيرجع تلقائيا لتكرار السورة كاملة (مع تنبيه للمستخدم).

## 4) التشغيل محليا
ملف HTML واحد بلا build step — افتحه مباشرة فالمتصفح، أو:
```bash
npx serve .
```

## 5) النشر على GitHub Pages
```bash
git init
git add .
git commit -m "اللوح المحفوظ"
git branch -M main
git remote add origin <رابط المستودع>
git push -u origin main
```
من إعدادات المستودع → **Pages** → اختر branch `main` وpath `/ (root)`.

⚠️ **ملاحظة أمنية:** `anon key` ديال Supabase آمن للكشف العمومي (مصمم لهاذ الغرض، ومحمي بـ RLS)، لكن **لا تنشر أبدا `service_role key`** فـ index.html أو فأي ملف عمومي.

## بنية الملفات
```
/
├── index.html          ← التطبيق الكامل (الواجهة + المنطق)
├── scripts/
│   ├── schema.sql       ← بنية قاعدة البيانات (شغّلها فـ Supabase SQL Editor)
│   └── seed-data.js     ← سكريبت تعمير النص (مرة وحدة، من الطرفية)
└── README.md
```

## ملاحظات تقنية مهمة
- **تقسيم الثمن (480 ثمن):** عدد صفحات مصحف ورش يختلف قليلا بين الطبعات (ماشي 604 دائما بحال حفص). السكريبت `seed-data.js` كيحسب `thumn_number` بالتناسب مع العدد الفعلي للصفحات المرجّع من Quranpedia، ماشي برقم 480 ثابت مفروض مسبقا — هذا أدق. عدّل الدالة `computeDivisions` إلا بغيتي تقسيم مغاير.
- **Offline fallback:** الآيات كتخزن فـ `localStorage` بعد أول تحميل ناجح من Supabase، والتطبيق كيقرا من الكاش المحلي إلا تعذر الاتصال.
- **RLS:** كل الجداول محمية بـ Row Level Security ماعدا `ayahs` (عمومي للقراءة).
