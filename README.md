لوح ورش — Lawh Warsh 📖
مصحف إلكتروني برواية ورش عن نافع من طريق الأزرق، مستوحى من تصميم اللوح المغربي التقليدي. ملف HTML واحد (Vanilla JS)، متصل بـ Supabase، وقابل للنشر على GitHub Pages.
1) إعداد Supabase
أنشئ مشروع جديد على supabase.com.
من SQL Editor، شغّل محتوى scripts/schema.sql كاملاً.
من Authentication → Providers، فعّل Anonymous Sign-In.
من Project Settings → API، خذ:
Project URL → حطه فـ CONFIG.SUPABASE_URL فـ index.html
anon public key → حطه فـ CONFIG.SUPABASE_ANON_KEY فـ index.html
service_role key (سري، ما تحطوش فـ index.html) → يستعمل غير محليا للـ seed
2) تعمير النص (مرة وحدة فقط)
npm install --prefix scripts
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=xxxx
node scripts/seed-data.js
هذا السكريبت كيجيب مصحف ورش الكامل من Quranpedia API (GET /v1/mushafs/4) ويعمر جدول ayahs، وكيحسب تقسيم الثمن/الحزب/الجزء الدقيق عبر مكتبة quran-meta.
إلا رجع الـ endpoint البيانات بشكل مختلف عما هو متوقع، السكريبت كيتحول تلقائيا لجلب كل سورة على حدة (114 طلب).
إلا استعملتي GitHub Actions (seed.yml) بدل التشغيل المحلي، تثبيت quran-meta كيتم تلقائيا، ماخاصكش تدير npm install بيدك.
3) القراء (mp3quran.net)
التطبيق كيجيب تلقائيا لائحة القراء لرواية "Warsh A'n Nafi' Men Tariq Alazraq" من:
GET /api/v3/riwayat?language=ar (لجيب id ديال الرواية)
GET /api/v3/moshaf?language=ar&rewaya={id} (لجيب القراء + السيرفر)
القارئ الافتراضي: عمر القزابري (البحث بجزء من الاسم القزابري). إلا تعطل الـ API، كاين قائمة احتياطية CONFIG.FALLBACK_RECITERS فـ index.html — زيد فيها قراء جدد بسهولة بلا ما تبدل المنطق.
تكرار الآيات: التطبيق كيجرب أولا GET /api/v3/ayat_timing?surah=X&read=Y باش يكرر بدقة (من توقيت البداية للنهاية). إلا ماكانش التوقيت متوفر لقارئ معين، كيرجع تلقائيا لتكرار السورة كاملة (مع تنبيه للمستخدم).
4) التشغيل محليا
ملف HTML واحد بلا build step — افتحه مباشرة فالمتصفح، أو:
npx serve .
5) النشر على GitHub Pages
git init
git add .
git commit -m "اللوح المحفوظ"
git branch -M main
git remote add origin <رابط المستودع>
git push -u origin main
من إعدادات المستودع → Pages → اختر branch main وpath / (root).
⚠️ ملاحظة أمنية: anon key ديال Supabase آمن للكشف العمومي (مصمم لهاذ الغرض، ومحمي بـ RLS)، لكن لا تنشر أبدا service_role key فـ index.html أو فأي ملف عمومي.
بنية الملفات
/
├── index.html          ← التطبيق الكامل (الواجهة + المنطق)
├── manifest.json        ← يخلي التطبيق يتزاد للهاتف بحال أبليكاسيون (PWA)
├── service-worker.js     ← تخزين مؤقت للتطبيق (يخدم أسرع، ويفتح حتى بلا نت جزئيا)
├── icons/                ← أيقونة التطبيق بمقاسات مختلفة
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── apple-touch-icon.png
│   └── favicon-32.png
├── .github/workflows/
│   └── seed.yml          ← يشغل seed-data.js من السحاب (بلا حاجة لحاسوب)
├── scripts/
│   ├── schema.sql        ← بنية قاعدة البيانات (شغّلها فـ Supabase SQL Editor)
│   ├── package.json      ← يعرّف الاعتماد على quran-meta
│   └── seed-data.js      ← سكريبت تعمير النص (مرة وحدة)
└── README.md
تزيد التطبيق للهاتف بحال أبليكاسيون (PWA)
بعد نشر التطبيق على GitHub Pages:
Android (Chrome): افتح الرابط، غادي يبان إشعار "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)، ولا من قائمة المتصفح (⋮) اختار "Install app"
iPhone (Safari): افتح الرابط، اضغط زر المشاركة (Share) 📤، اختار "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)
بعد الإضافة، التطبيق غادي يفتح بأيقونة خاصة بلا شريط المتصفح، بحال أي أبليكاسيون عادية.
ملاحظات تقنية مهمة
تقسيم الثمن (480 ثمن) — محدّث ودقيق: كان السكريبت قبل كيقارب رقم الثمن بالاعتماد على ترتيب صفحات Quranpedia نفسها (604 صفحة، بحال حفص) — وهاد التقسيم ماكانش مطابق لتقسيم اللوح المغربي الحقيقي (480). دابا seed-data.js كيستعمل مكتبة quran-meta اللي عندها بيانات محققة لرواية ورش (30 جزء، 60 حزب، 240 ربع حزب)، وكيحسب الثمن (480) بتنصيف كل ربع حزب لنصفين بعدد الآيات — أدق تقريب متوفر حاليا (المكتبة ماعندهاش حدود الثمن الدقيقة إلا لرواية قالون). النتيجة: كل صفحة فالتطبيق = ثمن واحد بالضبط، وأرقام الجزء/الحزب دقيقة 100%.
إلا كنت شغلتي seed-data.js من قبل بالنسخة القديمة، خاصك تعاود تشغل الـ workflow (Actions → Seed Ayahs → Run workflow) باش تتبدل البيانات القديمة بالجديدة الدقيقة (الإدخال آمن، كيبدل الصفوف الموجودة بنفس المعرف).
السكريبت دابا محتاج تثبيت quran-meta قبل التشغيل: npm install --prefix scripts (الـ workflow ديال GitHub Actions كيدير هادشي تلقائيا).
Offline fallback: الآيات كتخزن فـ localStorage بعد أول تحميل ناجح من Supabase، والتطبيق كيقرا من الكاش المحلي إلا تعذر الاتصال.
RLS: كل الجداول محمية بـ Row Level Security ماعدا ayahs (عمومي للقراءة).
