# اجرای مرجع — وضعیت نسخهٔ آزمایشی

این سند جایگزین گزارش اغراق‌شدهٔ نسخهٔ 538 است. مرجع: فایل Final.md و sfx-v23-patch.html کاربر. اعداد نمونهٔ مرجع وارد حساب شاگرد نشده‌اند.

## تغییرهای آماده‌شده

- خانه: جلسهٔ امروز، خلاصهٔ واقعی 7 روز، کارت‌های وزن/کالری/آب/خواب، فعالیت 28 روز، انتخاب روز از برنامهٔ هفته و حساب/اشتراک جمع‌شونده.
- خانه یک رندر اصلی دارد؛ نسخهٔ قدیمیِ موازی حذف شد. شنوندهٔ تکراریِ کم‌کردن آب حذف شد.
- تغذیه: باقی‌مانده و مصرف‌شده، هدف کالری و نوارهای پروتئین/کربوهیدرات/چربی با مقادیر واقعی و وضعیت هدف نامشخص.
- پیشرفت: خلاصهٔ هفته، مقایسهٔ حجم با 7 روز قبل و نمودار حجم 8 هفته؛ رکوردها و مقایسهٔ عکس‌های موجود حفظ شده‌اند.
- فایل افکت کاربر در AthleteEffects.html ادغام شده؛ شیشهٔ کنترل‌ها، نور اشاره‌گر، ریپل، انتقال تب و ثبت سریع ست. حلقهٔ دائمی رندر، تکرار مصنوعی کلیک، درصد ساختگی لودینگ و مشاهده‌گرهای بی‌مصرف حذف شده‌اند.
- ثبت سریع به ورودی و دکمهٔ واقعی فرم وصل است؛ مسیر ذخیرهٔ جدیدِ موازی ساخته نشده. دکمهٔ ذخیره هنگام درخواست غیرفعال است.
- جلسهٔ زنده: شروع/پایان واقعی، زمان سپری‌شده، ست و حجم از ثبت‌های ذخیره‌شده، درصد و تعداد باقی‌مانده وقتی ست‌های برنامه مشخص‌اند. جدول WorkoutSessions در اولین شروع واقعی ایجاد می‌شود. هر حساب فقط جلسهٔ خودش را می‌خواند و پایان دوبارهٔ همان جلسه، ردیف تازه نمی‌سازد.
- خواب: ساعت اختیاری و کیفیت/انرژی در WellnessLogs با کلید حساب و روز ذخیره می‌شود. خانه از همان داده می‌خواند؛ ارسال پیام مربی بعد از ذخیره انجام می‌شود و شکست پیام، ذخیرهٔ گزارش را پنهان نمی‌کند.

## شواهد و محدودیت‌ها

در مرورگر نسخهٔ آزمایشی 539، ساختار جدید خانه با حساب شاگرد دیده شد. نوار ثبت سریع روی فرم اصلی باز شد؛ دکمهٔ +5 مقدار وزن را به 5 و دکمهٔ 10 مقدار تکرار را به 10 رساند. دکمهٔ ذخیره زده نشد و دادهٔ تمرین آزمایشی برای شاگرد ثبت نشد.

برای جلسه و خواب آزمون‌های حافظه‌ایِ ذخیره، مالکیت، ورودی نامعتبر، هم‌زمانی منطقیِ یک جلسهٔ باز و پایان تکراری پاس شده‌اند. تست جلسهٔ شروع تا پایان در دیتابیس زنده انجام نشده است. نمودارها آزمون مرز هفته و حذف تاریخ آینده دارند.

دسترسی ابزار کنترل مرورگر پس از این بررسی برداشته شد؛ بنابراین تغییرهای بعدی تغذیه، پیشرفت، جلسه و خواب هنوز بررسی بصری کامل نشده‌اند. نسخهٔ آزمایشی قابل بررسی است؛ آدرس اصلی عمداً روی نسخهٔ 538 نگه داشته شده است.

پاک‌سازی تمام توابع مدیریتی قدیمی، مهاجرت Cloudflare/دامنه، OTP و آفلاین مستقل در این تغییر تحویل نشده‌اند. عکس غذا طبق دستور کاربر در اولویت کار نیست.


## پس از دریافت HTML کامل — پیش‌نمایش 543

فایل کامل `Saeedi Fit Body — Final.html` دریافت شد؛ نسخهٔ اصلی آن بدون تغییر بایت‌ها در `design/Final.original.txt` نگه داشته شده است. بخش قبلی این سند، وضعیت پیش از دریافت HTML را توضیح می‌دهد.

`ReferenceDesign.html` از همان CSS و ساختار مؤلفه‌های فایل اصلی ساخته می‌شود. صفحه‌های خانه، تمرین، تغذیه، پیشرفت و بیشتر، همراه نمای جلسهٔ زنده به داده و API واقعی وصل شده‌اند. استایل‌ها در ShadowRoot جدا هستند تا CSS قدیمی کارت، دکمه یا فونت را عوض نکند. نشان رسمی SVG داخل همین فایل مرجع استفاده شده است.

ظاهر کارت‌ها، کارت جلسه، شیشهٔ کنترل‌ها، تایپوگرافی اعداد، ماکروها و ثبت ست با اعلان‌های CSS فایل اصلی تطبیق داده شده است. رفتارهای دموی فایل، پیام خودکار، شماره‌کارت و تعرفهٔ فرضی، نبض ساختگی و درصد لودینگ ساختگی وارد نسخهٔ متصل نشده‌اند. هدف هفتگیِ تعریف‌نشده با درصد فرضی جایگزین نشده است.

در جلسه، وزن و تکرار قبلی از سابقهٔ همان حساب پر می‌شوند. ثبت ست از `logExerciseSet`، و شروع/پایان از API جدول WorkoutSessions استفاده می‌کند. بستن نمای جلسه، آن را به‌طور پنهانی پایان نمی‌دهد. نمایش صفحه‌های هالتر، فرض میلهٔ 20 kg را صریحاً می‌نویسد. تایمر استراحت فقط هنگام نیاز فعال است.

9 تابع قدیمیِ خانه و رندر موازی کنار گذاشته شده‌اند. کل کد مدیریت قدیمی هنوز استخراج کامل نشده است. صفحه‌های فرعیِ موجود مثل فرم پروفایل و پیام‌ها و پرداخت واقعی حفظ شده‌اند و همهٔ آن‌ها هنوز به قالب داخلی این فایل تبدیل نشده‌اند.

16 فایل آزمون پاس شده‌اند. تست DOM با داده و سرور شبیه‌سازی‌شده، ناوبری اصلی، فرم واقعی غذا، ماکرو، 8 هفتهٔ گزارش، دریافت سابقهٔ وزنه، شروع جلسه، ذخیرهٔ ست و پایان جلسه را پوشش می‌دهد. تست، CSSهای اصلیِ مؤلفه‌ها و مستقل‌بودن استایل در ShadowRoot را نیز کنترل می‌کند. این‌ها جای تست بصری مرورگر واقعی را نمی‌گیرند. دسترسی کنترل مرورگر هنوز موجود نیست؛ نسخهٔ اصلی روی 538 باقی مانده و نسخهٔ 543 فقط روی آدرس بازبینی است.

بازسازی: `npm ci`، سپس `npm run build:reference` و `npm test`. تغییر AppJs به اجرای `build-client.ps1` هم نیاز دارد. `.claspignore` فایل مرجع خام، فایل‌های ساخت، آزمون‌ها و وابستگی‌ها را از ارسال به Apps Script کنار می‌گذارد.

## Review revision after user rejection of @543
The user reported substantial remaining differences in placement, numeric typography and motion; @543 has not been visually accepted. Embedded three licensed WOFF2 subsets (Big Shoulders Display Latin, Vazirmatn Arabic/Latin) so the reference UI no longer depends on the Google Fonts network request. Kept font source CSS and OFL licenses under design/.

Removed forced reveal-opacity/transform overrides and obsolete inline !important escalation. Added finite viewport-entry and numeric-entry motion, animated the navigation lens from the previous tab, and restored a CSS ticker and staggered heat cells. Reduced-motion disables decorative motion; observers disconnect between views. Explicit RTL and a 16px base stop inherited page defaults from changing reference geometry.

Chat now stays in the isolated reference UI, uses actual getMessages/sendMessage APIs, escapes message content, keeps an account-scoped in-memory draft, prevents parallel submission, retains text on failure and ignores responses after navigation/account changes. It does not generate coach replies or claim Telegram delivery. Account, reminders, supplement and payment deep views still require further visual integration; the overall app redesign is not complete.

Mock DOM tests cover chat failure/success/draft retention/account switching, embedded font faces, finite animation options, reduced-motion suppression and absence of !important on the animated navigation transform. No real message or other athlete data was written. Browser visual QA remains unavailable. Production remains @538.

Browser recovery: the current Computer Use skill exposes @oai/sky through node_repl. This path initialized successfully; the supplied Final.html was visually inspected in Edge on Home and More. The reference logo was visibly clipped. Its <use> viewport was anchored at 0,0 inside an outer viewBox beginning at 321,150; changed the display viewport to 0 0 438 500 with explicit 438x500 use dimensions, preserving the supplied official symbol. DOM assertions cover these dimensions. The original source archive remains unchanged.

The production athlete page was observed before navigating to review @544; no data was submitted. Browser captures then became intermittent, including timeouts and changing foreground windows. Review visual acceptance and live session/chat end-to-end verification remain incomplete. Source inspection is not evidence that the new deployment has been visually accepted.

Review deployment is confirmed at @544; production remains @538. An unauthenticated HTTP check of @544 returned 200 and the reference UI content without a reported HtmlService/SyntaxError. This is not visual acceptance. Latest local edits after @544 include the corrected logo viewport, content-adaptive heading/number sizing, and a reference-styled weight plot with actual date spacing, valid past records only, date/value tooltips and insufficient-data feedback. DOM tests pass; these later edits are not yet deployed.

User supplied a Lovable share preview URL while work was ongoing. The direct web open failed. The connected Lovable account exposes one project, Script Studio (907a0a70-1aca-4a5c-8c6a-bee97bcaee2b). Read its project metadata, file list and HomeScreen.tsx at bf07730bfffde0969285f39eefae5c8235bacdff. It contains a separate React UI, fit screens, primitives, store/actions and imported gas/ sources. Do not claim the opaque share URL has been definitively mapped to this project, or that every file has been read. No Lovable edits, messages, deployment or database changes were made.
