# C5 complete button audit

Complete source callsite census and required shared-control contract. This is not browser measurement evidence. Rendered states and their actual dimensions are recorded separately by c5-button-audit.spec.ts and capture-design-c5.mjs; conditional states not opened remain source-only.

Source: `f96d36944bc72e16b09d8a7d25cc964d584dce23`. TSX source checksum: `c2d7994413e13eca177c9df73953ccb1cb3389cc757aecbfd81c636b7a5a408b`. 313 callsites across 34 source modules.

Browser evidence: 598 observed states across 133 named screens/forms, 15227 rendered control instances, 0 states with violations, 0 reported violations, and 0 conflicting status groups. These counts cover the rendered states below; they do not claim that every conditional source callsite was opened.

Frozen production evidence: [build manifest](redesign-screenshots/pr-c5/build-manifest.json) and [capture report](redesign-screenshots/pr-c5/capture-results.json). All 120 before/after checks for the 60 screenshots match the same HTML, JavaScript and CSS fingerprint `7430f22e293a69c0cd63e8dc56cd7738489194cec52dd46fc71ff897f2dfd7b9`. The 40 main and 14 conditional browser checks passed. Four identical state observations are counted once; the JSON retains every control instance in each distinct state.

## Complete source callsite contracts

Every source row is a required contract, not a runtime PASS. Generic labels such as Save and Cancel are never used to infer coverage of a particular callsite. Shared component implementations may generate many rendered instances.

| Screen/component | Label (English / Persian) | Style or semantic kind | Radius | Height | Width contract | Callsite |
| --- | --- | --- | --- | --- | --- | --- |
| AddDateDialog | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/AddDateDialog.tsx:227 |
| AddDateDialog | Add date / افزودن تاریخ | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/AddDateDialog.tsx:234 |
| AddDateDialog | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/AddDateDialog.tsx:352 |
| AddDateDialog | Remove / حذف | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/AddDateDialog.tsx:355 |
| AddDateDialog | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/AddDateDialog.tsx:444 |
| AddDateDialog | Stop tracking this product / توقف پیگیری این محصول | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/AddDateDialog.tsx:447 |
| App | Switch to Persian / تغییر به فارسی; Switch to English / تغییر به انگلیسی | secondary | Circle | 40 px | 40 px | src/App.tsx:253 |
| App | Hide password / پنهان کردن گذرواژه; Show password / نمایش گذرواژه | secondary | Circle | 40 px | 40 px | src/App.tsx:312 |
| App | Dynamic: &lt;Initials name={demoUserLabel(user.name, lang) .replace(/^Demo /, "") .replace(/ نمایشی$/, "")} /> &lt;span> {demoUserLabel(user.name, lang) .replace(/^Demo /, "") .replace(/ نمایشی$/, "")} &lt;/span> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:393 |
| App | Sign in / ورود | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:461 |
| App | Save password / ذخیرهٔ گذرواژه | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:555 |
| App | Sign out / خروج | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:559 |
| App | Unlock / باز کردن قفل | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:587 |
| App | Sign in as someone else / ورود به‌عنوان کاربر دیگر | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:591 |
| App | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:625 |
| App | Continue / ادامه | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:628 |
| App | Sign out / خروج از حساب | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:800 |
| App | Close menu / بستن منو | sidebar dismissal surface | Component-specific | Component-specific | Component-specific | src/App.tsx:960 |
| App | ...names / | widget | Component-specific | Component-specific | Component-specific | src/App.tsx:996 |
| App | User menu / منوی کاربر | sidebar account menu | Component-specific | Component-specific | Component-specific | src/App.tsx:1068 |
| App | Lock / قفل | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1084 |
| App | Sign out / خروج | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1088 |
| App | menuOpen ? "Close menu" : "Open menu" / menuOpen ? "بستن منو" : "باز کردن منو"; collapsed ? "Expand sidebar" : "Collapse sidebar" / collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری" | secondary | Circle | 40 px | 40 px | src/App.tsx:1097 |
| App | Switch to dark theme / تغییر به تم تیره; Switch to light theme / تغییر به تم روشن | secondary | Circle | 40 px | 40 px | src/App.tsx:1178 |
| App | Comfortable text size / اندازهٔ متن راحت | secondary | Circle | 40 px | 40 px | src/App.tsx:1192 |
| App | `Notifications, ${notifications} unread` / `اعلان‌ها، ${notifications} خوانده‌نشده` | secondary | Circle | 40 px | 40 px | src/App.tsx:1203 |
| App | Approvals / تأییدها | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1222 |
| App | Alerts / هشدارها | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1229 |
| App | Notes for Supervisor / یادداشت‌های سرپرست | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1236 |
| App | Demo / دمو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/App.tsx:1250 |
| App | Switch to / تغییر به | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1255 |
| App | Use fictional demo answer / استفاده از پاسخ نمونهٔ خیالی | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1266 |
| App | Reset demo / بازنشانی دمو | menu option | Component-specific | Component-specific | Component-specific | src/App.tsx:1277 |
| DateQuickAdd | Dynamic: &lt;ProductName product={product} language={lang} /> &lt;LtrText>{product.code}&lt;/LtrText> | option | Component-specific | Component-specific | Component-specific | src/DateQuickAdd.tsx:298 |
| DateQuickAdd | More / بیشتر | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/DateQuickAdd.tsx:346 |
| DateQuickAdd | Add / افزودن | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/DateQuickAdd.tsx:355 |
| UndoToasts | Undo / واگرد | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/UndoToasts.tsx:44 |
| Alerts | View return / نمایش مرجوعی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Alerts.tsx:195 |
| Alerts | Apply this price to all / اعمال این قیمت به همه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Alerts.tsx:232 |
| Alerts | Mark as intentional / ثبت به عنوان عمدی | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Alerts.tsx:269 |
| Alerts | View invoice / مشاهده فاکتور | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Alerts.tsx:297 |
| Alerts | View order / مشاهده سفارش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Alerts.tsx:304 |
| Alerts | Mark as taken care of / ثبت رسیدگی‌شده | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Alerts.tsx:513 |
| Alerts | Keep as pending / حفظ در انتظار | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Alerts.tsx:516 |
| Approvals | Keep approved price / حفظ قیمت تأییدشده | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Approvals.tsx:453 |
| Approvals | Propose manual override / پیشنهاد تغییر دستی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Approvals.tsx:456 |
| Approvals | Approve / تأیید; Approve product / تأیید کالا; Approve price / تأیید قیمت | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Approvals.tsx:467 |
| Approvals | Reject / رد کردن | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Approvals.tsx:479 |
| BranchRequests | New request / درخواست جدید | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:450 |
| BranchRequests | Back to requests / بازگشت به درخواست‌ها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:473 |
| BranchRequests | Add / افزودن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:574 |
| BranchRequests | Add item / افزودن مورد | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:620 |
| BranchRequests | Remove item / حذف مورد | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:672 |
| BranchRequests | Send / ارسال | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:741 |
| BranchRequests | Save as draft / ذخیره پیش‌نویس | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:744 |
| BranchRequests | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:751 |
| BranchRequests | Back to requests / بازگشت به درخواست‌ها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:758 |
| BranchRequests | Print picking list / چاپ فهرست آماده‌سازی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:782 |
| BranchRequests | Dynamic: {readable.find( (item) => item.id === request.source_request_id, )?.reference ?? request.source_request_id} | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:838 |
| BranchRequests | Short / کسری; Missing / نرسیده | { current?.decision === (sendSide ? "short" : "missing") ? "primary" : "secondary" } | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:975 |
| BranchRequests | Send / ارسال | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1040 |
| BranchRequests | Edit draft / ویرایش پیش‌نویس | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1057 |
| BranchRequests | Mark as sent / ثبت ارسال | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1066 |
| BranchRequests | Mark as received / ثبت دریافت | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1100 |
| BranchRequests | Close request / بستن درخواست | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1139 |
| BranchRequests | Copy short or missing items / کپی موارد کسری یا نرسیده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1159 |
| BranchRequests | Cancel request / لغو درخواست | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1190 |
| BranchRequests | Confirm cancellation / تأیید لغو | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1207 |
| BranchRequests | Open / باز کردن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/BranchRequests.tsx:1336 |
| Catalog | Dynamic: {lang === "fa" ? ( item.name_fa ) : ( &lt;LtrText>{item.name_en}&lt;/LtrText> )} | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:714 |
| Catalog | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:842 |
| Catalog | Add product / افزودن محصول; Save product / ذخیرهٔ محصول | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:845 |
| Catalog | `Edit ${product.name_en}` / `ویرایش ${product.name_fa}` | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:868 |
| Catalog | Scan barcode / اسکن بارکد | secondary | Circle | 40 px | 40 px | src/screens/Catalog.tsx:1627 |
| Catalog | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:1678 |
| Catalog | Clear search / پاک کردن جست‌وجو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:1695 |
| Catalog | state.config.terminology.product_code / کد محصول; No approved price yet / هنوز قیمت تأییدشده‌ای وجود ندارد; Pending / در انتظار تأیید; state.config.tax.label_text_en / state.config.tax.label_text_fa | option | Component-specific | Component-specific | Component-specific | src/screens/Catalog.tsx:1726 |
| Catalog | Add product / افزودن محصول | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:1949 |
| Catalog | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:2108 |
| Catalog | Clear filters / پاک کردن فیلترها | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:2115 |
| Catalog | Product / محصول | widget | Component-specific | Component-specific | Component-specific | src/screens/Catalog.tsx:2143 |
| Catalog | Product Code / کد محصول | widget | Component-specific | Component-specific | Component-specific | src/screens/Catalog.tsx:2162 |
| Catalog | Approved price / قیمت تأییدشده | widget | Component-specific | Component-specific | Component-specific | src/screens/Catalog.tsx:2187 |
| Catalog | Product actions / اقدامات کالا | secondary | Circle | 40 px | 40 px | src/screens/Catalog.tsx:2324 |
| Catalog | Add date / افزودن تاریخ | menu option | Component-specific | Component-specific | Component-specific | src/screens/Catalog.tsx:2336 |
| Catalog | Previous / قبلی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:2355 |
| Catalog | Next / بعدی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:2377 |
| Catalog | Back to Products / بازگشت به محصولات | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:2405 |
| Catalog | Back to Products / بازگشت به محصولات | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Catalog.tsx:2418 |
| Dashboard | Review approvals / بررسی تأییدها | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:543 |
| Dashboard | Dynamic: {`${item.label}: ${item.value}`} | KPI navigation card | Component-specific | Component-specific | Component-specific | src/screens/Dashboard.tsx:562 |
| Dashboard | Approve / تأیید | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:686 |
| Dashboard | Reject / رد کردن | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:692 |
| Dashboard | Review / بررسی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:701 |
| Dashboard | View all approvals / مشاهده همه تأییدها | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:714 |
| Dashboard | Review / بررسی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:776 |
| Dashboard | View all alerts / مشاهده همه هشدارها | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:792 |
| Dashboard | Receive an invoice / دریافت فاکتور | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:811 |
| Dashboard | View / مشاهده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:872 |
| Dashboard | View all returns / مشاهده همه مرجوعی‌ها | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:893 |
| Dashboard | View / مشاهده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:951 |
| Dashboard | View / مشاهده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:1018 |
| Dashboard | View / مشاهده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:1238 |
| Dashboard | View / مشاهده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:1316 |
| Dashboard | View / مشاهده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Dashboard.tsx:1374 |
| Expiry | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Expiry.tsx:291 |
| Expiry | Remove / حذف | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Expiry.tsx:481 |
| Expiry | More / بیشتر | secondary | Circle | 40 px | 40 px | src/screens/Expiry.tsx:492 |
| Expiry | Stop tracking this product / توقف پیگیری این محصول | menu option | Component-specific | Component-specific | Component-specific | src/screens/Expiry.tsx:504 |
| History | View corrected / نمایش اصلاح‌شده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/History.tsx:47 |
| History | More actions / کارهای بیشتر | secondary | Circle | 40 px | 40 px | src/screens/History.tsx:52 |
| History | View original / نمایش اصل | menu option | Component-specific | Component-specific | Component-specific | src/screens/History.tsx:57 |
| History | View previous version / نمایش نسخه قبلی | menu option | Component-specific | Component-specific | Component-specific | src/screens/History.tsx:65 |
| History | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/History.tsx:325 |
| History | Revert / بازگردانی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/History.tsx:421 |
| History | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/History.tsx:515 |
| History | Revert change / بازگردانی تغییر | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/History.tsx:524 |
| InvoiceCorrectionDialog | Back / بازگشت | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/InvoiceCorrectionDialog.tsx:342 |
| InvoiceCorrectionDialog | Confirm correction / تأیید اصلاح; Continue / ادامه | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/InvoiceCorrectionDialog.tsx:351 |
| InvoiceCorrectionDialog | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/InvoiceCorrectionDialog.tsx:735 |
| InvoiceCorrectionDialog | Preview correction / پیش‌نمایش اصلاح | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/InvoiceCorrectionDialog.tsx:738 |
| InvoiceOrderReview | Refresh comparison / تازه‌سازی مقایسه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/InvoiceOrderReview.tsx:240 |
| Invoices | Resume draft / ادامه پیش‌نویس | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:872 |
| Invoices | New invoice / فاکتور جدید | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:889 |
| Invoices | Receive short delivery / دریافت تحویل کسری | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:1010 |
| Invoices | New invoice / فاکتور جدید | {active && !locked ? "secondary" : "primary"} | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:1103 |
| Invoices | Dynamic: &lt;a href={`#invoices?id=${encodeURIComponent(item.id)}`} onClick={(event) => { event.preventDefault(); updateInvoice((draft) => { retainInvoiceWorkspace(draft); draft.invoice = structuredClone(item); }); chooseTab("posted", true); setDetailsOpen(false); navigate( `invoices?id=${encodeURIComponent(item.id)}`, ); }} > &lt;LtrText>{item.supplier_invoice_number}&lt;/LtrText> &lt;/a> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:1164 |
| Invoices | Upload / بارگذاری | { invoice.entry_mode === "manual" ? "secondary" : "primary" } | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:1311 |
| Invoices | Manual entry / ورود دستی | { invoice.entry_mode === "manual" ? "primary" : "secondary" } | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:1322 |
| Invoices | Invoice details / جزئیات فاکتور | section disclosure | Component-specific | Component-specific | Component-specific | src/screens/Invoices.tsx:1515 |
| Invoices | Move invoice / انتقال فاکتور | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:1539 |
| Invoices | Use suggested location / استفاده از مکان پیشنهادی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:1571 |
| Invoices | Dynamic: &lt;LtrText>{index + 1}.&lt;/LtrText> {" "} &lt;ProductName product={{ name_en: product?.name_en ?? line.new_name_en ?? line.description, name_fa: product?.name_fa ?? line.new_name_fa ?? "", }} language={lang} /> &lt;ChevronDown size={16} aria-hidden="true" /> | invoice line disclosure | Component-specific | Component-specific | Component-specific | src/screens/Invoices.tsx:2008 |
| Invoices | Add line / افزودن ردیف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:3185 |
| Invoices | + Add new product / + افزودن کالای جدید | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:3214 |
| Invoices | Save as draft / ذخیره به عنوان پیش‌نویس | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:3434 |
| Invoices | Post invoice / ثبت فاکتور | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:3447 |
| Invoices | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:3594 |
| Invoices | Move invoice / انتقال فاکتور | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Invoices.tsx:3597 |
| Labels | `Starting slot ${index + 1}` / `خانه شروع ${index + 1}` | physical sheet position | Component-specific | Component-specific | Component-specific | src/screens/Labels.tsx:526 |
| Labels | New template / قالب جدید | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:798 |
| Labels | Save template / ذخیره قالب | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:907 |
| Labels | Print test alignment page / چاپ برگه تنظیم آزمایشی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:910 |
| Labels | Duplicate template / کپی قالب | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:918 |
| Labels | Restore template / بازیابی قالب; Archive template / بایگانی قالب | {draft.archived ? "secondary" : "danger"} | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:927 |
| Labels | Save changes / ذخیره تغییرات | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1065 |
| Labels | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1387 |
| Labels | Add {{count}} product to waitlist / Add {{count}} products to waitlist / افزودن {{count}} کالا به فهرست انتظار / افزودن {{count}} کالا به فهرست انتظار | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1515 |
| Labels | Clear waitlist / پاک کردن فهرست انتظار | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1584 |
| Labels | Remove / حذف از فهرست | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1691 |
| Labels | Print labels / چاپ برچسب‌ها | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1816 |
| Labels | No / خیر | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1866 |
| Labels | Yes / بله | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Labels.tsx:1876 |
| NotebookSettings | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/NotebookSettings.tsx:271 |
| NotebookSettings | Save notebook / ذخیره دفترچه | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/NotebookSettings.tsx:278 |
| NotebookSettings | New notebook / دفترچه جدید | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/NotebookSettings.tsx:310 |
| NotebookSettings | Edit notebook / ویرایش دفترچه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/NotebookSettings.tsx:378 |
| NotebookSettings | Restore notebook / بازیابی دفترچه; Archive notebook / بایگانی دفترچه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/NotebookSettings.tsx:386 |
| Notes | Add note / افزودن یادداشت | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:270 |
| Notes | New notebook / دفترچه جدید | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:283 |
| Notes | Edit notebook / ویرایش دفترچه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:322 |
| Notes | Archive notebook / بایگانی دفترچه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:326 |
| Notes | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:542 |
| Notes | Save changes / ذخیره تغییرات; Save note / ذخیره یادداشت | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:552 |
| Notes | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:618 |
| Notes | Mark seen / علامت دیده‌شده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:702 |
| Notes | Mark ordered / علامت سفارش‌داده‌شده; Mark done / علامت انجام‌شده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:719 |
| Notes | Edit note / ویرایش یادداشت | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:814 |
| Notes | Mark open / علامت باز; Mark done / علامت انجام‌شده | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Notes.tsx:840 |
| Offers | Create offer / ایجاد پیشنهاد | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Offers.tsx:292 |
| Offers | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Offers.tsx:424 |
| Offers | Confirm offer / تأیید پیشنهاد | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Offers.tsx:540 |
| Offers | Dismiss / کنار گذاشتن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Offers.tsx:548 |
| Offers | Stop offer / توقف پیشنهاد | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Offers.tsx:701 |
| Offers | More / بیشتر | secondary | Circle | 40 px | 40 px | src/screens/Offers.tsx:709 |
| Offers | Stop offer / توقف پیشنهاد | menu option | Component-specific | Component-specific | Component-specific | src/screens/Offers.tsx:722 |
| Offers | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Offers.tsx:945 |
| Offers | Create offer / ایجاد پیشنهاد | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Offers.tsx:948 |
| Orders | Back to Orders / بازگشت به سفارش‌ها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:616 |
| Orders | New order / سفارش جدید | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:621 |
| Orders | New item / کالای جدید | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:722 |
| Orders | Remove / حذف | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:918 |
| Orders | Save as draft / ذخیره پیش‌نویس | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1080 |
| Orders | Place order / ثبت سفارش | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1083 |
| Orders | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1086 |
| Orders | Remove note from order / حذف یادداشت از سفارش | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1121 |
| Orders | Add to order / افزودن به سفارش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1145 |
| Orders | Edit draft / ویرایش پیش‌نویس | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1225 |
| Orders | Place order / ثبت سفارش | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1231 |
| Orders | Print order / چاپ سفارش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1250 |
| Orders | Cancel order / لغو سفارش | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1260 |
| Orders | Dynamic: &lt;LtrText> {[...(state.invoices ?? []), state.invoice].find( (invoice) => invoice.id === id, )?.supplier_invoice_number ?? id} &lt;/LtrText> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1416 |
| Orders | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1532 |
| Orders | Dynamic: &lt;LtrText>{order.reference}&lt;/LtrText> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1577 |
| Orders | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1691 |
| Orders | Add item / افزودن کالا | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1694 |
| Orders | Keep order / نگه داشتن سفارش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1720 |
| Orders | Cancel order / لغو سفارش | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1723 |
| Orders | Close / بستن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1763 |
| Orders | Print / چاپ | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Orders.tsx:1766 |
| OriginalInvoice | Attach original / پیوست اصل فاکتور | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/OriginalInvoice.tsx:178 |
| OriginalInvoice | Zoom out / کوچک‌نمایی | secondary | Circle | 40 px | 40 px | src/screens/OriginalInvoice.tsx:193 |
| OriginalInvoice | Zoom in / بزرگ‌نمایی | secondary | Circle | 40 px | 40 px | src/screens/OriginalInvoice.tsx:203 |
| OriginalInvoice | Fit width / اندازه عرض | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/OriginalInvoice.tsx:210 |
| OriginalInvoice | Fit page / اندازه صفحه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/OriginalInvoice.tsx:213 |
| OriginalInvoice | Download / دانلود | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/OriginalInvoice.tsx:216 |
| OriginalInvoice | Previous page / صفحه قبل | secondary | Circle | 40 px | 40 px | src/screens/OriginalInvoice.tsx:223 |
| OriginalInvoice | Next page / صفحه بعد | secondary | Circle | 40 px | 40 px | src/screens/OriginalInvoice.tsx:236 |
| Payables | Record external payment / ثبت پرداخت خارج از برنامه | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:340 |
| Payables | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:400 |
| Payables | Print summary / چاپ خلاصه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:518 |
| Payables | Export CSV / خروجی CSV | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:525 |
| Payables | Record opening balance, credit, or adjustment / ثبت مانده افتتاحیه، بستانکاری یا تعدیل | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:532 |
| Payables | View all suppliers / مشاهده همه تأمین‌کنندگان | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:544 |
| Payables | View return / نمایش مرجوعی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:611 |
| Payables | Dynamic: &lt;a href={`#return?id=${encodeURIComponent(claim.return_id)}&memo=${encodeURIComponent(claim.reference)}`} > &lt;LtrText>{claim.reference}&lt;/LtrText> &lt;/a> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:620 |
| Payables | Preview oldest-due allocations / پیش‌نمایش تخصیص به قدیمی‌ترین سررسید | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:702 |
| Payables | Confirm and record payment / تأیید و ثبت پرداخت | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:775 |
| Payables | Record ledger entry / ثبت ردیف دفتر | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:875 |
| Payables | Record dispute / ثبت اختلاف | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:901 |
| Payables | Close / بستن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:926 |
| Payables | Record dispute / ثبت اختلاف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Payables.tsx:1102 |
| PostedInvoice | Correct invoice / اصلاح فاکتور | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PostedInvoice.tsx:117 |
| PostedInvoice | Move invoice / انتقال فاکتور | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PostedInvoice.tsx:120 |
| PostedInvoice | Original invoice / اصل فاکتور; Correction / اصلاح | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PostedInvoice.tsx:406 |
| PricingSettings | Add category / افزودن دسته | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:335 |
| PricingSettings | Edit / ویرایش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:446 |
| PricingSettings | Restore / بازگردانی; Archive / بایگانی | {category.archived ? "secondary" : "danger"} | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:453 |
| PricingSettings | Remove / برداشتن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:643 |
| PricingSettings | Add correction / افزودن اصلاح | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:660 |
| PricingSettings | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:803 |
| PricingSettings | Save changes / ذخیره تغییرات | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:815 |
| PricingSettings | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:986 |
| PricingSettings | Apply category / اعمال دسته | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/PricingSettings.tsx:989 |
| Received | Dynamic: &lt;LtrText>{receipt.invoice_number}&lt;/LtrText> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Received.tsx:151 |
| Received | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Received.tsx:312 |
| Returns | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:429 |
| Returns | Dynamic: &lt;a href={detailHref(record)}>{action}&lt;/a> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:527 |
| Returns | Print / چاپ | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:581 |
| Returns | Download full policy / دانلود سیاست کامل | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:708 |
| Returns | Close / بستن | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:725 |
| Returns | Return policy / سیاست مرجوعی | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:782 |
| Returns | Record pickup / ثبت جمع‌آوری; Record resolution / ثبت حل‌وفصل | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:792 |
| Returns | Review cancellation / بررسی لغو | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:807 |
| Returns | Review claim / بررسی ادعا | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:822 |
| Returns | Dynamic: &lt;LtrText>{item.reference}&lt;/LtrText> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:845 |
| Returns | Record pickup / ثبت جمع‌آوری | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:969 |
| Returns | Request cancellation / درخواست لغو; Cancel return / لغو مرجوعی | danger | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:976 |
| Returns | Record pickup / ثبت جمع‌آوری; Record cancellation disposition / ثبت وضعیت لغو; Receive replacement / دریافت جایگزین; Submit claim / ارسال ادعا | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:1473 |
| Returns | Close / بستن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:1558 |
| Returns | Verify and post claim / تأیید و ثبت ادعا | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:1614 |
| Returns | Approve cancellation / تأیید لغو | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:1669 |
| Returns | Decline cancellation / رد لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Returns.tsx:1688 |
| ReturnsSettings | Save changes / ذخیره تغییرات | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/ReturnsSettings.tsx:59 |
| Settings | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:268 |
| Settings | Save changes / ذخیره تغییرات | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:271 |
| Settings | Add location / افزودن مکان | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:583 |
| Settings | Edit / ویرایش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:646 |
| Settings | Reactivate / فعال‌سازی دوباره; Deactivate / غیرفعال کردن | {branch.active === false ? "secondary" : "danger"} | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:664 |
| Settings | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:807 |
| Settings | Save changes / ذخیره تغییرات | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:810 |
| Settings | Remove / برداشتن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:930 |
| Settings | Add mapping / افزودن نگاشت | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Settings.tsx:947 |
| Settings | ...item.label / | settings-navigation | Component-specific | Component-specific | Component-specific | src/screens/Settings.tsx:1146 |
| SupplierApproval | Approve / تأیید; Confirm supplier / تأیید تأمین‌کننده | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierApproval.tsx:116 |
| SupplierApproval | Reject / رد کردن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierApproval.tsx:121 |
| SupplierEditor | Dynamic: &lt;LtrText>{record.name}&lt;/LtrText> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierEditor.tsx:277 |
| SupplierEditor | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierEditor.tsx:306 |
| SupplierEditor | Save supplier / ذخیرهٔ تأمین‌کننده; Add supplier / افزودن تأمین‌کننده | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierEditor.tsx:309 |
| SupplierItems | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:98 |
| SupplierItems | Add item / افزودن کالا | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:106 |
| SupplierItems | Dynamic: &lt;LtrText> {row.last_invoice_number \|\| row.last_invoice_id} &lt;/LtrText> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:216 |
| SupplierItems | History / تاریخچه | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:237 |
| SupplierItems | Edit / ویرایش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:248 |
| SupplierItems | Dynamic: &lt;LtrText>{purchase.invoice_number}&lt;/LtrText> | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:341 |
| SupplierItems | Close / بستن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:378 |
| SupplierItems | Save item / ذخیره کالا; Add item / افزودن کالا | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:564 |
| SupplierItems | Cancel / لغو | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierItems.tsx:567 |
| SupplierReturnsPanel | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/SupplierReturnsPanel.tsx:124 |
| Suppliers | `Sort by ${en.toLowerCase()}` / `مرتب‌سازی بر اساس ${fa}` | column sorting | Component-specific | Component-specific | Component-specific | src/screens/Suppliers.tsx:245 |
| Suppliers | Add supplier / افزودن تأمین‌کننده | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Suppliers.tsx:272 |
| Suppliers | en / fa | filter choice | Component-specific | Component-specific | Component-specific | src/screens/Suppliers.tsx:334 |
| Suppliers | Clear filters / پاک کردن فیلترها | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Suppliers.tsx:350 |
| Suppliers | Back to Suppliers / بازگشت به تأمین‌کنندگان | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Suppliers.tsx:491 |
| Suppliers | Back to Suppliers / بازگشت به تأمین‌کنندگان | quiet | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Suppliers.tsx:513 |
| Suppliers | Edit / ویرایش | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Suppliers.tsx:527 |
| Suppliers | Deactivate / غیرفعال کردن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/Suppliers.tsx:531 |
| WeighedItemsSettings | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/WeighedItemsSettings.tsx:65 |
| WeighedItemsSettings | Save changes / ذخیره تغییرات | primary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/screens/WeighedItemsSettings.tsx:74 |
| ui | Columns / ستون‌ها | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:693 |
| ui | Reset columns / بازنشانی ستون‌ها | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:716 |
| ui | Close / بستن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:719 |
| ui | Cancel / انصراف | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:868 |
| ui | Dynamic: {confirmLabel} | {confirmVariant} | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:871 |
| ui | Choose an option / یک گزینه انتخاب کنید | combobox | Component-specific | Component-specific | Component-specific | src/ui.tsx:1102 |
| ui | Dynamic: &lt;span> &lt;bdi dir="auto">{option.label}&lt;/bdi> &lt;/span> {option.value === value && ( &lt;Check size={16} strokeWidth={1.5} aria-hidden="true" /> )} | option | Component-specific | Component-specific | Component-specific | src/ui.tsx:1181 |
| ui | Dynamic: &lt;span className="ui-checkbox-box" aria-hidden="true"> {checked && &lt;Check size={14} strokeWidth={2} />} &lt;/span> {children && &lt;span>{children}&lt;/span>} | checkbox | Component-specific | Component-specific | Component-specific | src/ui.tsx:1232 |
| ui | Dynamic: &lt;span className="ui-radio-box" aria-hidden="true" /> {children && &lt;span>{children}&lt;/span>} | radio | Component-specific | Component-specific | Component-specific | src/ui.tsx:1255 |
| ui | Dynamic: &lt;span className="ui-switch-track" aria-hidden="true"> &lt;span /> &lt;/span> {children && &lt;span>{children}&lt;/span>} | switch | Component-specific | Component-specific | Component-specific | src/ui.tsx:1312 |
| ui | Choose date / تاریخ را انتخاب کنید | date picker trigger | Component-specific | Component-specific | Component-specific | src/ui.tsx:1463 |
| ui | Previous month / ماه قبل | quiet | Circle | 40 px | 40 px | src/ui.tsx:1505 |
| ui | Next month / ماه بعد | quiet | Circle | 40 px | 40 px | src/ui.tsx:1523 |
| ui | Dynamic: {dateLabel(day)} | calendar day | Component-specific | Component-specific | Component-specific | src/ui.tsx:1564 |
| ui | Today / امروز | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:1627 |
| ui | Clear / پاک کردن | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:1639 |
| ui | Remove file / حذف فایل | quiet | Circle | 40 px | 40 px | src/ui.tsx:1755 |
| ui | Browse / انتخاب فایل | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:1783 |
| ui | Take photo / گرفتن عکس | secondary | 12 px | 40 px | Intrinsic text + padding; table actions ≤200 px | src/ui.tsx:1791 |
| ui | Dynamic: Accessible label supplied by props | {props.variant ?? "secondary"} | Circle | 40 px | 40 px | src/ui.tsx:1816 |
| ui | Dynamic: {icon ?? null} {iconOnly && typeof label === "string" ? ( &lt;span className="sr-only">{label}&lt;/span> ) : ( label )} {showChevron && !icon && !iconOnly && ( &lt;ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" /> )} | secondary | 12 px text / circle icon | 40 px | Intrinsic text + padding / 40 px icon | src/ui.tsx:1867 |
| ui | Dynamic: {children} | menu option | Component-specific | Component-specific | Component-specific | src/ui.tsx:1963 |
| ui | Dynamic: { option.count && option.count > 0 ? `${option.label} ${option.count}` : undefined } | tab or segmented choice | Component-specific | Component-specific | Component-specific | src/ui.tsx:2043 |
| ui | Dynamic: {content} | KPI navigation card | Component-specific | Component-specific | Component-specific | src/ui.tsx:2133 |

## Semantic widgets (separate from ordinary text actions)

These controls retain the layout required by their interaction: calendar cells select dates, sorting headers sort columns, result rows navigate/select records, physical sheet slots choose a print starting position, and segmented choices switch states. Each callsite above and measured instance below remains visible in the audit; this list does not exempt an ordinary action solely because it appears inside a widget.

The four generic `widget` source markers have precise purposes: `src/App.tsx:996` opens or closes a sidebar navigation group; `src/screens/Catalog.tsx:2143`, `:2162` and `:2187` sort Product, Product Code and Approved price. Their actual dimensions remain listed below. Source expressions such as `...names` identify dynamic translated copy rather than literal on-screen English.

| Semantic kind | Callsites |
| --- | --- |
| KPI navigation card | src/screens/Dashboard.tsx:562; src/ui.tsx:2133 |
| calendar day | src/ui.tsx:1564 |
| checkbox | src/ui.tsx:1232 |
| column sorting | src/screens/Suppliers.tsx:245 |
| combobox | src/ui.tsx:1102 |
| date picker trigger | src/ui.tsx:1463 |
| filter choice | src/screens/Suppliers.tsx:334 |
| invoice line disclosure | src/screens/Invoices.tsx:2008 |
| menu option | src/App.tsx:1084; src/App.tsx:1088; src/App.tsx:1222; src/App.tsx:1229; src/App.tsx:1236; src/App.tsx:1255; src/App.tsx:1266; src/App.tsx:1277; src/screens/Catalog.tsx:2336; src/screens/Expiry.tsx:504; src/screens/History.tsx:57; src/screens/History.tsx:65; src/screens/Offers.tsx:722; src/ui.tsx:1963 |
| option | src/DateQuickAdd.tsx:298; src/screens/Catalog.tsx:1726; src/ui.tsx:1181 |
| physical sheet position | src/screens/Labels.tsx:526 |
| radio | src/ui.tsx:1255 |
| section disclosure | src/screens/Invoices.tsx:1515 |
| settings-navigation | src/screens/Settings.tsx:1146 |
| sidebar account menu | src/App.tsx:1068 |
| sidebar dismissal surface | src/App.tsx:960 |
| switch | src/ui.tsx:1312 |
| tab or segmented choice | src/ui.tsx:2043 |
| widget | src/App.tsx:996; src/screens/Catalog.tsx:2143; src/screens/Catalog.tsx:2162; src/screens/Catalog.tsx:2187 |

## Actual rendered controls

These are computed styles and bounding rectangles after fonts and transitions settled. Equivalent repeated controls are grouped; the JSON retains every measured instance. Semantic widgets are listed with their real component-specific shape. A conditional source callsite absent from these scenes is source-only, not silently claimed as exercised.

### Settings: Company

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| YYYY-MM-DD | combobox / combobox | 12px | 45 | 155.28 | desktop-en-light, desktop-en-dark, desktop-fa-light, phone-en-light, phone-en-dark, phone-fa-light / supervisor | 6 |
| Normal | combobox / combobox | 12px | 45 | 142.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| English | switch / switch | 6px | 40 | 93.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Persian | switch / switch | 6px | 40 | 95.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| معمولی | combobox / combobox | 12px | 45 | 102.86 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انگلیسی | switch / switch | 6px | 40 | 90.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فارسی | switch / switch | 6px | 40 | 79.89 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب فایل | secondary / action | 12px | 40 | 87.75 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 88.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.81 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |
| گرفتن عکس | secondary / action | 12px | 40 | 113.17 | phone-fa-light / supervisor | 1 |

### Settings: Branches

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Add location | primary / action | 12px | 40 | 144.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Deactivate | danger / action | 12px | 40 | 88.44 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| افزودن مکان | primary / action | 12px | 40 | 129.78 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| غیرفعال کردن | danger / action | 12px | 40 | 92.23 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 87.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.28 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: People

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 70.42 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 62.39 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: Catalog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Add category | primary / action | 12px | 40 | 124.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Archive | danger / action | 12px | 40 | 69.47 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Remove | secondary / action | 12px | 40 | 87.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Add correction | secondary / action | 12px | 40 | 133.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Each | combobox / combobox | 12px | 45 | 106.09 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Grocery | combobox / combobox | 12px | 45 | 144 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| افزودن دسته | primary / action | 12px | 40 | 106.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| بایگانی | danger / action | 12px | 40 | 55.95 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| برداشتن | secondary / action | 12px | 40 | 79.2 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| افزودن اصلاح | secondary / action | 12px | 40 | 108.95 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عدد | combobox / combobox | 12px | 45 | 81.45 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مواد غذایی | combobox / combobox | 12px | 45 | 144 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 76.36 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| Grocery | combobox / combobox | 12px | 45 | 178.89 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 65.64 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |
| مواد غذایی | combobox / combobox | 12px | 45 | 217.13 | phone-fa-light / supervisor | 1 |

### Settings: Pricing and approvals

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| lb | combobox / combobox | 12px | 45 | 75.97 | desktop-en-light, desktop-en-dark, desktop-fa-light, phone-en-light, phone-en-dark, phone-fa-light / supervisor | 6 |
| Show second unit | switch / switch | 6px | 72.5 | 338 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Use rounding bands | switch / switch | 6px | 40 | 338 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| نمایش واحد دوم | switch / switch | 6px | 72.5 | 338 | desktop-fa-light / supervisor | 1 |
| استفاده از بازه‌های گرد کردن | switch / switch | 6px | 40 | 338 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 170.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| Show second unit | switch / switch | 6px | 40 | 318 | phone-en-light, phone-en-dark / supervisor | 2 |
| Use rounding bands | switch / switch | 6px | 40 | 318 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 142.59 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |
| نمایش واحد دوم | switch / switch | 6px | 40 | 318 | phone-fa-light / supervisor | 1 |
| استفاده از بازه‌های گرد کردن | switch / switch | 6px | 40 | 318 | phone-fa-light / supervisor | 1 |

### Settings: Offers

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Remove | secondary / action | 12px | 40 | 87.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 12 |
| Add mapping | secondary / action | 12px | 40 | 123.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| AI offer suggestions | switch / switch | 6px | 40 | 178.95 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| برداشتن | secondary / action | 12px | 40 | 79.2 | desktop-fa-light, phone-fa-light / supervisor | 6 |
| افزودن نگاشت | secondary / action | 12px | 40 | 114.88 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیشنهاد تخفیف هوش مصنوعی | switch / switch | 6px | 40 | 219.3 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 66.27 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.91 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: Taxes

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 63.91 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.92 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: Receiving

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 90.55 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 85.75 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: Returns/date tracking/labels

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Deduct expected credit at pickup | checkbox / checkbox | 6px | 40 | 251.53 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save changes | primary / action | 12px | 40 | 127.83 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Add products automatically when a new price is approved | checkbox / checkbox | 6px | 40 | 415.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Product name | checkbox / checkbox | 6px | 40 | 124.31 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Description | checkbox / checkbox | 6px | 40 | 107.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Selling price | checkbox / checkbox | 6px | 40 | 113.66 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Offer | checkbox / checkbox | 6px | 40 | 65.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Product Code | checkbox / checkbox | 6px | 40 | 123.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Logo | checkbox / checkbox | 6px | 40 | 65.3 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Unit size | checkbox / checkbox | 6px | 40 | 89.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Tax indicator | checkbox / checkbox | 6px | 40 | 117.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| English | checkbox / checkbox | 6px | 40 | 79.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Persian | checkbox / checkbox | 6px | 40 | 81.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular | combobox / combobox | 12px | 45 | 183.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New template | secondary / action | 12px | 40 | 126.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Show archived | checkbox / checkbox | 6px | 40 | 129.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular | combobox / combobox | 12px | 45 | 110.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save template | primary / action | 12px | 40 | 128.78 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print test alignment page | secondary / action | 12px | 40 | 201.17 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Duplicate template | secondary / action | 12px | 40 | 159.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Archive template | danger / action | 12px | 40 | 147.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کسر اعتبار مورد انتظار هنگام جمع‌آوری | checkbox / checkbox | 6px | 40 | 240.91 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره تغییرات | primary / action | 12px | 40 | 114.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن خودکار کالا پس از تأیید قیمت جدید | checkbox / checkbox | 6px | 40 | 266.73 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نام کالا | checkbox / checkbox | 6px | 40 | 69.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| توضیحات | checkbox / checkbox | 6px | 40 | 84.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قیمت فروش | checkbox / checkbox | 6px | 40 | 102.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیشنهاد | checkbox / checkbox | 6px | 40 | 75.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کد کالا | checkbox / checkbox | 6px | 40 | 67.27 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نشان | checkbox / checkbox | 6px | 40 | 60.95 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه واحد | checkbox / checkbox | 6px | 40 | 90.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نشان مالیات | checkbox / checkbox | 6px | 40 | 100.86 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انگلیسی | checkbox / checkbox | 6px | 40 | 76.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فارسی | checkbox / checkbox | 6px | 40 | 65.89 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عادی | combobox / combobox | 12px | 45 | 177.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قالب جدید | secondary / action | 12px | 40 | 94.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمایش بایگانی‌شده‌ها | checkbox / checkbox | 6px | 40 | 147.56 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عادی | combobox / combobox | 12px | 45 | 87.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره قالب | primary / action | 12px | 40 | 98.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ برگه تنظیم آزمایشی | secondary / action | 12px | 40 | 169.5 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کپی قالب | secondary / action | 12px | 40 | 87.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بایگانی قالب | danger / action | 12px | 40 | 101.66 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خانه شروع 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 216.3 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| Add products automatically when a new price is approved | checkbox / checkbox | 6px | 50 | 318 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 192.52 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |
| خانه شروع 1 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |

### Settings: Notes

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| New notebook | primary / action | 12px | 40 | 155.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit notebook | secondary / action | 12px | 40 | 133.66 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Archive notebook | secondary / action | 12px | 40 | 157.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دفترچه جدید | primary / action | 12px | 40 | 130.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش دفترچه | secondary / action | 12px | 40 | 126.27 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بایگانی دفترچه | secondary / action | 12px | 40 | 122.05 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 63.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 87.55 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: Notifications

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 110.67 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 66.83 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: Modules

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Invoices | switch / switch | 6px | 40 | 100.77 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Suppliers | switch / switch | 6px | 40 | 108.02 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns | switch / switch | 6px | 40 | 96.98 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Labels | switch / switch | 6px | 40 | 89.3 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Date tracking | switch / switch | 6px | 40 | 134.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | switch / switch | 6px | 40 | 84.94 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payables | switch / switch | 6px | 40 | 105.78 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Allow Floor Workers to use Orders | switch / switch | 6px | 40 | 272.41 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| فاکتورها | switch / switch | 6px | 40 | 90.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کنندگان | switch / switch | 6px | 40 | 119.72 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها | switch / switch | 6px | 40 | 103.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| برچسب‌ها | switch / switch | 6px | 40 | 102.05 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیگیری تاریخ | switch / switch | 6px | 40 | 115.52 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | switch / switch | 6px | 40 | 108.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| حساب‌های پرداختنی | switch / switch | 6px | 40 | 157.78 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اجازه استفاده از سفارش‌ها به کارکنان فروشگاه | switch / switch | 6px | 40 | 296.59 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 82.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.86 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 60.56 | phone-fa-light / supervisor | 1 |

### Settings: Data

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light, phone-en-dark / supervisor | 2 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light, phone-en-dark / supervisor | 2 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light, phone-en-dark / supervisor | 2 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light, phone-en-dark / supervisor | 2 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light, phone-en-dark / supervisor | 2 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light, phone-en-dark / supervisor | 2 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light, phone-en-dark / supervisor | 2 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light, phone-en-dark / supervisor | 2 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light, phone-en-dark / supervisor | 2 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 55.2 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| شرکت | settings-navigation / settings-navigation | 12px | 40 | 58.38 | phone-fa-light / supervisor | 1 |
| شعب | settings-navigation / settings-navigation | 12px | 40 | 56.06 | phone-fa-light / supervisor | 1 |
| کارکنان | settings-navigation / settings-navigation | 12px | 40 | 61.45 | phone-fa-light / supervisor | 1 |
| کاتالوگ | settings-navigation / settings-navigation | 12px | 40 | 64.7 | phone-fa-light / supervisor | 1 |
| قیمت‌گذاری و تأییدها | settings-navigation / settings-navigation | 12px | 40 | 140.89 | phone-fa-light / supervisor | 1 |
| پیشنهادها | settings-navigation / settings-navigation | 12px | 40 | 81.19 | phone-fa-light / supervisor | 1 |
| مالیات | settings-navigation / settings-navigation | 12px | 40 | 60.16 | phone-fa-light / supervisor | 1 |
| دریافت کالا | settings-navigation / settings-navigation | 12px | 40 | 84.53 | phone-fa-light / supervisor | 1 |
| مرجوعی/پیگیری تاریخ/برچسب | settings-navigation / settings-navigation | 12px | 40 | 190.03 | phone-fa-light / supervisor | 1 |
| یادداشت‌ها | settings-navigation / settings-navigation | 12px | 40 | 86.13 | phone-fa-light / supervisor | 1 |
| اعلان‌ها | settings-navigation / settings-navigation | 12px | 40 | 65.86 | phone-fa-light / supervisor | 1 |
| بخش‌ها | settings-navigation / settings-navigation | 12px | 40 | 68.39 | phone-fa-light / supervisor | 1 |
| داده‌ها | settings-navigation / settings-navigation | 12px | 40 | 61.75 | phone-fa-light / supervisor | 1 |

### Add location dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Add location | primary / action | 12px | 40 | 144.19 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 8 |
| Deactivate | danger / action | 12px | 40 | 88.44 | desktop-en-light, phone-en-light / supervisor | 8 |
| Store | combobox / combobox | 12px | 45 | 134.66 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sells to customers | switch / switch | 6px | 71.5 | 326 | desktop-en-light / supervisor | 1 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save changes | primary / action | 12px | 40 | 127.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 87.97 | phone-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light / supervisor | 1 |
| Sells to customers | switch / switch | 6px | 40 | 310 | phone-en-light / supervisor | 1 |

### Edit location dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Add location | primary / action | 12px | 40 | 144.19 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 8 |
| Deactivate | danger / action | 12px | 40 | 88.44 | desktop-en-light, phone-en-light / supervisor | 8 |
| Store | combobox / combobox | 12px | 45 | 134.66 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sells to customers | switch / switch | 6px | 71.5 | 326 | desktop-en-light / supervisor | 1 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save changes | primary / action | 12px | 40 | 127.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 87.97 | phone-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light / supervisor | 1 |
| Sells to customers | switch / switch | 6px | 40 | 310 | phone-en-light / supervisor | 1 |

### Add pricing category dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Add category | primary / action | 12px | 40 | 124.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 8 |
| Archive | danger / action | 12px | 40 | 69.47 | desktop-en-light, phone-en-light / supervisor | 8 |
| Remove | secondary / action | 12px | 40 | 87.73 | desktop-en-light, phone-en-light / supervisor | 4 |
| Add correction | secondary / action | 12px | 40 | 133.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Each | combobox / combobox | 12px | 45 | 106.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Grocery | combobox / combobox | 12px | 45 | 144 | desktop-en-light / supervisor | 1 |
| Configured bands | combobox / combobox | 12px | 45 | 202.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Non-taxable | combobox / combobox | 12px | 45 | 141.8 | desktop-en-light, phone-en-light / supervisor | 2 |
| Minimum margin active | switch / switch | 6px | 40 | 199.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Special corrections | switch / switch | 6px | 40 | 173.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Date tracking prompt | switch / switch | 6px | 40 | 185.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Apply category | primary / action | 12px | 40 | 136.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 76.36 | phone-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 62.94 | phone-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light / supervisor | 1 |
| Grocery | combobox / combobox | 12px | 45 | 178.89 | phone-en-light / supervisor | 1 |

### New notebook dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 53.78 | 200 | desktop-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 200 | desktop-en-light / supervisor | 1 |
| New notebook | primary / action | 12px | 40 | 155.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit notebook | secondary / action | 12px | 40 | 133.66 | desktop-en-light, phone-en-light / supervisor | 2 |
| Archive notebook | secondary / action | 12px | 40 | 157.55 | desktop-en-light, phone-en-light / supervisor | 2 |
| All branches | combobox / combobox | 12px | 45 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supervisor | checkbox / checkbox | 6px | 40 | 224 | desktop-en-light / supervisor | 2 |
| Floor Worker | checkbox / checkbox | 6px | 40 | 224 | desktop-en-light / supervisor | 2 |
| Cashier | checkbox / checkbox | 6px | 40 | 224 | desktop-en-light / supervisor | 2 |
| Product | checkbox / checkbox | 6px | 40 | 83.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Quantity | checkbox / checkbox | 6px | 40 | 87.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Date | checkbox / checkbox | 6px | 40 | 62.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Measurement | checkbox / checkbox | 6px | 40 | 122.95 | desktop-en-light, phone-en-light / supervisor | 2 |
| Use Open / Done statuses | checkbox / checkbox | 6px | 40 | 205.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notify Supervisor | checkbox / checkbox | 6px | 40 | 147.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save notebook | primary / action | 12px | 40 | 133.64 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Company | settings-navigation / settings-navigation | 12px | 40 | 87.39 | phone-en-light / supervisor | 1 |
| Branches | settings-navigation / settings-navigation | 12px | 40 | 86.41 | phone-en-light / supervisor | 1 |
| People | settings-navigation / settings-navigation | 12px | 40 | 69.56 | phone-en-light / supervisor | 1 |
| Catalog | settings-navigation / settings-navigation | 12px | 40 | 74.97 | phone-en-light / supervisor | 1 |
| Pricing and approvals | settings-navigation / settings-navigation | 12px | 40 | 167.17 | phone-en-light / supervisor | 1 |
| Offers | settings-navigation / settings-navigation | 12px | 40 | 64.94 | phone-en-light / supervisor | 1 |
| Taxes | settings-navigation / settings-navigation | 12px | 40 | 62.77 | phone-en-light / supervisor | 1 |
| Receiving | settings-navigation / settings-navigation | 12px | 40 | 88.64 | phone-en-light / supervisor | 1 |
| Returns/date tracking/labels | settings-navigation / settings-navigation | 12px | 40 | 210.45 | phone-en-light / supervisor | 1 |
| Notes | settings-navigation / settings-navigation | 12px | 40 | 63.94 | phone-en-light / supervisor | 1 |
| Notifications | settings-navigation / settings-navigation | 12px | 40 | 107.52 | phone-en-light / supervisor | 1 |
| Modules | settings-navigation / settings-navigation | 12px | 40 | 80.84 | phone-en-light / supervisor | 1 |
| Data | settings-navigation / settings-navigation | 12px | 40 | 54.48 | phone-en-light / supervisor | 1 |
| Supervisor | checkbox / checkbox | 6px | 40 | 310 | phone-en-light / supervisor | 2 |
| Floor Worker | checkbox / checkbox | 6px | 40 | 310 | phone-en-light / supervisor | 2 |
| Cashier | checkbox / checkbox | 6px | 40 | 310 | phone-en-light / supervisor | 2 |

### Labels Products

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Waitlist | tab / tab | 999px | 40 | 74.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Arrived today | checkbox / checkbox | 6px | 44 | 121.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price changed recently | checkbox / checkbox | 6px | 44 | 185.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| On offer | checkbox / checkbox | 6px | 44 | 86.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Pricing category | combobox / combobox | 12px | 44 | 199.88 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select all filtered | checkbox / checkbox | 6px | 40 | 142.34 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0001 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0002 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0003 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0004 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0005 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0006 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0007 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0008 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0009 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0010 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0011 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0012 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0013 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0014 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0016 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Select product 0015 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاها | tab / tab | 999px | 40 | 59 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فهرست انتظار | tab / tab | 999px | 40 | 100.25 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قالب‌ها | tab / tab | 999px | 40 | 67.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| رسیده امروز | checkbox / checkbox | 6px | 44 | 96.48 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قیمت اخیراً تغییر کرده | checkbox / checkbox | 6px | 44 | 154.25 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای پیشنهاد | checkbox / checkbox | 6px | 44 | 106.47 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دسته قیمت‌گذاری | combobox / combobox | 12px | 44 | 217.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دسته هوش مصنوعی | combobox / combobox | 12px | 44 | 229.27 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب همه نتایج فیلترشده | checkbox / checkbox | 6px | 40 | 184.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0001 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0002 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0003 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0004 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0005 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0006 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0007 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0008 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0009 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0010 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0011 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0012 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0013 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0014 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0016 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب کالای 0015 | checkbox / checkbox | 6px | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Labels ^Waitlist

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Waitlist | tab / tab | 999px | 40 | 74.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear waitlist | danger / action | 12px | 40 | 120.47 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular | combobox / combobox | 12px | 45 | 183.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Print labels | primary / action | 12px | 40 | 108.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاها | tab / tab | 999px | 40 | 59 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فهرست انتظار | tab / tab | 999px | 40 | 100.25 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قالب‌ها | tab / tab | 999px | 40 | 67.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فهرست انتظار | danger / action | 12px | 40 | 165.41 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عادی | combobox / combobox | 12px | 45 | 177.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خانه شروع 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| چاپ برچسب‌ها | primary / action | 12px | 40 | 119.78 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| خانه شروع 1 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |

### Labels ^Templates$

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Waitlist | tab / tab | 999px | 40 | 74.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular | combobox / combobox | 12px | 45 | 183.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New template | secondary / action | 12px | 40 | 126.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Show archived | checkbox / checkbox | 6px | 40 | 129.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular | combobox / combobox | 12px | 45 | 110.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save template | primary / action | 12px | 40 | 128.78 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print test alignment page | secondary / action | 12px | 40 | 201.17 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Duplicate template | secondary / action | 12px | 40 | 159.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Archive template | danger / action | 12px | 40 | 147.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاها | tab / tab | 999px | 40 | 59 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فهرست انتظار | tab / tab | 999px | 40 | 100.25 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قالب‌ها | tab / tab | 999px | 40 | 67.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عادی | combobox / combobox | 12px | 45 | 177.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قالب جدید | secondary / action | 12px | 40 | 94.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمایش بایگانی‌شده‌ها | checkbox / checkbox | 6px | 40 | 147.56 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عادی | combobox / combobox | 12px | 45 | 87.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره قالب | primary / action | 12px | 40 | 98.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ برگه تنظیم آزمایشی | secondary / action | 12px | 40 | 169.5 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کپی قالب | secondary / action | 12px | 40 | 87.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بایگانی قالب | danger / action | 12px | 40 | 101.66 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خانه شروع 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| خانه شروع 1 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |

### Edit Regular label template

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Waitlist | tab / tab | 999px | 40 | 74.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular | combobox / combobox | 12px | 45 | 183.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New template | secondary / action | 12px | 40 | 126.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Show archived | checkbox / checkbox | 6px | 40 | 129.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular | combobox / combobox | 12px | 45 | 110.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save template | primary / action | 12px | 40 | 128.78 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print test alignment page | secondary / action | 12px | 40 | 201.17 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Duplicate template | secondary / action | 12px | 40 | 159.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Archive template | danger / action | 12px | 40 | 147.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاها | tab / tab | 999px | 40 | 59 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فهرست انتظار | tab / tab | 999px | 40 | 100.25 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قالب‌ها | tab / tab | 999px | 40 | 67.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عادی | combobox / combobox | 12px | 45 | 177.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قالب جدید | secondary / action | 12px | 40 | 94.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمایش بایگانی‌شده‌ها | checkbox / checkbox | 6px | 40 | 147.56 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| عادی | combobox / combobox | 12px | 45 | 87.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره قالب | primary / action | 12px | 40 | 98.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ برگه تنظیم آزمایشی | secondary / action | 12px | 40 | 169.5 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کپی قالب | secondary / action | 12px | 40 | 87.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بایگانی قالب | danger / action | 12px | 40 | 101.66 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خانه شروع 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| خانه شروع 1 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 2 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 3 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 4 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 5 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 6 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 7 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 8 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 9 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 10 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 11 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 12 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 13 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 14 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 15 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 16 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 17 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |
| خانه شروع 18 | widget / widget | 0px | 60.57 | 90.86 | phone-fa-light / supervisor | 1 |

### Notes

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Add note | primary / action | 12px | 40 | 118.59 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New notebook | secondary / action | 12px | 40 | 155.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| To order | tab / tab | 999px | 40 | 81.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Store use | tab / tab | 999px | 40 | 88.31 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| For Supervisor 1 | tab / tab | 999px | 40 | 148.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deli temperatures 1 | tab / tab | 999px | 40 | 166.81 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Include done and ordered notes | checkbox / checkbox | 6px | 44 | 242.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Mark ordered | secondary / action | 12px | 40 | 124.44 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن یادداشت | primary / action | 12px | 40 | 149.25 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دفترچه جدید | secondary / action | 12px | 40 | 130.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| برای سفارش | tab / tab | 999px | 40 | 92.56 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مصرف فروشگاه | tab / tab | 999px | 40 | 109.91 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| برای سرپرست 1 | tab / tab | 999px | 40 | 127.75 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمای اغذیه 1 | tab / tab | 999px | 40 | 114.72 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمایش موارد انجام‌شده و سفارش‌داده‌شده | checkbox / checkbox | 6px | 44 | 261.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| علامت سفارش‌داده‌شده | secondary / action | 12px | 40 | 165.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Add note dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add note | primary / action | 12px | 40 | 118.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| New notebook | secondary / action | 12px | 40 | 155.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| To order | tab / tab | 999px | 40 | 81.73 | desktop-en-light, phone-en-light / supervisor | 2 |
| Store use | tab / tab | 999px | 40 | 88.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| For Supervisor 1 | tab / tab | 999px | 40 | 148.19 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deli temperatures 1 | tab / tab | 999px | 40 | 166.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose product | combobox / combobox | 12px | 45 | 262.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save note | primary / action | 12px | 40 | 100.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Include done and ordered notes | checkbox / checkbox | 6px | 44 | 242.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Mark ordered | secondary / action | 12px | 40 | 124.44 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Received

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Choose date | date / date | 12px | 44 | 137.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Product | combobox / combobox | 12px | 44 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| FV-20390 | secondary / action | 12px | 40 | 84.73 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 18 |
| GG-11842 | secondary / action | 12px | 40 | 87.98 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 6 |
| GG-11879 | secondary / action | 12px | 40 | 87.98 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 6 |
| SB-7862 | secondary / action | 12px | 40 | 77.06 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 6 |
| SB-7848 | secondary / action | 12px | 40 | 77.06 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 3 |
| HW-4936 | secondary / action | 12px | 40 | 82.22 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 12 |
| FV-20296 | secondary / action | 12px | 40 | 84.73 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 6 |
| GG-11794 | secondary / action | 12px | 40 | 87.98 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 159.7 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| مکان | combobox / combobox | 12px | 44 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالا | combobox / combobox | 12px | 44 | 277.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 18 |
| GG-11842 | secondary / action | 12px | 40 | 95.98 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 6 |
| GG-11879 | secondary / action | 12px | 40 | 95.98 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 6 |
| SB-7862 | secondary / action | 12px | 40 | 85.06 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 6 |
| SB-7848 | secondary / action | 12px | 40 | 85.06 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 3 |
| HW-4936 | secondary / action | 12px | 40 | 90.22 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 12 |
| FV-20296 | secondary / action | 12px | 40 | 92.73 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 6 |
| GG-11794 | secondary / action | 12px | 40 | 95.98 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 3 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### History

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Person | combobox / combobox | 12px | 44 | 174.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| History branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Action type | combobox / combobox | 12px | 44 | 153.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| From date | date / date | 12px | 44 | 180 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| To date | date / date | 12px | 44 | 180 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شخص | combobox / combobox | 12px | 44 | 154.36 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه سابقه | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نوع کار | combobox / combobox | 12px | 44 | 121.94 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| از تاریخ | date / date | 12px | 44 | 180 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تا تاریخ | date / date | 12px | 44 | 180 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Payables overview

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record external payment | primary / action | 12px | 40 | 201.64 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payables branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overdue only | checkbox / checkbox | 6px | 44 | 120.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| With balance | checkbox / checkbox | 6px | 44 | 118.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت پرداخت خارج از برنامه | primary / action | 12px | 40 | 180.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه پرداختنی‌ها | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فقط سررسید گذشته | checkbox / checkbox | 6px | 44 | 144.39 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای مانده | checkbox / checkbox | 6px | 44 | 91.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Supplier ledger

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record external payment | primary / action | 12px | 40 | 201.64 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payables branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overdue only | checkbox / checkbox | 6px | 44 | 120.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| With balance | checkbox / checkbox | 6px | 44 | 118.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.97 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Current ledger | tab / tab | 999px | 40 | 119.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Month-end summary | tab / tab | 999px | 40 | 159.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print summary | secondary / action | 12px | 40 | 131.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Export CSV | secondary / action | 12px | 40 | 110.75 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record opening balance, credit, or adjustment | secondary / action | 12px | 40 | 342.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| View all suppliers | secondary / action | 12px | 40 | 151.03 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record dispute | secondary / action | 12px | 40 | 122.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت پرداخت خارج از برنامه | primary / action | 12px | 40 | 180.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه پرداختنی‌ها | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فقط سررسید گذشته | checkbox / checkbox | 6px | 44 | 144.39 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای مانده | checkbox / checkbox | 6px | 44 | 91.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دفتر جاری | tab / tab | 999px | 40 | 81.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خلاصه پایان ماه | tab / tab | 999px | 40 | 111.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ خلاصه | secondary / action | 12px | 40 | 100.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خروجی CSV | secondary / action | 12px | 40 | 106.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت مانده افتتاحیه، بستانکاری یا تعدیل | secondary / action | 12px | 40 | 251.92 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مشاهده همه تأمین‌کنندگان | secondary / action | 12px | 40 | 188.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت اختلاف | secondary / action | 12px | 40 | 87.02 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Record external payment form

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record external payment | primary / action | 12px | 40 | 201.64 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payables branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overdue only | checkbox / checkbox | 6px | 44 | 120.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| With balance | checkbox / checkbox | 6px | 44 | 118.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.97 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Current ledger | tab / tab | 999px | 40 | 119.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Month-end summary | tab / tab | 999px | 40 | 159.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print summary | secondary / action | 12px | 40 | 131.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Export CSV | secondary / action | 12px | 40 | 110.75 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record opening balance, credit, or adjustment | secondary / action | 12px | 40 | 342.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| View all suppliers | secondary / action | 12px | 40 | 151.03 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 2026-10-10 | date / date | 12px | 45 | 326 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 3 |
| Preview oldest-due allocations | secondary / action | 12px | 40 | 239.75 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record dispute | secondary / action | 12px | 40 | 122.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت پرداخت خارج از برنامه | primary / action | 12px | 40 | 180.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه پرداختنی‌ها | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فقط سررسید گذشته | checkbox / checkbox | 6px | 44 | 144.39 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای مانده | checkbox / checkbox | 6px | 44 | 91.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دفتر جاری | tab / tab | 999px | 40 | 81.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خلاصه پایان ماه | tab / tab | 999px | 40 | 111.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ خلاصه | secondary / action | 12px | 40 | 100.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خروجی CSV | secondary / action | 12px | 40 | 106.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت مانده افتتاحیه، بستانکاری یا تعدیل | secondary / action | 12px | 40 | 251.92 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مشاهده همه تأمین‌کنندگان | secondary / action | 12px | 40 | 188.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نمایش تخصیص به قدیمی‌ترین سررسید | secondary / action | 12px | 40 | 278.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت اختلاف | secondary / action | 12px | 40 | 87.02 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| 2026-10-10 | date / date | 12px | 45 | 318 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 3 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Record ledger entry form

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record external payment | primary / action | 12px | 40 | 201.64 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payables branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overdue only | checkbox / checkbox | 6px | 44 | 120.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| With balance | checkbox / checkbox | 6px | 44 | 118.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.97 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Current ledger | tab / tab | 999px | 40 | 119.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Month-end summary | tab / tab | 999px | 40 | 159.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print summary | secondary / action | 12px | 40 | 131.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Export CSV | secondary / action | 12px | 40 | 110.75 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record opening balance, credit, or adjustment | secondary / action | 12px | 40 | 342.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| View all suppliers | secondary / action | 12px | 40 | 151.03 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Manual adjustment | combobox / combobox | 12px | 45 | 247.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 2026-10-10 | date / date | 12px | 45 | 326 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 3 |
| Record ledger entry | primary / action | 12px | 40 | 166.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record dispute | secondary / action | 12px | 40 | 122.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت پرداخت خارج از برنامه | primary / action | 12px | 40 | 180.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه پرداختنی‌ها | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فقط سررسید گذشته | checkbox / checkbox | 6px | 44 | 144.39 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای مانده | checkbox / checkbox | 6px | 44 | 91.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دفتر جاری | tab / tab | 999px | 40 | 81.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خلاصه پایان ماه | tab / tab | 999px | 40 | 111.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ خلاصه | secondary / action | 12px | 40 | 100.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خروجی CSV | secondary / action | 12px | 40 | 106.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت مانده افتتاحیه، بستانکاری یا تعدیل | secondary / action | 12px | 40 | 251.92 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مشاهده همه تأمین‌کنندگان | secondary / action | 12px | 40 | 188.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تعدیل دستی | combobox / combobox | 12px | 45 | 273.72 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت ردیف دفتر | primary / action | 12px | 40 | 115.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت اختلاف | secondary / action | 12px | 40 | 87.02 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| 2026-10-10 | date / date | 12px | 45 | 318 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 3 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Record supplier dispute form

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record external payment | primary / action | 12px | 40 | 201.64 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payables branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overdue only | checkbox / checkbox | 6px | 44 | 120.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| With balance | checkbox / checkbox | 6px | 44 | 118.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.97 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Current ledger | tab / tab | 999px | 40 | 119.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Month-end summary | tab / tab | 999px | 40 | 159.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print summary | secondary / action | 12px | 40 | 131.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Export CSV | secondary / action | 12px | 40 | 110.75 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record opening balance, credit, or adjustment | secondary / action | 12px | 40 | 342.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| View all suppliers | secondary / action | 12px | 40 | 151.03 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Manual adjustment | combobox / combobox | 12px | 45 | 247.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 2026-10-10 | date / date | 12px | 45 | 326 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 3 |
| Record ledger entry | primary / action | 12px | 40 | 166.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record dispute | primary / action | 12px | 40 | 134.83 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Record dispute | secondary / action | 12px | 40 | 122.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 16 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت پرداخت خارج از برنامه | primary / action | 12px | 40 | 180.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه پرداختنی‌ها | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فقط سررسید گذشته | checkbox / checkbox | 6px | 44 | 144.39 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای مانده | checkbox / checkbox | 6px | 44 | 91.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دفتر جاری | tab / tab | 999px | 40 | 81.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خلاصه پایان ماه | tab / tab | 999px | 40 | 111.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ خلاصه | secondary / action | 12px | 40 | 100.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خروجی CSV | secondary / action | 12px | 40 | 106.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت مانده افتتاحیه، بستانکاری یا تعدیل | secondary / action | 12px | 40 | 251.92 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مشاهده همه تأمین‌کنندگان | secondary / action | 12px | 40 | 188.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تعدیل دستی | combobox / combobox | 12px | 45 | 273.72 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت ردیف دفتر | primary / action | 12px | 40 | 115.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت اختلاف | primary / action | 12px | 40 | 99.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بستن | secondary / action | 12px | 40 | 65.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت اختلاف | secondary / action | 12px | 40 | 87.02 | desktop-fa-light, phone-fa-light / supervisor | 8 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| 2026-10-10 | date / date | 12px | 45 | 318 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 3 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Orders list

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New order | primary / action | 12px | 40 | 127.83 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| All statuses | combobox / combobox | 12px | 44 | 173.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| All suppliers | combobox / combobox | 12px | 44 | 140.8 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Choose date | date / date | 12px | 44 | 137.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| سفارش جدید | primary / action | 12px | 40 | 132.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| همه وضعیت‌ها | combobox / combobox | 12px | 44 | 162.27 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| همه تأمین‌کننده‌ها | combobox / combobox | 12px | 44 | 163.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 159.7 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### New order with supplier items

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Orders | quiet / action | 12px | 40 | 157.31 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| North York | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.97 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New item | secondary / action | 12px | 40 | 120.73 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save as draft | secondary / action | 12px | 40 | 121.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Place order | primary / action | 12px | 40 | 110.41 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Add to order | secondary / action | 12px | 40 | 117.58 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به سفارش‌ها | quiet / action | 12px | 40 | 175.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نورث یورک | combobox / combobox | 12px | 45 | 129.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالای جدید | secondary / action | 12px | 40 | 118.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره پیش‌نویس | secondary / action | 12px | 40 | 130.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت سفارش | primary / action | 12px | 40 | 102.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انصراف | secondary / action | 12px | 40 | 73.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن به سفارش | secondary / action | 12px | 40 | 133.28 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### New order item dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Orders | quiet / action | 12px | 40 | 157.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| North York | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.97 | desktop-en-light, phone-en-light / supervisor | 2 |
| New item | secondary / action | 12px | 40 | 120.73 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save as draft | secondary / action | 12px | 40 | 121.27 | desktop-en-light, phone-en-light / supervisor | 2 |
| Place order | primary / action | 12px | 40 | 110.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 4 |
| Add to order | secondary / action | 12px | 40 | 117.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add item | primary / action | 12px | 40 | 93.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Branch requests Incoming

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New request | primary / action | 12px | 40 | 142.91 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Incoming | tab / tab | 999px | 40 | 86.59 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Outgoing | tab / tab | 999px | 40 | 86.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| درخواست جدید | primary / action | 12px | 40 | 144.66 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ورودی | tab / tab | 999px | 40 | 61.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خروجی | tab / tab | 999px | 40 | 66.47 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 146.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| محل | combobox / combobox | 12px | 44 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Branch requests Outgoing

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New request | primary / action | 12px | 40 | 142.91 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Incoming | tab / tab | 999px | 40 | 86.59 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Outgoing | tab / tab | 999px | 40 | 86.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| درخواست جدید | primary / action | 12px | 40 | 144.66 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ورودی | tab / tab | 999px | 40 | 61.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| خروجی | tab / tab | 999px | 40 | 66.47 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 146.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| محل | combobox / combobox | 12px | 44 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### New request

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| North York | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Choose location | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Add item | secondary / action | 12px | 40 | 93.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Send | primary / action | 12px | 40 | 68.34 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save as draft | secondary / action | 12px | 40 | 121.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به درخواست‌ها | quiet / action | 12px | 40 | 187.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نورث یورک | combobox / combobox | 12px | 45 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب محل | combobox / combobox | 12px | 45 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن مورد | secondary / action | 12px | 40 | 100.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ارسال | primary / action | 12px | 40 | 65.33 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره پیش‌نویس | secondary / action | 12px | 40 | 130.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انصراف | secondary / action | 12px | 40 | 73.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### New request with item

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| North York | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Warehouse | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Add item | secondary / action | 12px | 40 | 93.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Remove item | danger / action | 12px | 40 | 106.13 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Units | combobox / combobox | 12px | 45 | 101.03 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Send | primary / action | 12px | 40 | 68.34 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save as draft | secondary / action | 12px | 40 | 121.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به درخواست‌ها | quiet / action | 12px | 40 | 187.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نورث یورک | combobox / combobox | 12px | 45 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انبار | combobox / combobox | 12px | 45 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن مورد | secondary / action | 12px | 40 | 100.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| حذف مورد | danger / action | 12px | 40 | 79.33 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| واحد | combobox / combobox | 12px | 45 | 88.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ارسال | primary / action | 12px | 40 | 65.33 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره پیش‌نویس | secondary / action | 12px | 40 | 130.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انصراف | secondary / action | 12px | 40 | 73.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Saved request detail

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Send | primary / action | 12px | 40 | 68.34 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit draft | secondary / action | 12px | 40 | 94.66 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Cancel request | danger / action | 12px | 40 | 135.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به درخواست‌ها | quiet / action | 12px | 40 | 187.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ فهرست آماده‌سازی | secondary / action | 12px | 40 | 191.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ارسال | primary / action | 12px | 40 | 65.33 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش پیش‌نویس | secondary / action | 12px | 40 | 138.3 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغو درخواست | danger / action | 12px | 40 | 110.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| واگرد | secondary / action | 12px | 40 | 61.36 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Cancel request reason

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Send | primary / action | 12px | 40 | 68.34 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit draft | secondary / action | 12px | 40 | 94.66 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Cancel request | danger / action | 12px | 40 | 135.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Confirm cancellation | danger / action | 12px | 40 | 172.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به درخواست‌ها | quiet / action | 12px | 40 | 187.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| چاپ فهرست آماده‌سازی | secondary / action | 12px | 40 | 191.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ارسال | primary / action | 12px | 40 | 65.33 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش پیش‌نویس | secondary / action | 12px | 40 | 138.3 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغو درخواست | danger / action | 12px | 40 | 110.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأیید لغو | danger / action | 12px | 40 | 82.06 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| واگرد | secondary / action | 12px | 40 | 61.36 | desktop-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Suppliers overview

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Add supplier | primary / action | 12px | 40 | 118.83 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overdue | widget / widget | 999px | 44 | 76.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Open returns | widget / widget | 999px | 44 | 104.66 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Open shorts | widget / widget | 999px | 44 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Waiting for confirmation | widget / widget | 999px | 44 | 171.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 98.13 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Sort by supplier | widget / widget | 0px | 44 | 66.14 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Sort by status | widget / widget | 0px | 44 | 39.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Sort by last delivery | widget / widget | 0px | 44 | 79.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Sort by deliveries | widget / widget | 0px | 44 | 61.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Sort by open returns | widget / widget | 0px | 44 | 68.56 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Sort by open shorts | widget / widget | 0px | 44 | 68.56 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Sort by balance | widget / widget | 0px | 44 | 49.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Sort by overdue | widget / widget | 0px | 44 | 53.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن تأمین‌کننده | primary / action | 12px | 40 | 137.36 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه تأمین‌کننده | combobox / combobox | 12px | 44 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| سررسید گذشته | widget / widget | 999px | 44 | 102.55 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌های باز | widget / widget | 999px | 44 | 101.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌های باز | widget / widget | 999px | 44 | 91.73 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در انتظار تأیید | widget / widget | 999px | 44 | 93.5 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 113.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرتب‌سازی بر اساس تأمین‌کننده | widget / widget | 0px | 44 | 71.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرتب‌سازی بر اساس وضعیت | widget / widget | 0px | 44 | 41.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرتب‌سازی بر اساس آخرین تحویل | widget / widget | 0px | 44 | 66.56 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرتب‌سازی بر اساس تحویل‌ها | widget / widget | 0px | 44 | 44.7 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرتب‌سازی بر اساس مرجوعی‌های باز | widget / widget | 0px | 44 | 68.56 | desktop-fa-light / supervisor | 1 |
| مرتب‌سازی بر اساس کسری‌های باز | widget / widget | 0px | 44 | 68.45 | desktop-fa-light / supervisor | 1 |
| مرتب‌سازی بر اساس مانده | widget / widget | 0px | 44 | 27.47 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرتب‌سازی بر اساس سررسید گذشته | widget / widget | 0px | 44 | 79.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Open returns | widget / widget | 999px | 44 | 104.66 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Open shorts | widget / widget | 999px | 44 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Waiting for confirmation | widget / widget | 999px | 44 | 171.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Clear filters | quiet / action | 12px | 40 | 98.13 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Sort by supplier | widget / widget | 0px | 44 | 66.14 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Sort by status | widget / widget | 0px | 44 | 39.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Sort by last delivery | widget / widget | 0px | 44 | 79.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Sort by deliveries | widget / widget | 0px | 44 | 61.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Sort by open returns | widget / widget | 0px | 44 | 81.63 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Sort by open shorts | widget / widget | 0px | 44 | 76.19 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌های باز | widget / widget | 999px | 44 | 101.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌های باز | widget / widget | 999px | 44 | 91.73 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| در انتظار تأیید | widget / widget | 999px | 44 | 93.5 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 113.31 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرتب‌سازی بر اساس تأمین‌کننده | widget / widget | 0px | 44 | 71.8 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرتب‌سازی بر اساس وضعیت | widget / widget | 0px | 44 | 41.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرتب‌سازی بر اساس آخرین تحویل | widget / widget | 0px | 44 | 66.56 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرتب‌سازی بر اساس تحویل‌ها | widget / widget | 0px | 44 | 44.7 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرتب‌سازی بر اساس مرجوعی‌های باز | widget / widget | 0px | 44 | 78.31 | desktop-fa-light / floor_worker | 1 |
| مرتب‌سازی بر اساس کسری‌های باز | widget / widget | 0px | 44 | 68.45 | desktop-fa-light / floor_worker | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Sort by open returns | widget / widget | 0px | 44 | 68 | phone-en-light, phone-en-dark / supervisor | 2 |
| Sort by open shorts | widget / widget | 0px | 44 | 68 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| مرتب‌سازی بر اساس مرجوعی‌های باز | widget / widget | 0px | 44 | 68 | phone-fa-light / supervisor | 1 |
| مرتب‌سازی بر اساس کسری‌های باز | widget / widget | 0px | 44 | 68 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| Sort by open returns | widget / widget | 0px | 44 | 68 | phone-en-light, phone-en-dark / floor_worker | 2 |
| Sort by open shorts | widget / widget | 0px | 44 | 68 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |
| مرتب‌سازی بر اساس مرجوعی‌های باز | widget / widget | 0px | 44 | 68 | phone-fa-light / floor_worker | 1 |
| مرتب‌سازی بر اساس کسری‌های باز | widget / widget | 0px | 44 | 68 | phone-fa-light / floor_worker | 1 |

### Add supplier dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add supplier | primary / action | 12px | 40 | 118.83 | desktop-en-light, phone-en-light / supervisor | 4 |
| 2026-10-10 | date / date | 12px | 45 | 150.78 | desktop-en-light, phone-en-light / supervisor | 8 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supplier branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Overdue | widget / widget | 999px | 44 | 76.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open returns | widget / widget | 999px | 44 | 104.66 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open shorts | widget / widget | 999px | 44 | 99.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Waiting for confirmation | widget / widget | 999px | 44 | 171.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 98.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by supplier | widget / widget | 0px | 44 | 66.14 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by status | widget / widget | 0px | 44 | 39.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by last delivery | widget / widget | 0px | 44 | 79.42 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by deliveries | widget / widget | 0px | 44 | 61.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by open returns | widget / widget | 0px | 44 | 68.56 | desktop-en-light / supervisor | 1 |
| Sort by open shorts | widget / widget | 0px | 44 | 68.56 | desktop-en-light / supervisor | 1 |
| Sort by balance | widget / widget | 0px | 44 | 49.55 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by overdue | widget / widget | 0px | 44 | 53.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Sort by open returns | widget / widget | 0px | 44 | 68 | phone-en-light / supervisor | 1 |
| Sort by open shorts | widget / widget | 0px | 44 | 68 | phone-en-light / supervisor | 1 |

### Supplier: Overview

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Supplier: Invoices

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Supplier: Supplier items

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Add item | primary / action | 12px | 40 | 93.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | desktop-en-light, desktop-en-dark, desktop-fa-light, phone-en-light, phone-en-dark, phone-fa-light / supervisor | 36 |
| History | secondary / action | 12px | 40 | 66.83 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن کالا | primary / action | 12px | 40 | 93.89 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخچه | secondary / action | 12px | 40 | 63.14 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| ویرایش | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | desktop-en-light, desktop-en-dark, desktop-fa-light, phone-en-light, phone-en-dark, phone-fa-light / floor_worker | 36 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Supplier: Received

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Choose date | date / date | 12px | 44 | 137.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 8 |
| Location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Product | combobox / combobox | 12px | 44 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| FV-20390 | secondary / action | 12px | 40 | 84.73 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 18 |
| FV-20296 | secondary / action | 12px | 40 | 84.73 | desktop-en-light, desktop-en-dark, desktop-fa-light / supervisor | 6 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 159.7 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| مکان | combobox / combobox | 12px | 44 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالا | combobox / combobox | 12px | 44 | 277.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Choose date | date / date | 12px | 44 | 137.84 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 8 |
| Product | combobox / combobox | 12px | 44 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| FV-20390 | secondary / action | 12px | 40 | 84.73 | desktop-en-light, desktop-en-dark, desktop-fa-light / floor_worker | 18 |
| FV-20296 | secondary / action | 12px | 40 | 84.73 | desktop-en-light, desktop-en-dark, desktop-fa-light / floor_worker | 6 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 159.7 | desktop-fa-light, phone-fa-light / floor_worker | 4 |
| کالا | combobox / combobox | 12px | 44 | 277.11 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 18 |
| FV-20296 | secondary / action | 12px | 40 | 92.73 | phone-en-light, phone-en-dark, phone-fa-light / supervisor | 6 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | phone-en-light, phone-en-dark, phone-fa-light / floor_worker | 18 |
| FV-20296 | secondary / action | 12px | 40 | 92.73 | phone-en-light, phone-en-dark, phone-fa-light / floor_worker | 6 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Supplier: Returns and credits

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Open | tab / tab | 999px | 40 | 63.17 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| History | tab / tab | 999px | 40 | 74 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Status | combobox / combobox | 12px | 44 | 179.98 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Return branch | combobox / combobox | 12px | 44 | 142.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز | tab / tab | 999px | 40 | 41.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخچه | tab / tab | 999px | 40 | 70.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 159.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه مرجوعی | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Open | tab / tab | 999px | 40 | 63.17 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| History | tab / tab | 999px | 40 | 74 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Status | combobox / combobox | 12px | 44 | 179.98 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Return branch | combobox / combobox | 12px | 44 | 142.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| باز | tab / tab | 999px | 40 | 41.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تاریخچه | tab / tab | 999px | 40 | 70.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 159.13 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| شعبه مرجوعی | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Supplier: Shorts

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Supplier: Price alerts

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Supplier: Payments

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Supplier: Notes

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش | secondary / action | 12px | 40 | 75.09 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| غیرفعال کردن | secondary / action | 12px | 40 | 109.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پرداخت‌ها | tab / tab | 999px | 40 | 80.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / floor_worker | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / floor_worker | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / floor_worker | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / floor_worker | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / floor_worker | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| اعلان‌ها، 0 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| بازگشت به تأمین‌کنندگان | quiet / action | 12px | 40 | 194.17 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمای کلی | tab / tab | 999px | 40 | 75.58 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| فاکتورها | tab / tab | 999px | 40 | 71.44 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کالاهای تأمین‌کننده | tab / tab | 999px | 40 | 128.34 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| دریافت‌شده‌ها | tab / tab | 999px | 40 | 101.81 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| مرجوعی‌ها و اعتبارها | tab / tab | 999px | 40 | 134.08 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| کسری‌ها | tab / tab | 999px | 40 | 73.38 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| هشدارهای قیمت | tab / tab | 999px | 40 | 118.67 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| یادداشت‌ها | tab / tab | 999px | 40 | 87.69 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / floor_worker | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / floor_worker | 1 |

### Edit supplier dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save supplier | primary / action | 12px | 40 | 124.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Add supplier item dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, phone-en-light / supervisor | 2 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add item | primary / action | 12px | 40 | 93.67 | desktop-en-light, phone-en-light / supervisor | 4 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | desktop-en-light, phone-en-light / supervisor | 12 |
| History | secondary / action | 12px | 40 | 66.83 | desktop-en-light, phone-en-light / supervisor | 12 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 12 |
| Choose a product | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Supplier item price history dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, phone-en-light / supervisor | 2 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add item | primary / action | 12px | 40 | 93.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | desktop-en-light, phone-en-light / supervisor | 14 |
| History | secondary / action | 12px | 40 | 66.83 | desktop-en-light, phone-en-light / supervisor | 12 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 12 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Edit supplier item dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Suppliers | quiet / action | 12px | 40 | 174.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit | secondary / action | 12px | 40 | 59.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deactivate | secondary / action | 12px | 40 | 105.55 | desktop-en-light, phone-en-light / supervisor | 2 |
| Overview | tab / tab | 999px | 40 | 88.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Invoices | tab / tab | 999px | 40 | 80.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supplier items | tab / tab | 999px | 40 | 117.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Received | tab / tab | 999px | 40 | 86.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| Returns and credits | tab / tab | 999px | 40 | 149.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Shorts | tab / tab | 999px | 40 | 69.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Price alerts | tab / tab | 999px | 40 | 99.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Payments | tab / tab | 999px | 40 | 90.36 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notes | tab / tab | 999px | 40 | 66.16 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add item | primary / action | 12px | 40 | 93.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| FV-20390 | secondary / action | 12px | 40 | 92.73 | desktop-en-light, phone-en-light / supervisor | 12 |
| History | secondary / action | 12px | 40 | 66.83 | desktop-en-light, phone-en-light / supervisor | 12 |
| Edit | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 12 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save item | primary / action | 12px | 40 | 99.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Sign in

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / anonymous | 2 |
| Show password | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / anonymous | 2 |
| Sign in | primary / action | 12px | 40 | 79.36 | desktop-en-light, phone-en-light / anonymous | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / anonymous | 2 |
| نمایش گذرواژه | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / anonymous | 2 |
| ورود | primary / action | 12px | 40 | 58.34 | desktop-fa-light, phone-fa-light / anonymous | 2 |

### Choose a new password

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Show password | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 4 |
| Save password | primary / action | 12px | 40 | 135.97 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Sign out | secondary / action | 12px | 40 | 89.05 | desktop-en-light, phone-en-light / floor_worker | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| نمایش گذرواژه | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / floor_worker | 4 |
| ذخیرهٔ گذرواژه | primary / action | 12px | 40 | 109.53 | desktop-fa-light, phone-fa-light / floor_worker | 2 |
| خروج | secondary / action | 12px | 40 | 64.63 | desktop-fa-light, phone-fa-light / floor_worker | 2 |

### Screen locked

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Show password | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Unlock | primary / action | 12px | 40 | 80.69 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Sign in as someone else | secondary / action | 12px | 40 | 195.31 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-dark, phone-fa-dark / supervisor | 2 |
| نمایش گذرواژه | secondary / icon | 50% | 40 | 40 | desktop-fa-dark, phone-fa-dark / supervisor | 2 |
| باز کردن قفل | primary / action | 12px | 40 | 104.23 | desktop-fa-dark, phone-fa-dark / supervisor | 2 |
| ورود به‌عنوان کاربر دیگر | secondary / action | 12px | 40 | 160.53 | desktop-fa-dark, phone-fa-dark / supervisor | 2 |

### Add product dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add product | primary / action | 12px | 40 | 117.05 | desktop-en-light, phone-en-light / supervisor | 4 |
| Each | combobox / combobox | 12px | 45 | 106.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Rice | combobox / combobox | 12px | 45 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Grocery | combobox / combobox | 12px | 45 | 178.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226 | desktop-en-light / supervisor | 1 |
| No | combobox / combobox | 12px | 45 | 107.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Pricing category | combobox / combobox | 12px | 44 | 199.88 | desktop-en-light, phone-en-light / supervisor | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, phone-en-light / supervisor | 2 |
| Has pending price | checkbox / checkbox | 6px | 44 | 152.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Has offer | checkbox / checkbox | 6px | 44 | 92.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| Manual prices | checkbox / checkbox | 6px | 44 | 125.17 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Product ↑ | quiet / widget | 12px | 40 | 65.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Product Code | quiet / widget | 12px | 40 | 72.31 | desktop-en-light / supervisor | 1 |
| Approved price | quiet / widget | 12px | 40 | 79.41 | desktop-en-light / supervisor | 1 |
| Edit Basmati Rice 4.5 kg | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Product actions | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 14 |
| Edit Black Tea 450 g | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit Bulk Almonds | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit Canned Fava Beans 400 g | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit Dried Barberries 100 g | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit Dried Red Kidney Beans 900 g | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit Fruit Soda 6-pack | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit Ground Sumac 100 g | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Previous | secondary / action | 12px | 40 | 92.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Next | secondary / action | 12px | 40 | 65.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.97 | phone-en-light / supervisor | 1 |
| Product Code | quiet / widget | 12px | 40 | 84 | phone-en-light / supervisor | 1 |
| Approved price | quiet / widget | 12px | 40 | 92 | phone-en-light / supervisor | 1 |

### Edit product dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add product | primary / action | 12px | 40 | 117.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| Pricing category | combobox / combobox | 12px | 44 | 199.88 | desktop-en-light, phone-en-light / supervisor | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, phone-en-light / supervisor | 2 |
| Has pending price | checkbox / checkbox | 6px | 44 | 152.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Has offer | checkbox / checkbox | 6px | 44 | 92.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| Manual prices | checkbox / checkbox | 6px | 44 | 125.17 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Product ↑ | quiet / widget | 12px | 40 | 65.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Product Code | quiet / widget | 12px | 40 | 72.31 | desktop-en-light / supervisor | 1 |
| Approved price | quiet / widget | 12px | 40 | 79.41 | desktop-en-light / supervisor | 1 |
| Edit Potato Chips 150 g | secondary / action | 12px | 40 | 45.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Each | combobox / combobox | 12px | 45 | 106.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Snacks | combobox / combobox | 12px | 45 | 192.8 | desktop-en-light, phone-en-light / supervisor | 2 |
| Grocery (Taxable) | combobox / combobox | 12px | 45 | 179.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226 | desktop-en-light / supervisor | 1 |
| Yes | combobox / combobox | 12px | 45 | 107.42 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 68.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save product | primary / action | 12px | 40 | 110.72 | desktop-en-light, phone-en-light / supervisor | 2 |
| Product actions | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Previous | secondary / action | 12px | 40 | 92.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Next | secondary / action | 12px | 40 | 65.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Product Code | quiet / widget | 12px | 40 | 84 | phone-en-light / supervisor | 1 |
| Approved price | quiet / widget | 12px | 40 | 92 | phone-en-light / supervisor | 1 |
| Fresh Valley Foods | combobox / combobox | 12px | 45 | 226.61 | phone-en-light / supervisor | 1 |

### Remove date reason dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 168 | desktop-en-light / supervisor | 1 |
| North York | combobox / combobox | 12px | 45 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| More | secondary / action | 12px | 40 | 68.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add | primary / action | 12px | 40 | 61.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| Time window | combobox / combobox | 12px | 44 | 217.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Date tracking location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by | combobox / combobox | 12px | 44 | 111.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Remove | danger / action | 12px | 40 | 71.91 | desktop-en-light, phone-en-light / supervisor | 4 |
| More | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 4 |
| Choose reason | combobox / combobox | 12px | 45 | 194.06 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Remove | danger / action | 12px | 40 | 87.73 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Choose date | date / date | 12px | 44 | 153 | phone-en-light / supervisor | 1 |

### Stop tracking this product dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 168 | desktop-en-light / supervisor | 1 |
| North York | combobox / combobox | 12px | 45 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| More | secondary / action | 12px | 40 | 68.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add | primary / action | 12px | 40 | 61.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| Time window | combobox / combobox | 12px | 44 | 217.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Date tracking location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by | combobox / combobox | 12px | 44 | 111.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Remove | danger / action | 12px | 40 | 71.91 | desktop-en-light, phone-en-light / supervisor | 4 |
| More | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 4 |
| Remove existing open dates | checkbox / checkbox | 6px | 40 | 217.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Stop tracking this product | danger / action | 12px | 40 | 207.03 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Choose date | date / date | 12px | 44 | 153 | phone-en-light / supervisor | 1 |

### Apply conflict price to all branches dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Show resolved and intentional alerts | checkbox / checkbox | 6px | 40 | 271.27 | desktop-en-light, phone-en-light / supervisor | 2 |
| Apply this price to all | secondary / action | 12px | 40 | 162.33 | desktop-en-light, phone-en-light / supervisor | 4 |
| Mark as intentional | primary / action | 12px | 40 | 161.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Apply price to all branches | primary / action | 12px | 40 | 212.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Review approval confirmation

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Pending | tab / tab | 999px | 40 | 80.27 | desktop-en-light, phone-en-light / supervisor | 2 |
| Approved | tab / tab | 999px | 40 | 89.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Rejected | tab / tab | 999px | 40 | 83.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Superseded | tab / tab | 999px | 40 | 104.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Approve price | primary / action | 12px | 40 | 128.33 | desktop-en-light, phone-en-light / supervisor | 4 |
| Reject | danger / action | 12px | 40 | 75.7 | desktop-en-light, phone-en-light / supervisor | 4 |
| Approve product | primary / action | 12px | 40 | 146.5 | desktop-en-light, phone-en-light / supervisor | 2 |
| All branches | combobox / combobox | 12px | 45 | 170.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Reject proposal confirmation

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Pending | tab / tab | 999px | 40 | 80.27 | desktop-en-light, phone-en-light / supervisor | 2 |
| Approved | tab / tab | 999px | 40 | 89.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Rejected | tab / tab | 999px | 40 | 83.58 | desktop-en-light, phone-en-light / supervisor | 2 |
| Superseded | tab / tab | 999px | 40 | 104.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Approve price | primary / action | 12px | 40 | 128.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Reject | danger / action | 12px | 40 | 75.7 | desktop-en-light, phone-en-light / supervisor | 4 |
| Approve product | primary / action | 12px | 40 | 146.5 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Reject proposal | danger / action | 12px | 40 | 137.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### New invoice upload entry

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New invoice | secondary / action | 12px | 40 | 115.72 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Upload | primary / action | 12px | 40 | 81.75 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Manual entry | secondary / action | 12px | 40 | 121.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoice details | disclosure / disclosure | 0px | 40 | 936 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| No linked order | combobox / combobox | 12px | 45 | 161.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 1. Canned Fava Beans 400 gباقالا کنسرو شده ۴۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Cases | combobox / combobox | 12px | 45 | 101.03 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Grocery | combobox / combobox | 12px | 45 | 178.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 20 |
| Mark as short | checkbox / checkbox | 6px | 40 | 122.95 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| Yes | widget / widget | 999px | 40 | 52.28 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| No | widget / widget | 999px | 40 | 47.59 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| Expiry | combobox / combobox | 12px | 45 | 136.34 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 20 |
| Choose date | date / date | 12px | 44 | 432 | desktop-en-light, desktop-en-dark / supervisor | 10 |
| Confirm this invoice line | checkbox / checkbox | 6px | 40 | 190.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| 2. Ground Sumac 100 gسماق ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0005 · Ground Sumac 100 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 3. Lavash Bread 500 gنان لواش ۵۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0006 · Lavash Bread 500 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 4. Sour Cherry Juice 1 Lآب آلبالو ۱ لیتری | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0003 · Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular receipt | widget / widget | 999px | 40 | 123.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Short-dated (expiry discount) | widget / widget | 999px | 40 | 211.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 5. Dried Barberries 100 gزرشک خشک ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Create pending new product | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 6. Potato Chips 150 gچیپس سیب‌زمینی ۱۵۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0009 · Potato Chips 150 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Grocery (Taxable) | combobox / combobox | 12px | 45 | 178.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 362.81 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Add line | secondary / action | 12px | 40 | 88.56 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| + Add new product | secondary / action | 12px | 40 | 161.88 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Choose an answer | combobox / combobox | 12px | 45 | 214.41 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save as draft | secondary / action | 12px | 40 | 121.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Post invoice | primary / action | 12px | 40 | 115.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتور جدید | secondary / action | 12px | 40 | 99.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بارگذاری | primary / action | 12px | 40 | 77.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ورود دستی | secondary / action | 12px | 40 | 94.11 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب فایل | secondary / action | 12px | 40 | 87.75 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| جزئیات فاکتور | disclosure / disclosure | 0px | 40 | 936 | desktop-fa-light / supervisor | 1 |
| بدون سفارش مرتبط | combobox / combobox | 12px | 45 | 168.45 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 1. باقالا کنسرو شده ۴۰۰ گرمیCanned Fava Beans 400 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| کارتن | combobox / combobox | 12px | 45 | 88.11 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| 0002 · باقالا کنسرو شده ۴۰۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مواد غذایی | combobox / combobox | 12px | 45 | 217.13 | desktop-fa-light, phone-fa-light / supervisor | 10 |
| ثبت کسری | checkbox / checkbox | 6px | 40 | 91.23 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| بله | widget / widget | 999px | 40 | 44.72 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| خیر | widget / widget | 999px | 40 | 48.89 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| انقضا | combobox / combobox | 12px | 45 | 164.38 | desktop-fa-light, phone-fa-light / supervisor | 10 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 432 | desktop-fa-light / supervisor | 5 |
| تأیید این ردیف فاکتور | checkbox / checkbox | 6px | 40 | 147.22 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| 2. سماق ۱۰۰ گرمیGround Sumac 100 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0005 · سماق ۱۰۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 3. نان لواش ۵۰۰ گرمیLavash Bread 500 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0006 · نان لواش ۵۰۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 4. آب آلبالو ۱ لیتریSour Cherry Juice 1 L | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0003 · آب آلبالو ۱ لیتری | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت عادی | widget / widget | 999px | 40 | 95.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نزدیک انقضا (تخفیف انقضا) | widget / widget | 999px | 40 | 171.84 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 5. زرشک خشک ۱۰۰ گرمیDried Barberries 100 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| ایجاد کالای جدید در انتظار | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 6. چیپس سیب‌زمینی ۱۵۰ گرمیPotato Chips 150 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0009 · چیپس سیب‌زمینی ۱۵۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مواد غذایی (مشمول مالیات) | combobox / combobox | 12px | 45 | 217.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 0002 · باقالا کنسرو شده ۴۰۰ گرمی | combobox / combobox | 12px | 45 | 317.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن ردیف | secondary / action | 12px | 40 | 103.91 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| + افزودن کالای جدید | secondary / action | 12px | 40 | 149.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاسخ را انتخاب کنید | combobox / combobox | 12px | 45 | 235.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره به عنوان پیش‌نویس | secondary / action | 12px | 40 | 180.42 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت فاکتور | primary / action | 12px | 40 | 92.72 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| واگرد | secondary / action | 12px | 40 | 61.36 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Invoice details | disclosure / disclosure | 0px | 40 | 318 | phone-en-light, phone-en-dark / supervisor | 2 |
| 1. Canned Fava Beans 400 gباقالا کنسرو شده ۴۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 808 | phone-en-light, phone-en-dark / supervisor | 10 |
| 2. Ground Sumac 100 gسماق ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 3. Lavash Bread 500 gنان لواش ۵۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 4. Sour Cherry Juice 1 Lآب آلبالو ۱ لیتری | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 5. Dried Barberries 100 gزرشک خشک ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 6. Potato Chips 150 gچیپس سیب‌زمینی ۱۵۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 318 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| گرفتن عکس | secondary / action | 12px | 40 | 113.17 | phone-fa-light / supervisor | 1 |
| جزئیات فاکتور | disclosure / disclosure | 0px | 40 | 318 | phone-fa-light / supervisor | 1 |
| 1. باقالا کنسرو شده ۴۰۰ گرمیCanned Fava Beans 400 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 808 | phone-fa-light / supervisor | 5 |
| 2. سماق ۱۰۰ گرمیGround Sumac 100 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 3. نان لواش ۵۰۰ گرمیLavash Bread 500 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 4. آب آلبالو ۱ لیتریSour Cherry Juice 1 L | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 5. زرشک خشک ۱۰۰ گرمیDried Barberries 100 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 6. چیپس سیب‌زمینی ۱۵۰ گرمیPotato Chips 150 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |

### Simulated invoice upload review

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| New invoice | secondary / action | 12px | 40 | 115.72 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Remove file | quiet / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Invoice details | disclosure / disclosure | 0px | 40 | 936 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| No linked order | combobox / combobox | 12px | 45 | 161.42 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 1. Canned Fava Beans 400 gباقالا کنسرو شده ۴۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Cases | combobox / combobox | 12px | 45 | 101.03 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Grocery | combobox / combobox | 12px | 45 | 178.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 20 |
| Mark as short | checkbox / checkbox | 6px | 40 | 122.95 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| Yes | widget / widget | 999px | 40 | 52.28 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| No | widget / widget | 999px | 40 | 47.59 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| Expiry | combobox / combobox | 12px | 45 | 136.34 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 20 |
| Choose date | date / date | 12px | 44 | 432 | desktop-en-light, desktop-en-dark / supervisor | 10 |
| Confirm this invoice line | checkbox / checkbox | 6px | 40 | 190.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 24 |
| 2. Ground Sumac 100 gسماق ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0005 · Ground Sumac 100 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 3. Lavash Bread 500 gنان لواش ۵۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0006 · Lavash Bread 500 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 4. Sour Cherry Juice 1 Lآب آلبالو ۱ لیتری | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0003 · Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Regular receipt | widget / widget | 999px | 40 | 123.05 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Short-dated (expiry discount) | widget / widget | 999px | 40 | 211.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 5. Dried Barberries 100 gزرشک خشک ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Create pending new product | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 6. Potato Chips 150 gچیپس سیب‌زمینی ۱۵۰ گرمی | widget / widget | 0px | 46.5 | 298.25 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0009 · Potato Chips 150 g | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Grocery (Taxable) | combobox / combobox | 12px | 45 | 178.89 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 362.81 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Add line | secondary / action | 12px | 40 | 88.56 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| + Add new product | secondary / action | 12px | 40 | 161.88 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Choose an answer | combobox / combobox | 12px | 45 | 214.41 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Save as draft | secondary / action | 12px | 40 | 121.27 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Post invoice | primary / action | 12px | 40 | 115.19 | desktop-en-light, desktop-en-dark, phone-en-light, phone-en-dark / supervisor | 4 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light, phone-en-dark / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتور جدید | secondary / action | 12px | 40 | 99.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| حذف فایل | quiet / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب فایل | secondary / action | 12px | 40 | 87.75 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دانلود | secondary / action | 12px | 40 | 89.95 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| جزئیات فاکتور | disclosure / disclosure | 0px | 40 | 936 | desktop-fa-light / supervisor | 1 |
| بدون سفارش مرتبط | combobox / combobox | 12px | 45 | 168.45 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 1. باقالا کنسرو شده ۴۰۰ گرمیCanned Fava Beans 400 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| کارتن | combobox / combobox | 12px | 45 | 88.11 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| 0002 · باقالا کنسرو شده ۴۰۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مواد غذایی | combobox / combobox | 12px | 45 | 217.13 | desktop-fa-light, phone-fa-light / supervisor | 10 |
| ثبت کسری | checkbox / checkbox | 6px | 40 | 91.23 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| بله | widget / widget | 999px | 40 | 44.72 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| خیر | widget / widget | 999px | 40 | 48.89 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| انقضا | combobox / combobox | 12px | 45 | 164.38 | desktop-fa-light, phone-fa-light / supervisor | 10 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 432 | desktop-fa-light / supervisor | 5 |
| تأیید این ردیف فاکتور | checkbox / checkbox | 6px | 40 | 147.22 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| 2. سماق ۱۰۰ گرمیGround Sumac 100 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0005 · سماق ۱۰۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 3. نان لواش ۵۰۰ گرمیLavash Bread 500 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0006 · نان لواش ۵۰۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 4. آب آلبالو ۱ لیتریSour Cherry Juice 1 L | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0003 · آب آلبالو ۱ لیتری | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دریافت عادی | widget / widget | 999px | 40 | 95.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نزدیک انقضا (تخفیف انقضا) | widget / widget | 999px | 40 | 171.84 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 5. زرشک خشک ۱۰۰ گرمیDried Barberries 100 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| ایجاد کالای جدید در انتظار | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 6. چیپس سیب‌زمینی ۱۵۰ گرمیPotato Chips 150 g | widget / widget | 0px | 44.5 | 298.25 | desktop-fa-light / supervisor | 1 |
| 0009 · چیپس سیب‌زمینی ۱۵۰ گرمی | combobox / combobox | 12px | 45 | 277.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مواد غذایی (مشمول مالیات) | combobox / combobox | 12px | 45 | 217.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 0002 · باقالا کنسرو شده ۴۰۰ گرمی | combobox / combobox | 12px | 45 | 317.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن ردیف | secondary / action | 12px | 40 | 103.91 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| + افزودن کالای جدید | secondary / action | 12px | 40 | 149.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاسخ را انتخاب کنید | combobox / combobox | 12px | 45 | 235.64 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ذخیره به عنوان پیش‌نویس | secondary / action | 12px | 40 | 180.42 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت فاکتور | primary / action | 12px | 40 | 92.72 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-light, phone-en-dark / supervisor | 2 |
| Invoice details | disclosure / disclosure | 0px | 40 | 318 | phone-en-light, phone-en-dark / supervisor | 2 |
| 1. Canned Fava Beans 400 gباقالا کنسرو شده ۴۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 808 | phone-en-light, phone-en-dark / supervisor | 10 |
| 2. Ground Sumac 100 gسماق ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 3. Lavash Bread 500 gنان لواش ۵۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 4. Sour Cherry Juice 1 Lآب آلبالو ۱ لیتری | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 5. Dried Barberries 100 gزرشک خشک ۱۰۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 6. Potato Chips 150 gچیپس سیب‌زمینی ۱۵۰ گرمی | widget / widget | 0px | 46.5 | 272.39 | phone-en-light, phone-en-dark / supervisor | 2 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 318 | phone-en-light, phone-en-dark / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| گرفتن عکس | secondary / action | 12px | 40 | 113.17 | phone-fa-light / supervisor | 1 |
| جزئیات فاکتور | disclosure / disclosure | 0px | 40 | 318 | phone-fa-light / supervisor | 1 |
| 1. باقالا کنسرو شده ۴۰۰ گرمیCanned Fava Beans 400 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 808 | phone-fa-light / supervisor | 5 |
| 2. سماق ۱۰۰ گرمیGround Sumac 100 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 3. نان لواش ۵۰۰ گرمیLavash Bread 500 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 4. آب آلبالو ۱ لیتریSour Cherry Juice 1 L | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 5. زرشک خشک ۱۰۰ گرمیDried Barberries 100 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| 6. چیپس سیب‌زمینی ۱۵۰ گرمیPotato Chips 150 g | widget / widget | 0px | 44.5 | 272.39 | phone-fa-light / supervisor | 1 |
| واگرد | secondary / action | 12px | 40 | 61.36 | phone-fa-light / supervisor | 1 |

### Lookup date tracking Off and inline Add

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Scan barcode | icon / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit Basmati Rice 4.5 kg | secondary / action | 12px | 40 | 59.39 | desktop-en-light, phone-en-light / supervisor | 2 |
| Date tracking | switch / switch | 6px | 40 | 66.53 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 168 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add | primary / action | 12px | 40 | 61.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| Basmati Rice 4.5 kgبرنج باسماتی ۴٫۵ کیلوگرمیProduct Code 0001$23.99 | option / option | 12px | 76 | 832 | desktop-en-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Basmati Rice 4.5 kgبرنج باسماتی ۴٫۵ کیلوگرمیProduct Code 0001$23.99 | option / option | 12px | 76 | 318 | phone-en-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Scan barcode | icon / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Date tracking | switch / switch | 6px | 40 | 66.53 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Choose date | date / date | 12px | 44 | 168 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Add | primary / action | 12px | 40 | 61.13 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Basmati Rice 4.5 kgبرنج باسماتی ۴٫۵ کیلوگرمیProduct Code 0001$23.99 | option / option | 12px | 76 | 832 | desktop-en-light / floor_worker | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |
| Basmati Rice 4.5 kgبرنج باسماتی ۴٫۵ کیلوگرمیProduct Code 0001$23.99 | option / option | 12px | 76 | 318 | phone-en-light / floor_worker | 1 |

### Record return pickup form

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | primary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 4 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-light / supervisor | 1 |

### Waiting for credit across return states

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Open | tab / tab | 999px | 40 | 63.17 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| History | tab / tab | 999px | 40 | 74 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Status | combobox / combobox | 12px | 44 | 179.98 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Return branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 98.13 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Record resolution | secondary / action | 12px | 40 | 131.28 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 8 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز | tab / tab | 999px | 40 | 41.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخچه | tab / tab | 999px | 40 | 70.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 159.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه مرجوعی | combobox / combobox | 12px | 44 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 113.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت حل‌وفصل | secondary / action | 12px | 40 | 95.53 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |

### Posted invoice

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| New invoice | primary / action | 12px | 40 | 115.72 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اصلاح فاکتور | primary / action | 12px | 40 | 103.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتقال فاکتور | secondary / action | 12px | 40 | 103.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دانلود | secondary / action | 12px | 40 | 89.95 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Move invoice dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| New invoice | primary / action | 12px | 40 | 115.72 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Choose an option | combobox / combobox | 12px | 45 | 168.14 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Move invoice | primary / action | 12px | 40 | 122.5 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اصلاح فاکتور | primary / action | 12px | 40 | 103.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتقال فاکتور | secondary / action | 12px | 40 | 103.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دانلود | secondary / action | 12px | 40 | 89.95 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| یک گزینه انتخاب کنید | combobox / combobox | 12px | 45 | 169.53 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انصراف | secondary / action | 12px | 40 | 73.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتقال فاکتور | primary / action | 12px | 40 | 103.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Correct invoice

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Cases | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 12 |
| Yes | widget / widget | 999px | 40 | 52.28 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 24 |
| No | widget / widget | 999px | 40 | 47.59 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 24 |
| Expiry | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 12 |
| Choose date | date / date | 12px | 44 | 386 | desktop-en-light, desktop-en-dark / supervisor | 12 |
| 0005 · Ground Sumac 100 g | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0006 · Lavash Bread 500 g | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0003 · Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0015 · Dried Barberries 100 g | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| 0009 · Potato Chips 150 g | combobox / combobox | 12px | 45 | 300 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Preview correction | primary / action | 12px | 40 | 159.75 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| New invoice | primary / action | 12px | 40 | 115.72 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 2 |
| Cases | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 12 |
| Expiry | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 12 |
| Choose date | date / date | 12px | 44 | 270 | phone-en-light, phone-en-dark / supervisor | 12 |
| 0005 · Ground Sumac 100 g | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 2 |
| 0006 · Lavash Bread 500 g | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 2 |
| 0003 · Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 2 |
| 0015 · Dried Barberries 100 g | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 2 |
| 0009 · Potato Chips 150 g | combobox / combobox | 12px | 45 | 270 | phone-en-light, phone-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| 0002 · باقالا کنسرو شده ۴۰۰ گرمی | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 1 |
| کارتن | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 6 |
| بله | widget / widget | 999px | 40 | 44.72 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| خیر | widget / widget | 999px | 40 | 48.89 | desktop-fa-light, phone-fa-light / supervisor | 12 |
| انقضا | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 6 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 386 | desktop-fa-light / supervisor | 6 |
| 0005 · سماق ۱۰۰ گرمی | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 1 |
| 0006 · نان لواش ۵۰۰ گرمی | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 1 |
| 0003 · آب آلبالو ۱ لیتری | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 1 |
| 0015 · زرشک خشک 100 گرمی | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 1 |
| 0009 · چیپس سیب‌زمینی ۱۵۰ گرمی | combobox / combobox | 12px | 45 | 300 | desktop-fa-light / supervisor | 1 |
| انصراف | secondary / action | 12px | 40 | 73.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نمایش اصلاح | primary / action | 12px | 40 | 135.98 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اصلاح فاکتور | primary / action | 12px | 40 | 103.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتقال فاکتور | secondary / action | 12px | 40 | 103.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دانلود | secondary / action | 12px | 40 | 89.95 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| 0002 · باقالا کنسرو شده ۴۰۰ گرمی | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 1 |
| کارتن | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 6 |
| انقضا | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 6 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 270 | phone-fa-light / supervisor | 6 |
| 0005 · سماق ۱۰۰ گرمی | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 1 |
| 0006 · نان لواش ۵۰۰ گرمی | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 1 |
| 0003 · آب آلبالو ۱ لیتری | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 1 |
| 0015 · زرشک خشک 100 گرمی | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 1 |
| 0009 · چیپس سیب‌زمینی ۱۵۰ گرمی | combobox / combobox | 12px | 45 | 270 | phone-fa-light / supervisor | 1 |

### Return policy

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light, desktop-en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Download full policy | secondary / action | 12px | 40 | 169.38 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Close | primary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Record pickup | primary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light, desktop-en-dark, phone-en-dark / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light, phone-en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دانلود سیاست کامل | secondary / action | 12px | 40 | 144.44 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بستن | primary / action | 12px | 40 | 65.22 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| سیاست مرجوعی | secondary / action | 12px | 40 | 126 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت جمع‌آوری | primary / action | 12px | 40 | 110.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغو مرجوعی | danger / action | 12px | 40 | 100.28 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |

### Create offer dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Create offer | primary / action | 12px | 40 | 114.09 | desktop-en-light, phone-en-light / supervisor | 4 |
| Current offers | tab / tab | 999px | 40 | 116 | desktop-en-light, phone-en-light / supervisor | 2 |
| Past offers | tab / tab | 999px | 40 | 96.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Mix-and-match pools | tab / tab | 999px | 40 | 161.75 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer category | combobox / combobox | 12px | 44 | 174.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer type | combobox / combobox | 12px | 44 | 152.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Stop offer | danger / action | 12px | 40 | 83.56 | desktop-en-light, phone-en-light / supervisor | 10 |
| Sour Cherry Juice 1 L · 0003 | combobox / combobox | 12px | 45 | 308.45 | desktop-en-light, phone-en-light / supervisor | 2 |
| Company default price | combobox / combobox | 12px | 45 | 263.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 326 | desktop-en-light / supervisor | 2 |
| Join the mix-and-match pool | checkbox / checkbox | 6px | 40 | 672 | desktop-en-light / supervisor | 1 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Choose date | date / date | 12px | 44 | 310 | phone-en-light / supervisor | 2 |
| Join the mix-and-match pool | checkbox / checkbox | 6px | 40 | 310 | phone-en-light / supervisor | 1 |

### Stop offer confirmation

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Create offer | primary / action | 12px | 40 | 114.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Current offers | tab / tab | 999px | 40 | 116 | desktop-en-light, phone-en-light / supervisor | 2 |
| Past offers | tab / tab | 999px | 40 | 96.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Mix-and-match pools | tab / tab | 999px | 40 | 161.75 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer category | combobox / combobox | 12px | 44 | 174.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Offer type | combobox / combobox | 12px | 44 | 152.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Stop offer | danger / action | 12px | 40 | 83.56 | desktop-en-light, phone-en-light / supervisor | 10 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Stop offer | danger / action | 12px | 40 | 100.3 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Return original-goods cancellation form

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | primary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose disposition | combobox / combobox | 12px | 45 | 362.94 | desktop-en-light / supervisor | 1 |
| I inspected these physically recovered originals and confirm they are safe and sellable. | checkbox / checkbox | 6px | 40 | 912 | desktop-en-light / supervisor | 1 |
| Record cancellation disposition | primary / action | 12px | 40 | 243.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Choose disposition | combobox / combobox | 12px | 45 | 318 | phone-en-light / supervisor | 1 |
| I inspected these physically recovered originals and confirm they are safe and sellable. | checkbox / checkbox | 6px | 71 | 318 | phone-en-light / supervisor | 1 |

### Retained return memo dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Print | primary / action | 12px | 40 | 65.23 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | primary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-light / supervisor | 1 |

### Return settlement form: Replaced

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Replaced | combobox / combobox | 12px | 45 | 247.47 | desktop-en-light, phone-en-light / supervisor | 2 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 262.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| 2026-10-10 | date / date | 12px | 45 | 446 | desktop-en-light / supervisor | 1 |
| Fully resolves the original return (otherwise partial) | checkbox / checkbox | 6px | 72.5 | 446 | desktop-en-light / supervisor | 1 |
| Receive replacement | primary / action | 12px | 40 | 174.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / floor_worker | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Replaced | combobox / combobox | 12px | 45 | 247.47 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 262.41 | desktop-en-light, phone-en-light / floor_worker | 2 |
| 2026-10-10 | date / date | 12px | 45 | 446 | desktop-en-light / floor_worker | 1 |
| Fully resolves the original return (otherwise partial) | checkbox / checkbox | 6px | 72.5 | 446 | desktop-en-light / floor_worker | 1 |
| Receive replacement | primary / action | 12px | 40 | 174.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-light / supervisor | 1 |
| 2026-10-10 | date / date | 12px | 45 | 318 | phone-en-light / supervisor | 1 |
| Fully resolves the original return (otherwise partial) | checkbox / checkbox | 6px | 50 | 318 | phone-en-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-light / floor_worker | 1 |
| 2026-10-10 | date / date | 12px | 45 | 318 | phone-en-light / floor_worker | 1 |
| Fully resolves the original return (otherwise partial) | checkbox / checkbox | 6px | 50 | 318 | phone-en-light / floor_worker | 1 |

### Return settlement form: Credited

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Credited | combobox / combobox | 12px | 45 | 247.47 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose an invoice | combobox / combobox | 12px | 45 | 181.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Submit claim | primary / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / floor_worker | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Credited | combobox / combobox | 12px | 45 | 247.47 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Choose an invoice | combobox / combobox | 12px | 45 | 181.86 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Submit claim | primary / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Return settlement form: Cash or other compensation

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cash or other compensation | combobox / combobox | 12px | 45 | 247.47 | desktop-en-light, phone-en-light / supervisor | 2 |
| Submit claim | primary / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / floor_worker | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Cash or other compensation | combobox / combobox | 12px | 45 | 247.47 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Submit claim | primary / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Return settlement form: Written off

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| RM-0001 | secondary / action | 12px | 40 | 101.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel return | danger / action | 12px | 40 | 124.78 | desktop-en-light, phone-en-light / supervisor | 2 |
| Written off | combobox / combobox | 12px | 45 | 247.47 | desktop-en-light, phone-en-light / supervisor | 2 |
| Submit claim | primary / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### invoices

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| حذف فایل | quiet / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| انتخاب فایل | secondary / action | 12px | 40 | 87.75 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دانلود | secondary / action | 12px | 40 | 89.95 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| گرفتن عکس | secondary / action | 12px | 40 | 113.17 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| New invoice | primary / action | 12px | 40 | 115.72 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Remove file | quiet / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Browse | secondary / action | 12px | 40 | 72.38 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light / supervisor | 2 |
| Take photo | secondary / action | 12px | 40 | 118.86 | phone-en-dark, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |

### products

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن محصول | primary / action | 12px | 40 | 120.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دستهٔ قیمت‌گذاری | combobox / combobox | 12px | 44 | 217.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دستهٔ هوش مصنوعی | combobox / combobox | 12px | 44 | 229.27 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 146.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای قیمت در انتظار تأیید | checkbox / checkbox | 6px | 44 | 173.78 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای پیشنهاد | checkbox / checkbox | 6px | 44 | 106.47 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قیمت‌های دستی | checkbox / checkbox | 6px | 44 | 123.39 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| محصول ↑ | quiet / widget | 12px | 40 | 57.89 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کد محصول | quiet / widget | 12px | 40 | 59.56 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قیمت تأییدشده | quiet / widget | 12px | 40 | 77.59 | desktop-fa-light / supervisor | 1 |
| ویرایش آب آلبالو ۱ لیتری | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اقدامات کالا | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 16 |
| ویرایش اسفنج ظرفشویی بسته ۳ عددی | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش بادام فله | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش باقالا کنسرو شده ۴۰۰ گرمی | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش برنج باسماتی ۴٫۵ کیلوگرمی | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش پلوپز ۱٫۸ لیتری | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش چای سیاه ۴۵۰ گرمی | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ویرایش چیپس سیب‌زمینی ۱۵۰ گرمی | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قبلی | secondary / action | 12px | 40 | 58.94 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بعدی | secondary / action | 12px | 40 | 63.75 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| قیمت تأییدشده | quiet / widget | 12px | 40 | 83.34 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Add product | primary / action | 12px | 40 | 117.05 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Pricing category | combobox / combobox | 12px | 44 | 199.88 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Has pending price | checkbox / checkbox | 6px | 44 | 152.89 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Has offer | checkbox / checkbox | 6px | 44 | 92.83 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Manual prices | checkbox / checkbox | 6px | 44 | 125.17 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Product ↑ | quiet / widget | 12px | 40 | 65.39 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Product Code | quiet / widget | 12px | 40 | 72.31 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Approved price | quiet / widget | 12px | 40 | 79.41 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Edit Basmati Rice 4.5 kg | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Product actions | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 28 |
| Edit Black Tea 450 g | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Edit Bulk Almonds | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Edit Canned Fava Beans 400 g | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Edit Dried Barberries 100 g | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Edit Dried Red Kidney Beans 900 g | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Edit Fruit Soda 6-pack | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Edit Ground Sumac 100 g | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Previous | secondary / action | 12px | 40 | 92.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Next | secondary / action | 12px | 40 | 65.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light / supervisor | 2 |
| Product Code | quiet / widget | 12px | 40 | 84 | phone-en-dark, phone-en-light / supervisor | 2 |
| Approved price | quiet / widget | 12px | 40 | 92 | phone-en-dark, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |

### Products weighed item

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن محصول | primary / action | 12px | 40 | 120.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دستهٔ قیمت‌گذاری | combobox / combobox | 12px | 44 | 217.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دستهٔ هوش مصنوعی | combobox / combobox | 12px | 44 | 229.27 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 146.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای قیمت در انتظار تأیید | checkbox / checkbox | 6px | 44 | 173.78 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دارای پیشنهاد | checkbox / checkbox | 6px | 44 | 106.47 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قیمت‌های دستی | checkbox / checkbox | 6px | 44 | 123.39 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| محصول ↑ | quiet / widget | 12px | 40 | 57.89 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| کد محصول | quiet / widget | 12px | 40 | 59.56 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قیمت تأییدشده | quiet / widget | 12px | 40 | 77.59 | desktop-fa-light / supervisor | 1 |
| ویرایش بادام فله | secondary / action | 12px | 40 | 60.16 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اقدامات کالا | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| قبلی | secondary / action | 12px | 40 | 58.94 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بعدی | secondary / action | 12px | 40 | 63.75 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| قیمت تأییدشده | quiet / widget | 12px | 40 | 83.34 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Add product | primary / action | 12px | 40 | 117.05 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Pricing category | combobox / combobox | 12px | 44 | 199.88 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Has pending price | checkbox / checkbox | 6px | 44 | 152.89 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Has offer | checkbox / checkbox | 6px | 44 | 92.83 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Manual prices | checkbox / checkbox | 6px | 44 | 125.17 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Product ↑ | quiet / widget | 12px | 40 | 65.39 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Product Code | quiet / widget | 12px | 40 | 72.31 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Approved price | quiet / widget | 12px | 40 | 79.41 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Edit Bulk Almonds | secondary / action | 12px | 40 | 45.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Product actions | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Previous | secondary / action | 12px | 40 | 92.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Next | secondary / action | 12px | 40 | 65.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light / supervisor | 2 |
| Product Code | quiet / widget | 12px | 40 | 84 | phone-en-dark, phone-en-light / supervisor | 2 |
| Approved price | quiet / widget | 12px | 40 | 92 | phone-en-dark, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |

### alerts

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light, fa-light / supervisor | 2 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light, fa-light / supervisor | 2 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| نمایش هشدارهای حل‌شده و عمدی | checkbox / checkbox | 6px | 40 | 226.25 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| اعمال این قیمت به همه | secondary / action | 12px | 40 | 156.27 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 6 |
| ثبت به عنوان عمدی | primary / action | 12px | 40 | 143.16 | desktop-fa-light, phone-fa-light, fa-light / supervisor | 3 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light, en-light, en-dark / supervisor | 4 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light, en-light, en-dark / supervisor | 4 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 7 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 7 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, en-dark / supervisor | 3 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 7 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 7 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 7 |
| Show resolved and intentional alerts | checkbox / checkbox | 6px | 40 | 271.27 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 7 |
| Apply this price to all | secondary / action | 12px | 40 | 162.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 14 |
| Mark as intentional | primary / action | 12px | 40 | 161.02 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light, en-light, en-dark, phone / supervisor | 7 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light, en-light, phone / supervisor | 4 |

### returns

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز | tab / tab | 999px | 40 | 41.69 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخچه | tab / tab | 999px | 40 | 70.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت | combobox / combobox | 12px | 44 | 159.13 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه مرجوعی | combobox / combobox | 12px | 44 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 113.31 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت جمع‌آوری | secondary / action | 12px | 40 | 93.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ثبت حل‌وفصل | secondary / action | 12px | 40 | 95.53 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Open | tab / tab | 999px | 40 | 63.17 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| History | tab / tab | 999px | 40 | 74 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Status | combobox / combobox | 12px | 44 | 179.98 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Return branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 98.13 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Record pickup | secondary / action | 12px | 40 | 111.48 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Record resolution | secondary / action | 12px | 40 | 131.28 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |

### expiry

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 168 | desktop-fa-light / supervisor | 1 |
| نورث یورک | combobox / combobox | 12px | 45 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بیشتر | secondary / action | 12px | 40 | 65.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| افزودن | primary / action | 12px | 40 | 72.06 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| بازه زمانی | combobox / combobox | 12px | 44 | 193.63 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دسته‌بندی هوش مصنوعی | combobox / combobox | 12px | 44 | 192.8 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مکان پیگیری تاریخ | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| مرتب‌سازی بر اساس | combobox / combobox | 12px | 44 | 104.23 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| حذف | danger / action | 12px | 40 | 49.17 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| بیشتر | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 153 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Choose date | date / date | 12px | 44 | 168 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| North York | combobox / combobox | 12px | 45 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| More | secondary / action | 12px | 40 | 68.61 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Add | primary / action | 12px | 40 | 61.13 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Time window | combobox / combobox | 12px | 44 | 217.13 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Date tracking location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Sort by | combobox / combobox | 12px | 44 | 111.81 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Remove | danger / action | 12px | 40 | 71.91 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 8 |
| More | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 8 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 153 | phone-en-dark, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |

### offers

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ایجاد پیشنهاد | primary / action | 12px | 40 | 109.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیشنهادهای فعلی | tab / tab | 999px | 40 | 121.72 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پیشنهادهای قبلی | tab / tab | 999px | 40 | 118.78 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| گروه‌های ترکیبی | tab / tab | 999px | 40 | 109.97 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| وضعیت پیشنهاد | combobox / combobox | 12px | 44 | 146.2 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دسته پیشنهاد | combobox / combobox | 12px | 44 | 186.59 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأمین‌کننده پیشنهاد | combobox / combobox | 12px | 44 | 226.61 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| شعبه پیشنهاد | combobox / combobox | 12px | 44 | 133.34 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| نوع پیشنهاد | combobox / combobox | 12px | 44 | 161.06 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| توقف پیشنهاد | danger / action | 12px | 40 | 94.41 | desktop-fa-light, phone-fa-light / supervisor | 10 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Create offer | primary / action | 12px | 40 | 114.09 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Current offers | tab / tab | 999px | 40 | 116 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Past offers | tab / tab | 999px | 40 | 96.25 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Mix-and-match pools | tab / tab | 999px | 40 | 161.75 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Offer status | combobox / combobox | 12px | 44 | 136.08 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Offer category | combobox / combobox | 12px | 44 | 174.11 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Offer supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Offer branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Offer type | combobox / combobox | 12px | 44 | 152.41 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Stop offer | danger / action | 12px | 40 | 83.56 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 20 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |

### approvals

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| روزانه | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| کاتالوگ | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| سرپرست | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| مدیریت | quiet / widget | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | desktop-fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | desktop-fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| در انتظار | tab / tab | 999px | 40 | 72.17 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأییدشده | tab / tab | 999px | 40 | 77.06 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| ردشده | tab / tab | 999px | 40 | 62.88 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| جایگزین‌شده | tab / tab | 999px | 40 | 94.92 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| تأیید قیمت | primary / action | 12px | 40 | 96.3 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| رد کردن | danger / action | 12px | 40 | 75.5 | desktop-fa-light, phone-fa-light / supervisor | 4 |
| تأیید کالا | primary / action | 12px | 40 | 81.83 | desktop-fa-light, phone-fa-light / supervisor | 2 |
| باز کردن منو | secondary / icon | 50% | 40 | 40 | phone-fa-light / supervisor | 1 |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-dark, desktop-en-light / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Pending | tab / tab | 999px | 40 | 80.27 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Approved | tab / tab | 999px | 40 | 89.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Rejected | tab / tab | 999px | 40 | 83.58 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Superseded | tab / tab | 999px | 40 | 104.41 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Approve price | primary / action | 12px | 40 | 128.33 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Reject | danger / action | 12px | 40 | 75.7 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 8 |
| Approve product | primary / action | 12px | 40 | 146.5 | desktop-en-dark, phone-en-dark, desktop-en-light, phone-en-light / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-dark, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |

### Date quick-add with More

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| 2026-10-10 | date / date | 12px | 45 | 168 | desktop-en-light / supervisor | 1 |
| North York | combobox / combobox | 12px | 45 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| More | secondary / action | 12px | 40 | 68.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add | primary / action | 12px | 40 | 61.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| Expiry | combobox / combobox | 12px | 45 | 136.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Time window | combobox / combobox | 12px | 44 | 217.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Date tracking location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by | combobox / combobox | 12px | 44 | 111.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Remove | danger / action | 12px | 40 | 71.91 | desktop-en-light, phone-en-light / supervisor | 4 |
| More | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| 2026-10-10 | date / date | 12px | 45 | 153 | phone-en-light / supervisor | 1 |

### New shelf date and Undo

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| 2026-10-10 | date / date | 12px | 45 | 168 | desktop-en-light / supervisor | 1 |
| North York | combobox / combobox | 12px | 45 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| More | secondary / action | 12px | 40 | 68.61 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add | primary / action | 12px | 40 | 61.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| Expiry | combobox / combobox | 12px | 45 | 136.34 | desktop-en-light, phone-en-light / supervisor | 2 |
| Time window | combobox / combobox | 12px | 44 | 217.13 | desktop-en-light, phone-en-light / supervisor | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Date tracking location | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Sort by | combobox / combobox | 12px | 44 | 111.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Columns | secondary / action | 12px | 40 | 119.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Remove | danger / action | 12px | 40 | 71.91 | desktop-en-light, phone-en-light / supervisor | 6 |
| More | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 6 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| 2026-10-10 | date / date | 12px | 45 | 153 | phone-en-light / supervisor | 1 |

### Request catalog search result

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, phone-en-light / floor_worker | 2 |
| North York | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Warehouse | combobox / combobox | 12px | 45 | 167.2 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Add | secondary / action | 12px | 40 | 51.19 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Add item | secondary / action | 12px | 40 | 93.67 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Send | primary / action | 12px | 40 | 68.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Save as draft | secondary / action | 12px | 40 | 121.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Requested branch request

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Cancel request | danger / action | 12px | 40 | 135.19 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Request Short decision and Mark as sent

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 1 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, phone-en-light / supervisor | 2 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, phone-en-light / supervisor | 2 |
| Being sent | checkbox / checkbox | 6px | 40 | 101.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Short | primary / action | 12px | 40 | 59.75 | desktop-en-light, phone-en-light / supervisor | 2 |
| Mark as sent | primary / action | 12px | 40 | 120.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Request Missing decision and Mark as received

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Arrived | checkbox / checkbox | 6px | 40 | 80.28 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Missing | primary / action | 12px | 40 | 74.3 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Mark as received | primary / action | 12px | 40 | 149.02 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Copy short or missing items | secondary / action | 12px | 40 | 220.83 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Received request and Close request

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Close request | primary / action | 12px | 40 | 126.73 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Copy short or missing items | secondary / action | 12px | 40 | 220.83 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Closed request and residual-copy action

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Copy short or missing items | secondary / action | 12px | 40 | 220.83 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / floor_worker | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Copied short or missing draft

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Back to requests | quiet / action | 12px | 40 | 170 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Print picking list | secondary / action | 12px | 40 | 164.77 | desktop-en-light, phone-en-light / floor_worker | 2 |
| REQ-0001 | secondary / action | 12px | 40 | 88.84 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Send | primary / action | 12px | 40 | 68.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Edit draft | secondary / action | 12px | 40 | 94.66 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Cancel request | danger / action | 12px | 40 | 135.19 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / floor_worker | 6 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Saved order Place/Edit/Print/Cancel actions

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Orders | quiet / action | 12px | 40 | 157.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit draft | secondary / action | 12px | 40 | 94.66 | desktop-en-light, phone-en-light / supervisor | 2 |
| Place order | primary / action | 12px | 40 | 110.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Print order | secondary / action | 12px | 40 | 128.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel order | danger / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Saved order print preview dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Orders | quiet / action | 12px | 40 | 157.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit draft | secondary / action | 12px | 40 | 94.66 | desktop-en-light, phone-en-light / supervisor | 2 |
| Place order | primary / action | 12px | 40 | 110.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Print order | secondary / action | 12px | 40 | 128.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel order | danger / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / supervisor | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Print | primary / action | 12px | 40 | 89.23 | desktop-en-light, phone-en-light / supervisor | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Cancel order Keep order confirmation

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back to Orders | quiet / action | 12px | 40 | 157.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit draft | secondary / action | 12px | 40 | 94.66 | desktop-en-light, phone-en-light / supervisor | 2 |
| Place order | primary / action | 12px | 40 | 110.41 | desktop-en-light, phone-en-light / supervisor | 2 |
| Print order | secondary / action | 12px | 40 | 128.86 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel order | danger / action | 12px | 40 | 120.11 | desktop-en-light, phone-en-light / supervisor | 4 |
| Keep order | secondary / action | 12px | 40 | 107.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Invoice correction preview Continue/Back actions

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back | secondary / action | 12px | 40 | 67.06 | desktop-en-light, phone-en-light / supervisor | 2 |
| Continue | primary / action | 12px | 40 | 94.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| New invoice | primary / action | 12px | 40 | 115.72 | desktop-en-light, phone-en-light / supervisor | 2 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, phone-en-light / supervisor | 2 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, phone-en-light / supervisor | 2 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, phone-en-light / supervisor | 2 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | desktop-en-light, phone-en-light / supervisor | 2 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | desktop-en-light, phone-en-light / supervisor | 2 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Invoice correction final confirmation

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Back | secondary / action | 12px | 40 | 67.06 | desktop-en-light, phone-en-light / supervisor | 2 |
| Confirm correction | primary / action | 12px | 40 | 160.55 | desktop-en-light, phone-en-light / supervisor | 2 |
| New invoice | primary / action | 12px | 40 | 115.72 | desktop-en-light, phone-en-light / supervisor | 2 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, phone-en-light / supervisor | 2 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, phone-en-light / supervisor | 2 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, phone-en-light / supervisor | 2 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | desktop-en-light, phone-en-light / supervisor | 2 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | desktop-en-light, phone-en-light / supervisor | 2 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Corrected posted invoice version actions

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 6 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| New invoice | primary / action | 12px | 40 | 115.72 | desktop-en-light, phone-en-light / supervisor | 2 |
| Drafts | tab / tab | 999px | 40 | 66.94 | desktop-en-light, phone-en-light / supervisor | 2 |
| Processing | tab / tab | 999px | 40 | 98.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| Needs review | tab / tab | 999px | 40 | 113.88 | desktop-en-light, phone-en-light / supervisor | 2 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | desktop-en-light, phone-en-light / supervisor | 2 |
| Posted | tab / tab | 999px | 40 | 72.56 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | desktop-en-light, phone-en-light / supervisor | 2 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | desktop-en-light, phone-en-light / supervisor | 2 |
| Original invoice | secondary / action | 12px | 40 | 137.42 | desktop-en-light, phone-en-light / supervisor | 2 |
| Correction 1 | secondary / action | 12px | 40 | 122.02 | desktop-en-light, phone-en-light / supervisor | 2 |
| Zoom out | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Zoom in | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fit width | secondary / action | 12px | 40 | 91.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Fit page | secondary / action | 12px | 40 | 87.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Download | secondary / action | 12px | 40 | 125.09 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Corrected History More actions menu

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 6 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Person | combobox / combobox | 12px | 44 | 174.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| History branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Action type | combobox / combobox | 12px | 44 | 160.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| From date | date / date | 12px | 44 | 180 | desktop-en-light, phone-en-light / supervisor | 2 |
| To date | date / date | 12px | 44 | 180 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| View corrected | secondary / action | 12px | 40 | 116.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| More actions | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| View original | menuitem / menuitem | 8px | 41 | 212 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Revert History change confirmation

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 6 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Person | combobox / combobox | 12px | 44 | 174.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| History branch | combobox / combobox | 12px | 44 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Action type | combobox / combobox | 12px | 44 | 160.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| From date | date / date | 12px | 44 | 180 | desktop-en-light, phone-en-light / supervisor | 2 |
| To date | date / date | 12px | 44 | 180 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Revert | secondary / action | 12px | 40 | 62.17 | desktop-en-light, phone-en-light / supervisor | 2 |
| View corrected | secondary / action | 12px | 40 | 116.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| More actions | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Revert change | primary / action | 12px | 40 | 130.77 | desktop-en-light, phone-en-light / supervisor | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Notebook entry Edit note action

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 6 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add note | primary / action | 12px | 40 | 118.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| New notebook | secondary / action | 12px | 40 | 155.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| To order | tab / tab | 999px | 40 | 81.73 | desktop-en-light, phone-en-light / supervisor | 2 |
| Store use | tab / tab | 999px | 40 | 88.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| For Supervisor 1 | tab / tab | 999px | 40 | 148.19 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deli temperatures 2 | tab / tab | 999px | 40 | 166.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit notebook | secondary / action | 12px | 40 | 150.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Archive notebook | secondary / action | 12px | 40 | 175.97 | desktop-en-light, phone-en-light / supervisor | 2 |
| Include done and ordered notes | checkbox / checkbox | 6px | 44 | 242.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit note | secondary / action | 12px | 40 | 116.86 | desktop-en-light, phone-en-light / supervisor | 4 |
| Mark done | secondary / action | 12px | 40 | 105.69 | desktop-en-light, phone-en-light / supervisor | 4 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Edit notebook entry form

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 6 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add note | primary / action | 12px | 40 | 118.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| New notebook | secondary / action | 12px | 40 | 155.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| To order | tab / tab | 999px | 40 | 81.73 | desktop-en-light, phone-en-light / supervisor | 2 |
| Store use | tab / tab | 999px | 40 | 88.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| For Supervisor 1 | tab / tab | 999px | 40 | 148.19 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deli temperatures 2 | tab / tab | 999px | 40 | 166.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit notebook | secondary / action | 12px | 40 | 150.25 | desktop-en-light, phone-en-light / supervisor | 2 |
| Archive notebook | secondary / action | 12px | 40 | 175.97 | desktop-en-light, phone-en-light / supervisor | 2 |
| Choose date | date / date | 12px | 44 | 326 | desktop-en-light / supervisor | 1 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Save changes | primary / action | 12px | 40 | 127.83 | desktop-en-light, phone-en-light / supervisor | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Include done and ordered notes | checkbox / checkbox | 6px | 44 | 242.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Edit note | secondary / action | 12px | 40 | 116.86 | desktop-en-light, phone-en-light / supervisor | 4 |
| Mark done | secondary / action | 12px | 40 | 105.69 | desktop-en-light, phone-en-light / supervisor | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| Choose date | date / date | 12px | 44 | 310 | phone-en-light / supervisor | 1 |

### Supervisor note Mark seen and Mark done actions

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 6 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add note | primary / action | 12px | 40 | 118.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| New notebook | secondary / action | 12px | 40 | 155.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| To order | tab / tab | 999px | 40 | 81.73 | desktop-en-light, phone-en-light / supervisor | 2 |
| Store use | tab / tab | 999px | 40 | 88.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| For Supervisor 1 | tab / tab | 999px | 40 | 148.19 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deli temperatures 2 | tab / tab | 999px | 40 | 166.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Include done and ordered notes | checkbox / checkbox | 6px | 44 | 242.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Mark seen | secondary / action | 12px | 40 | 104.33 | desktop-en-light, phone-en-light / supervisor | 2 |
| Mark done | secondary / action | 12px | 40 | 105.69 | desktop-en-light, phone-en-light / supervisor | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Completed notebook entry Mark open action

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Add note | primary / action | 12px | 40 | 118.59 | desktop-en-light, phone-en-light / supervisor | 2 |
| New notebook | secondary / action | 12px | 40 | 155.05 | desktop-en-light, phone-en-light / supervisor | 2 |
| To order | tab / tab | 999px | 40 | 81.73 | desktop-en-light, phone-en-light / supervisor | 2 |
| Store use | tab / tab | 999px | 40 | 88.31 | desktop-en-light, phone-en-light / supervisor | 2 |
| For Supervisor | tab / tab | 999px | 40 | 120.19 | desktop-en-light, phone-en-light / supervisor | 2 |
| Deli temperatures 2 | tab / tab | 999px | 40 | 166.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| Include done and ordered notes | checkbox / checkbox | 6px | 44 | 242.89 | desktop-en-light, phone-en-light / supervisor | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / supervisor | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / supervisor | 6 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### Return cancellation disposition submission

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record resolution | primary / action | 12px | 40 | 151.67 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Record pickup | secondary / action | 12px | 40 | 130.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Request cancellation | danger / action | 12px | 40 | 173.52 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Supplier still holds originals — restore zero | combobox / combobox | 12px | 45 | 362.94 | desktop-en-light / floor_worker | 1 |
| I inspected these physically recovered originals and confirm they are safe and sellable. | checkbox / checkbox | 6px | 40 | 912 | desktop-en-light / floor_worker | 1 |
| Record cancellation disposition | primary / action | 12px | 40 | 243.05 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Close | secondary / action | 12px | 40 | 72.02 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |
| Supplier still holds originals — restore zero | combobox / combobox | 12px | 45 | 318 | phone-en-light / floor_worker | 1 |
| I inspected these physically recovered originals and confirm they are safe and sellable. | checkbox / checkbox | 6px | 71 | 318 | phone-en-light / floor_worker | 1 |

### Return cancellation awaiting Supervisor

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Supervisor cancellation approve/decline review

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Return policy | secondary / action | 12px | 40 | 122.08 | desktop-en-light, phone-en-light / supervisor | 2 |
| Review cancellation | primary / action | 12px | 40 | 166.81 | desktop-en-light, phone-en-light / supervisor | 2 |
| I reviewed the history. Existing replacement or compensation is retained; no reversal is needed. | checkbox / checkbox | 6px | 40 | 912 | desktop-en-light / supervisor | 1 |
| Approve cancellation | primary / action | 12px | 40 | 175.38 | desktop-en-light, phone-en-light / supervisor | 2 |
| Decline cancellation | secondary / action | 12px | 40 | 168.92 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |
| I reviewed the history. Existing replacement or compensation is retained; no reversal is needed. | checkbox / checkbox | 6px | 71 | 318 | phone-en-light / supervisor | 1 |

### Saved label template archive action

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Waitlist | tab / tab | 999px | 40 | 74.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Template 1 | combobox / combobox | 12px | 45 | 183.89 | desktop-en-light, phone-en-light / floor_worker | 2 |
| New template | secondary / action | 12px | 40 | 126.2 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Show archived | checkbox / checkbox | 6px | 40 | 129.7 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Regular | combobox / combobox | 12px | 45 | 110.36 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Save template | primary / action | 12px | 40 | 128.78 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Print test alignment page | secondary / action | 12px | 40 | 201.17 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Duplicate template | secondary / action | 12px | 40 | 159.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Archive template | danger / action | 12px | 40 | 147.11 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |

### Archived label template restore action

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Waitlist | tab / tab | 999px | 40 | 74.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Template 1 · Archived | combobox / combobox | 12px | 45 | 201.05 | desktop-en-light, phone-en-light / floor_worker | 2 |
| New template | secondary / action | 12px | 40 | 126.2 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Show archived | checkbox / checkbox | 6px | 40 | 129.7 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Regular | combobox / combobox | 12px | 45 | 110.36 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Save template | primary / action | 12px | 40 | 128.78 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Print test alignment page | secondary / action | 12px | 40 | 201.17 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Duplicate template | secondary / action | 12px | 40 | 159.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Restore template | secondary / action | 12px | 40 | 147.11 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / floor_worker | 4 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |

### Selected product add-to-waitlist action

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Waitlist | tab / tab | 999px | 40 | 74.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Arrived today | checkbox / checkbox | 6px | 44 | 121.16 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Price changed recently | checkbox / checkbox | 6px | 44 | 185.05 | desktop-en-light, phone-en-light / floor_worker | 2 |
| On offer | checkbox / checkbox | 6px | 44 | 86.16 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Pricing category | combobox / combobox | 12px | 44 | 199.88 | desktop-en-light, phone-en-light / floor_worker | 2 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Select all filtered | checkbox / checkbox | 6px | 40 | 142.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Select product 0003 | checkbox / checkbox | 6px | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Add 1 product to waitlist | primary / action | 12px | 40 | 194.34 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |

### Waitlist with printable label copies

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Waitlist 1 | tab / tab | 999px | 40 | 102.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Clear waitlist | danger / action | 12px | 40 | 120.47 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Remove | danger / action | 12px | 40 | 71.91 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Template 1 | combobox / combobox | 12px | 45 | 183.89 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Print labels | primary / action | 12px | 40 | 108.38 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |

### Label print confirmation Yes and No

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / floor_worker | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / floor_worker | 1 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Notifications, 0 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Products | tab / tab | 999px | 40 | 84.84 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Waitlist 1 | tab / tab | 999px | 40 | 102.27 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Templates | tab / tab | 999px | 40 | 93.33 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Clear waitlist | danger / action | 12px | 40 | 120.47 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Remove | danger / action | 12px | 40 | 71.91 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Template 1 | combobox / combobox | 12px | 45 | 183.89 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Starting slot 1 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 64.76 | 97.14 | desktop-en-light / floor_worker | 1 |
| Print labels | primary / action | 12px | 40 | 108.38 | desktop-en-light, phone-en-light / floor_worker | 2 |
| No | secondary / action | 12px | 40 | 53.05 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Yes | primary / action | 12px | 40 | 58.3 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Undo | secondary / action | 12px | 40 | 69.91 | desktop-en-light, phone-en-light / floor_worker | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / floor_worker | 1 |
| Starting slot 1 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 2 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 3 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 4 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 5 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 6 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 7 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 8 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 9 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 10 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 11 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 12 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 13 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 14 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 15 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 16 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 17 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |
| Starting slot 18 | widget / widget | 0px | 60.57 | 90.86 | phone-en-light / floor_worker | 1 |

### Expired session reauthentication dialog

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| Daily | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Catalog | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Supervisor | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Admin | quiet / widget | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| User menu | secondary / account | 12px | 40 | 208 | desktop-en-light / supervisor | 1 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | desktop-en-light / supervisor | 1 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | desktop-en-light, phone-en-light / supervisor | 2 |
| Show password | secondary / icon | 50% | 40 | 40 | desktop-en-light, phone-en-light / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | desktop-en-light, phone-en-light / supervisor | 2 |
| Continue | primary / action | 12px | 40 | 94.52 | desktop-en-light, phone-en-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone-en-light / supervisor | 1 |

### topbar

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Review approvals | primary / action | 12px | 40 | 151.31 | en-light, en-dark, phone / supervisor | 3 |
| Approvals waiting: 2 | widget / widget | 16px | 163.59 | 194 | en-light, en-dark / supervisor | 2 |
| Open alerts: 1 | widget / widget | 16px | 163.59 | 194 | en-light, en-dark / supervisor | 2 |
| Open shorts: 0 | widget / widget | 16px | 163.59 | 194 | en-light, en-dark / supervisor | 2 |
| Expiring soon: 2 | widget / widget | 16px | 163.59 | 194 | en-light, en-dark / supervisor | 2 |
| Approve | primary / action | 12px | 40 | 74.55 | en-light, en-dark, phone / supervisor | 6 |
| Reject | danger / action | 12px | 40 | 60.73 | en-light, en-dark, phone / supervisor | 6 |
| Review | secondary / action | 12px | 40 | 90.59 | en-light, en-dark, phone / supervisor | 3 |
| View | secondary / action | 12px | 40 | 52.7 | en-light, en-dark, phone / supervisor | 63 |
| View all returns | secondary / action | 12px | 40 | 146.23 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| بررسی تأییدها | primary / action | 12px | 40 | 110.8 | fa-light / supervisor | 1 |
| تأییدهای در انتظار: 2 | widget / widget | 16px | 156 | 194 | fa-light / supervisor | 1 |
| هشدارهای باز: 1 | widget / widget | 16px | 156 | 194 | fa-light / supervisor | 1 |
| کسری‌های باز: 0 | widget / widget | 16px | 156 | 194 | fa-light / supervisor | 1 |
| انقضای نزدیک: 2 | widget / widget | 16px | 156 | 194 | fa-light / supervisor | 1 |
| تأیید | primary / action | 12px | 40 | 46.14 | fa-light / supervisor | 2 |
| رد کردن | danger / action | 12px | 40 | 60.53 | fa-light / supervisor | 2 |
| بررسی | secondary / action | 12px | 40 | 77.2 | fa-light / supervisor | 1 |
| مشاهده | secondary / action | 12px | 40 | 65.77 | fa-light / supervisor | 21 |
| مشاهده همه مرجوعی‌ها | secondary / action | 12px | 40 | 177.55 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |
| Approvals waiting: 2 | widget / widget | 16px | 156.59 | 173 | phone / supervisor | 1 |
| Open alerts: 1 | widget / widget | 16px | 156.59 | 173 | phone / supervisor | 1 |
| Open shorts: 0 | widget / widget | 16px | 155.59 | 173 | phone / supervisor | 1 |
| Expiring soon: 2 | widget / widget | 16px | 155.59 | 173 | phone / supervisor | 1 |

### invoices-list

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| New invoice | primary / action | 12px | 40 | 115.72 | en-light, en-dark, phone / supervisor | 3 |
| Drafts | tab / tab | 999px | 40 | 66.94 | en-light, en-dark, phone / supervisor | 3 |
| Processing | tab / tab | 999px | 40 | 98.31 | en-light, en-dark, phone / supervisor | 3 |
| Needs review | tab / tab | 999px | 40 | 113.88 | en-light, en-dark, phone / supervisor | 3 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | en-light, en-dark, phone / supervisor | 3 |
| Posted | tab / tab | 999px | 40 | 72.56 | en-light, en-dark, phone / supervisor | 3 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | en-light, en-dark, phone / supervisor | 3 |
| Columns | secondary / action | 12px | 40 | 119.08 | en-light, en-dark, phone / supervisor | 3 |
| GG-11794 | secondary / action | 12px | 40 | 109.36 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| FV-20296 | secondary / action | 12px | 40 | 105.88 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| SB-7848 | secondary / action | 12px | 40 | 97.61 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| GG-11842 | secondary / action | 12px | 40 | 109.36 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| HW-4936 | secondary / action | 12px | 40 | 103.16 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| SB-7862 | secondary / action | 12px | 40 | 97.61 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| GG-11879 | secondary / action | 12px | 40 | 109.36 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| FV-20390 | secondary / action | 12px | 40 | 105.88 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | fa-light / supervisor | 1 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | fa-light / supervisor | 1 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | fa-light / supervisor | 1 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | fa-light / supervisor | 1 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | fa-light / supervisor | 1 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | fa-light / supervisor | 1 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | fa-light / supervisor | 1 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### products-weight

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Add product | primary / action | 12px | 40 | 117.05 | en-light, en-dark, phone / supervisor | 3 |
| Pricing category | combobox / combobox | 12px | 44 | 199.88 | en-light, en-dark, phone / supervisor | 3 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | en-light, en-dark, phone / supervisor | 3 |
| Status | combobox / combobox | 12px | 44 | 136.08 | en-light, en-dark, phone / supervisor | 3 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | en-light, en-dark, phone / supervisor | 3 |
| Has pending price | checkbox / checkbox | 6px | 44 | 152.89 | en-light, en-dark, phone / supervisor | 3 |
| Has offer | checkbox / checkbox | 6px | 44 | 92.83 | en-light, en-dark, phone / supervisor | 3 |
| Manual prices | checkbox / checkbox | 6px | 44 | 125.17 | en-light, en-dark, phone / supervisor | 3 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | en-light, en-dark, phone / supervisor | 3 |
| Columns | secondary / action | 12px | 40 | 119.08 | en-light, en-dark, phone / supervisor | 3 |
| Product ↑ | quiet / widget | 12px | 40 | 65.39 | en-light, en-dark, phone / supervisor | 3 |
| Product Code | quiet / widget | 12px | 40 | 87.31 | en-light, en-dark / supervisor | 2 |
| Approved price | quiet / widget | 12px | 40 | 97.64 | en-light, en-dark / supervisor | 2 |
| Edit Bulk Almonds | secondary / action | 12px | 40 | 45.58 | en-light, en-dark, phone / supervisor | 3 |
| Product actions | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Previous | secondary / action | 12px | 40 | 92.08 | en-light, en-dark, phone / supervisor | 3 |
| Next | secondary / action | 12px | 40 | 65.33 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| افزودن محصول | primary / action | 12px | 40 | 120.23 | fa-light / supervisor | 1 |
| دستهٔ قیمت‌گذاری | combobox / combobox | 12px | 44 | 217.13 | fa-light / supervisor | 1 |
| دستهٔ هوش مصنوعی | combobox / combobox | 12px | 44 | 229.27 | fa-light / supervisor | 1 |
| وضعیت | combobox / combobox | 12px | 44 | 146.2 | fa-light / supervisor | 1 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | fa-light / supervisor | 1 |
| دارای قیمت در انتظار تأیید | checkbox / checkbox | 6px | 44 | 173.78 | fa-light / supervisor | 1 |
| دارای پیشنهاد | checkbox / checkbox | 6px | 44 | 106.47 | fa-light / supervisor | 1 |
| قیمت‌های دستی | checkbox / checkbox | 6px | 44 | 123.39 | fa-light / supervisor | 1 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | fa-light / supervisor | 1 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | fa-light / supervisor | 1 |
| محصول ↑ | quiet / widget | 12px | 40 | 57.89 | fa-light / supervisor | 1 |
| کد محصول | quiet / widget | 12px | 40 | 59.56 | fa-light / supervisor | 1 |
| قیمت تأییدشده | quiet / widget | 12px | 40 | 83.34 | fa-light / supervisor | 1 |
| ویرایش بادام فله | secondary / action | 12px | 40 | 60.16 | fa-light / supervisor | 1 |
| اقدامات کالا | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| قبلی | secondary / action | 12px | 40 | 58.94 | fa-light / supervisor | 1 |
| بعدی | secondary / action | 12px | 40 | 63.75 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |
| Product Code | quiet / widget | 12px | 40 | 84 | phone / supervisor | 1 |
| Approved price | quiet / widget | 12px | 40 | 92 | phone / supervisor | 1 |

### returns-list

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Open | tab / tab | 999px | 40 | 63.17 | en-light, en-dark, phone / supervisor | 3 |
| History | tab / tab | 999px | 40 | 74 | en-light, en-dark, phone / supervisor | 3 |
| Supplier | combobox / combobox | 12px | 44 | 226.97 | en-light, en-dark, phone / supervisor | 3 |
| Status | combobox / combobox | 12px | 44 | 179.98 | en-light, en-dark, phone / supervisor | 3 |
| Return branch | combobox / combobox | 12px | 44 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Clear filters | quiet / action | 12px | 40 | 98.13 | en-light, en-dark, phone / supervisor | 3 |
| Columns | secondary / action | 12px | 40 | 119.08 | en-light, en-dark, phone / supervisor | 3 |
| Record resolution | secondary / action | 12px | 40 | 131.28 | en-light, en-dark, phone / supervisor | 6 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| باز | tab / tab | 999px | 40 | 41.69 | fa-light / supervisor | 1 |
| تاریخچه | tab / tab | 999px | 40 | 70.67 | fa-light / supervisor | 1 |
| تأمین‌کننده | combobox / combobox | 12px | 44 | 226.61 | fa-light / supervisor | 1 |
| وضعیت | combobox / combobox | 12px | 44 | 159.13 | fa-light / supervisor | 1 |
| شعبه مرجوعی | combobox / combobox | 12px | 44 | 132.81 | fa-light / supervisor | 1 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 113.31 | fa-light / supervisor | 1 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | fa-light / supervisor | 1 |
| ثبت حل‌وفصل | secondary / action | 12px | 40 | 95.53 | fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### return-detail

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Return policy | secondary / action | 12px | 40 | 122.08 | en-light, en-dark, phone / supervisor | 3 |
| Record pickup | primary / action | 12px | 40 | 130.34 | en-light, en-dark, phone / supervisor | 3 |
| Cancel return | danger / action | 12px | 40 | 124.78 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| سیاست مرجوعی | secondary / action | 12px | 40 | 126 | fa-light / supervisor | 1 |
| ثبت جمع‌آوری | primary / action | 12px | 40 | 110.67 | fa-light / supervisor | 1 |
| لغو مرجوعی | danger / action | 12px | 40 | 100.28 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### return-policy

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Download full policy | secondary / action | 12px | 40 | 169.38 | en-light, en-dark, phone / supervisor | 3 |
| Close | primary / action | 12px | 40 | 72.02 | en-light, en-dark, phone / supervisor | 3 |
| Return policy | secondary / action | 12px | 40 | 122.08 | en-light, en-dark, phone / supervisor | 3 |
| Record pickup | primary / action | 12px | 40 | 130.34 | en-light, en-dark, phone / supervisor | 3 |
| Cancel return | danger / action | 12px | 40 | 124.78 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| دانلود سیاست کامل | secondary / action | 12px | 40 | 144.44 | fa-light / supervisor | 1 |
| بستن | primary / action | 12px | 40 | 65.22 | fa-light / supervisor | 1 |
| سیاست مرجوعی | secondary / action | 12px | 40 | 126 | fa-light / supervisor | 1 |
| ثبت جمع‌آوری | primary / action | 12px | 40 | 110.67 | fa-light / supervisor | 1 |
| لغو مرجوعی | danger / action | 12px | 40 | 100.28 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### date-quick-add

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| 2026-10-10 | date / date | 12px | 45 | 168 | en-light, en-dark, fa-light / supervisor | 3 |
| North York | combobox / combobox | 12px | 45 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| More | secondary / action | 12px | 40 | 68.61 | en-light, en-dark, phone / supervisor | 3 |
| Add | primary / action | 12px | 40 | 61.13 | en-light, en-dark, phone / supervisor | 3 |
| Expiry | combobox / combobox | 12px | 45 | 136.34 | en-light, en-dark, phone / supervisor | 3 |
| Time window | combobox / combobox | 12px | 44 | 217.13 | en-light, en-dark, phone / supervisor | 3 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | en-light, en-dark, phone / supervisor | 3 |
| Date tracking location | combobox / combobox | 12px | 44 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Sort by | combobox / combobox | 12px | 44 | 111.81 | en-light, en-dark, phone / supervisor | 3 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | en-light, en-dark, phone / supervisor | 3 |
| Columns | secondary / action | 12px | 40 | 119.08 | en-light, en-dark, phone / supervisor | 3 |
| Remove | danger / action | 12px | 40 | 71.91 | en-light, en-dark, phone / supervisor | 6 |
| More | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 6 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| نورث یورک | combobox / combobox | 12px | 45 | 132.81 | fa-light / supervisor | 1 |
| بیشتر | secondary / action | 12px | 40 | 65.61 | fa-light / supervisor | 1 |
| افزودن | primary / action | 12px | 40 | 72.06 | fa-light / supervisor | 1 |
| انقضا | combobox / combobox | 12px | 45 | 164.38 | fa-light / supervisor | 1 |
| بازه زمانی | combobox / combobox | 12px | 44 | 193.63 | fa-light / supervisor | 1 |
| دسته‌بندی هوش مصنوعی | combobox / combobox | 12px | 44 | 192.8 | fa-light / supervisor | 1 |
| مکان پیگیری تاریخ | combobox / combobox | 12px | 44 | 133.34 | fa-light / supervisor | 1 |
| مرتب‌سازی بر اساس | combobox / combobox | 12px | 44 | 104.23 | fa-light / supervisor | 1 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | fa-light / supervisor | 1 |
| ستون‌ها | secondary / action | 12px | 40 | 105.61 | fa-light / supervisor | 1 |
| حذف | danger / action | 12px | 40 | 49.17 | fa-light / supervisor | 2 |
| بیشتر | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 2 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |
| 2026-10-10 | date / date | 12px | 45 | 153 | phone / supervisor | 1 |

### lookup-dates

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Scan barcode | icon / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| AI category | combobox / combobox | 12px | 44 | 193.33 | en-light, en-dark, phone / supervisor | 3 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | en-light, en-dark, phone / supervisor | 3 |
| Edit Basmati Rice 4.5 kg | secondary / action | 12px | 40 | 59.39 | en-light, en-dark, phone / supervisor | 3 |
| Date tracking | switch / switch | 6px | 40 | 66.53 | en-light, en-dark, phone / supervisor | 3 |
| 2026-10-10 | date / date | 12px | 45 | 168 | en-light, en-dark, fa-light, phone / supervisor | 4 |
| Add | primary / action | 12px | 40 | 61.13 | en-light, en-dark, phone / supervisor | 3 |
| Basmati Rice 4.5 kgبرنج باسماتی ۴٫۵ کیلوگرمیProduct Code 0001$23.99 | option / option | 12px | 76 | 832 | en-light, en-dark / supervisor | 2 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| اسکن بارکد | icon / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دستهٔ هوش مصنوعی | combobox / combobox | 12px | 44 | 229.27 | fa-light / supervisor | 1 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | fa-light / supervisor | 1 |
| ویرایش برنج باسماتی ۴٫۵ کیلوگرمی | secondary / action | 12px | 40 | 75.09 | fa-light / supervisor | 1 |
| پیگیری تاریخ | switch / switch | 6px | 40 | 89.28 | fa-light / supervisor | 1 |
| افزودن | primary / action | 12px | 40 | 72.06 | fa-light / supervisor | 1 |
| برنج باسماتی ۴٫۵ کیلوگرمیBasmati Rice 4.5 kgکد محصول 0001$23.99 | option / option | 12px | 76 | 832 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |
| Basmati Rice 4.5 kgبرنج باسماتی ۴٫۵ کیلوگرمیProduct Code 0001$23.99 | option / option | 12px | 76 | 318 | phone / supervisor | 1 |

### offers-current

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Create offer | primary / action | 12px | 40 | 114.09 | en-light, en-dark, phone / supervisor | 3 |
| Current offers | tab / tab | 999px | 40 | 116 | en-light, en-dark, phone / supervisor | 3 |
| Past offers | tab / tab | 999px | 40 | 96.25 | en-light, en-dark, phone / supervisor | 3 |
| Mix-and-match pools | tab / tab | 999px | 40 | 161.75 | en-light, en-dark, phone / supervisor | 3 |
| Offer status | combobox / combobox | 12px | 44 | 136.08 | en-light, en-dark, phone / supervisor | 3 |
| Offer category | combobox / combobox | 12px | 44 | 174.11 | en-light, en-dark, phone / supervisor | 3 |
| Offer supplier | combobox / combobox | 12px | 44 | 226.97 | en-light, en-dark, phone / supervisor | 3 |
| Offer branch | combobox / combobox | 12px | 44 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Offer type | combobox / combobox | 12px | 44 | 152.41 | en-light, en-dark, phone / supervisor | 3 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | en-light, en-dark, phone / supervisor | 3 |
| Stop offer | danger / action | 12px | 40 | 83.56 | en-light, en-dark, phone / supervisor | 15 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| ایجاد پیشنهاد | primary / action | 12px | 40 | 109.81 | fa-light / supervisor | 1 |
| پیشنهادهای فعلی | tab / tab | 999px | 40 | 121.72 | fa-light / supervisor | 1 |
| پیشنهادهای قبلی | tab / tab | 999px | 40 | 118.78 | fa-light / supervisor | 1 |
| گروه‌های ترکیبی | tab / tab | 999px | 40 | 109.97 | fa-light / supervisor | 1 |
| وضعیت پیشنهاد | combobox / combobox | 12px | 44 | 146.2 | fa-light / supervisor | 1 |
| دسته پیشنهاد | combobox / combobox | 12px | 44 | 186.59 | fa-light / supervisor | 1 |
| تأمین‌کننده پیشنهاد | combobox / combobox | 12px | 44 | 226.61 | fa-light / supervisor | 1 |
| شعبه پیشنهاد | combobox / combobox | 12px | 44 | 133.34 | fa-light / supervisor | 1 |
| نوع پیشنهاد | combobox / combobox | 12px | 44 | 161.06 | fa-light / supervisor | 1 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | fa-light / supervisor | 1 |
| توقف پیشنهاد | danger / action | 12px | 40 | 94.41 | fa-light / supervisor | 5 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### offers-past

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Create offer | primary / action | 12px | 40 | 114.09 | en-light, en-dark, phone / supervisor | 3 |
| Current offers | tab / tab | 999px | 40 | 116 | en-light, en-dark, phone / supervisor | 3 |
| Past offers | tab / tab | 999px | 40 | 96.25 | en-light, en-dark, phone / supervisor | 3 |
| Mix-and-match pools | tab / tab | 999px | 40 | 161.75 | en-light, en-dark, phone / supervisor | 3 |
| Offer status | combobox / combobox | 12px | 44 | 136.08 | en-light, en-dark, phone / supervisor | 3 |
| Offer category | combobox / combobox | 12px | 44 | 174.11 | en-light, en-dark, phone / supervisor | 3 |
| Offer supplier | combobox / combobox | 12px | 44 | 226.97 | en-light, en-dark, phone / supervisor | 3 |
| Offer branch | combobox / combobox | 12px | 44 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Offer type | combobox / combobox | 12px | 44 | 152.41 | en-light, en-dark, phone / supervisor | 3 |
| Clear filters | quiet / action | 12px | 40 | 111.67 | en-light, en-dark, phone / supervisor | 3 |
| Undo | secondary / action | 12px | 40 | 69.91 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| ایجاد پیشنهاد | primary / action | 12px | 40 | 109.81 | fa-light / supervisor | 1 |
| پیشنهادهای فعلی | tab / tab | 999px | 40 | 121.72 | fa-light / supervisor | 1 |
| پیشنهادهای قبلی | tab / tab | 999px | 40 | 118.78 | fa-light / supervisor | 1 |
| گروه‌های ترکیبی | tab / tab | 999px | 40 | 109.97 | fa-light / supervisor | 1 |
| وضعیت پیشنهاد | combobox / combobox | 12px | 44 | 146.2 | fa-light / supervisor | 1 |
| دسته پیشنهاد | combobox / combobox | 12px | 44 | 186.59 | fa-light / supervisor | 1 |
| تأمین‌کننده پیشنهاد | combobox / combobox | 12px | 44 | 226.61 | fa-light / supervisor | 1 |
| شعبه پیشنهاد | combobox / combobox | 12px | 44 | 133.34 | fa-light / supervisor | 1 |
| نوع پیشنهاد | combobox / combobox | 12px | 44 | 161.06 | fa-light / supervisor | 1 |
| پاک کردن فیلترها | quiet / action | 12px | 40 | 128.02 | fa-light / supervisor | 1 |
| واگرد | secondary / action | 12px | 40 | 61.36 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### posted-invoice

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| New invoice | primary / action | 12px | 40 | 115.72 | en-light, en-dark, phone / supervisor | 3 |
| Drafts | tab / tab | 999px | 40 | 66.94 | en-light, en-dark, phone / supervisor | 3 |
| Processing | tab / tab | 999px | 40 | 98.31 | en-light, en-dark, phone / supervisor | 3 |
| Needs review | tab / tab | 999px | 40 | 113.88 | en-light, en-dark, phone / supervisor | 3 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | en-light, en-dark, phone / supervisor | 3 |
| Posted | tab / tab | 999px | 40 | 72.56 | en-light, en-dark, phone / supervisor | 3 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | en-light, en-dark, phone / supervisor | 3 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | en-light, en-dark, phone / supervisor | 3 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | en-light, en-dark, phone / supervisor | 3 |
| Zoom out | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Zoom in | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Fit width | secondary / action | 12px | 40 | 91.48 | en-light, en-dark, phone / supervisor | 3 |
| Fit page | secondary / action | 12px | 40 | 87.92 | en-light, en-dark, phone / supervisor | 3 |
| Download | secondary / action | 12px | 40 | 125.09 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | fa-light / supervisor | 1 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | fa-light / supervisor | 1 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | fa-light / supervisor | 1 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | fa-light / supervisor | 1 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | fa-light / supervisor | 1 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | fa-light / supervisor | 1 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | fa-light / supervisor | 1 |
| اصلاح فاکتور | primary / action | 12px | 40 | 103.67 | fa-light / supervisor | 1 |
| انتقال فاکتور | secondary / action | 12px | 40 | 103.16 | fa-light / supervisor | 1 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | fa-light / supervisor | 1 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | fa-light / supervisor | 1 |
| دانلود | secondary / action | 12px | 40 | 89.95 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### original-whole-page

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| New invoice | primary / action | 12px | 40 | 115.72 | en-light, en-dark, phone / supervisor | 3 |
| Drafts | tab / tab | 999px | 40 | 66.94 | en-light, en-dark, phone / supervisor | 3 |
| Processing | tab / tab | 999px | 40 | 98.31 | en-light, en-dark, phone / supervisor | 3 |
| Needs review | tab / tab | 999px | 40 | 113.88 | en-light, en-dark, phone / supervisor | 3 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | en-light, en-dark, phone / supervisor | 3 |
| Posted | tab / tab | 999px | 40 | 72.56 | en-light, en-dark, phone / supervisor | 3 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | en-light, en-dark, phone / supervisor | 3 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | en-light, en-dark, phone / supervisor | 3 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | en-light, en-dark, phone / supervisor | 3 |
| Zoom out | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Zoom in | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Fit width | secondary / action | 12px | 40 | 91.48 | en-light, en-dark, phone / supervisor | 3 |
| Fit page | secondary / action | 12px | 40 | 87.92 | en-light, en-dark, phone / supervisor | 3 |
| Download | secondary / action | 12px | 40 | 125.09 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | fa-light / supervisor | 1 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | fa-light / supervisor | 1 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | fa-light / supervisor | 1 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | fa-light / supervisor | 1 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | fa-light / supervisor | 1 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | fa-light / supervisor | 1 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | fa-light / supervisor | 1 |
| اصلاح فاکتور | primary / action | 12px | 40 | 103.67 | fa-light / supervisor | 1 |
| انتقال فاکتور | secondary / action | 12px | 40 | 103.16 | fa-light / supervisor | 1 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | fa-light / supervisor | 1 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | fa-light / supervisor | 1 |
| دانلود | secondary / action | 12px | 40 | 89.95 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

### correct-invoice

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 2 |
| Cases | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 12 |
| Yes | widget / widget | 999px | 40 | 52.28 | en-light, en-dark, phone / supervisor | 18 |
| No | widget / widget | 999px | 40 | 47.59 | en-light, en-dark, phone / supervisor | 18 |
| Expiry | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 12 |
| Choose date | date / date | 12px | 44 | 386 | en-light, en-dark / supervisor | 12 |
| 0005 · Ground Sumac 100 g | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 2 |
| 0006 · Lavash Bread 500 g | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 2 |
| 0003 · Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 2 |
| 0015 · Dried Barberries 100 g | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 2 |
| 0009 · Potato Chips 150 g | combobox / combobox | 12px | 45 | 300 | en-light, en-dark / supervisor | 2 |
| Cancel | secondary / action | 12px | 40 | 80.48 | en-light, en-dark, phone / supervisor | 3 |
| Preview correction | primary / action | 12px | 40 | 159.75 | en-light, en-dark, phone / supervisor | 3 |
| New invoice | primary / action | 12px | 40 | 115.72 | en-light, en-dark, phone / supervisor | 3 |
| Drafts | tab / tab | 999px | 40 | 66.94 | en-light, en-dark, phone / supervisor | 3 |
| Processing | tab / tab | 999px | 40 | 98.31 | en-light, en-dark, phone / supervisor | 3 |
| Needs review | tab / tab | 999px | 40 | 113.88 | en-light, en-dark, phone / supervisor | 3 |
| Ready to post | tab / tab | 999px | 40 | 114.63 | en-light, en-dark, phone / supervisor | 3 |
| Posted | tab / tab | 999px | 40 | 72.56 | en-light, en-dark, phone / supervisor | 3 |
| Cancelled | tab / tab | 999px | 40 | 91.33 | en-light, en-dark, phone / supervisor | 3 |
| Correct invoice | primary / action | 12px | 40 | 136.06 | en-light, en-dark, phone / supervisor | 3 |
| Move invoice | secondary / action | 12px | 40 | 122.5 | en-light, en-dark, phone / supervisor | 3 |
| Zoom out | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Zoom in | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Fit width | secondary / action | 12px | 40 | 91.48 | en-light, en-dark, phone / supervisor | 3 |
| Fit page | secondary / action | 12px | 40 | 87.92 | en-light, en-dark, phone / supervisor | 3 |
| Download | secondary / action | 12px | 40 | 125.09 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| 0002 · باقالا کنسرو شده ۴۰۰ گرمی | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 1 |
| کارتن | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 6 |
| بله | widget / widget | 999px | 40 | 44.72 | fa-light / supervisor | 6 |
| خیر | widget / widget | 999px | 40 | 48.89 | fa-light / supervisor | 6 |
| انقضا | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 6 |
| تاریخ را انتخاب کنید | date / date | 12px | 44 | 386 | fa-light / supervisor | 6 |
| 0005 · سماق ۱۰۰ گرمی | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 1 |
| 0006 · نان لواش ۵۰۰ گرمی | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 1 |
| 0003 · آب آلبالو ۱ لیتری | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 1 |
| 0015 · زرشک خشک 100 گرمی | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 1 |
| 0009 · چیپس سیب‌زمینی ۱۵۰ گرمی | combobox / combobox | 12px | 45 | 300 | fa-light / supervisor | 1 |
| انصراف | secondary / action | 12px | 40 | 73.83 | fa-light / supervisor | 1 |
| پیش‌نمایش اصلاح | primary / action | 12px | 40 | 135.98 | fa-light / supervisor | 1 |
| فاکتور جدید | primary / action | 12px | 40 | 99.34 | fa-light / supervisor | 1 |
| پیش‌نویس‌ها | tab / tab | 999px | 40 | 97.34 | fa-light / supervisor | 1 |
| در حال پردازش | tab / tab | 999px | 40 | 104.63 | fa-light / supervisor | 1 |
| نیازمند بررسی | tab / tab | 999px | 40 | 97.77 | fa-light / supervisor | 1 |
| آماده ثبت | tab / tab | 999px | 40 | 79.7 | fa-light / supervisor | 1 |
| ثبت‌شده | tab / tab | 999px | 40 | 73.8 | fa-light / supervisor | 1 |
| لغوشده | tab / tab | 999px | 40 | 70.19 | fa-light / supervisor | 1 |
| اصلاح فاکتور | primary / action | 12px | 40 | 103.67 | fa-light / supervisor | 1 |
| انتقال فاکتور | secondary / action | 12px | 40 | 103.16 | fa-light / supervisor | 1 |
| کوچک‌نمایی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| بزرگ‌نمایی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازه عرض | secondary / action | 12px | 40 | 96.03 | fa-light / supervisor | 1 |
| اندازه صفحه | secondary / action | 12px | 40 | 102.31 | fa-light / supervisor | 1 |
| دانلود | secondary / action | 12px | 40 | 89.95 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |
| 0002 · Canned Fava Beans 400 g | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 1 |
| Cases | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 6 |
| Expiry | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 6 |
| Choose date | date / date | 12px | 44 | 270 | phone / supervisor | 6 |
| 0005 · Ground Sumac 100 g | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 1 |
| 0006 · Lavash Bread 500 g | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 1 |
| 0003 · Sour Cherry Juice 1 L | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 1 |
| 0015 · Dried Barberries 100 g | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 1 |
| 0009 · Potato Chips 150 g | combobox / combobox | 12px | 45 | 270 | phone / supervisor | 1 |

### approvals-tabs

| Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| User menu | secondary / account | 12px | 40 | 208 | en-light, en-dark / supervisor | 2 |
| Collapse sidebar | secondary / icon | 50% | 40 | 40 | en-light, en-dark / supervisor | 2 |
| Branch | combobox / combobox | 999px | 40 | 150.7 | en-light, en-dark, phone / supervisor | 3 |
| Switch to Persian | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Switch to dark theme | secondary / icon | 50% | 40 | 40 | en-light, phone / supervisor | 2 |
| Comfortable text size | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Notifications, 5 unread | secondary / icon | 50% | 40 | 40 | en-light, en-dark, phone / supervisor | 3 |
| Demo | secondary / topbar | 12px | 40 | 97.22 | en-light, en-dark, phone / supervisor | 3 |
| Pending | tab / tab | 999px | 40 | 80.27 | en-light, en-dark, phone / supervisor | 3 |
| Approved | tab / tab | 999px | 40 | 89.7 | en-light, en-dark, phone / supervisor | 3 |
| Rejected | tab / tab | 999px | 40 | 83.58 | en-light, en-dark, phone / supervisor | 3 |
| Superseded | tab / tab | 999px | 40 | 104.41 | en-light, en-dark, phone / supervisor | 3 |
| Approve price | primary / action | 12px | 40 | 128.33 | en-light, en-dark, phone / supervisor | 3 |
| Reject | danger / action | 12px | 40 | 75.7 | en-light, en-dark, phone / supervisor | 6 |
| Approve product | primary / action | 12px | 40 | 146.5 | en-light, en-dark, phone / supervisor | 3 |
| Switch to light theme | secondary / icon | 50% | 40 | 40 | en-dark / supervisor | 1 |
| منوی کاربر | secondary / account | 12px | 40 | 208 | fa-light / supervisor | 1 |
| جمع کردن نوار کناری | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| شعبه | combobox / combobox | 999px | 40 | 132.81 | fa-light / supervisor | 1 |
| تغییر به انگلیسی | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| تغییر به تم تیره | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اندازهٔ متن راحت | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| اعلان‌ها، 5 خوانده‌نشده | secondary / icon | 50% | 40 | 40 | fa-light / supervisor | 1 |
| دمو | secondary / topbar | 12px | 40 | 78.67 | fa-light / supervisor | 1 |
| در انتظار | tab / tab | 999px | 40 | 72.17 | fa-light / supervisor | 1 |
| تأییدشده | tab / tab | 999px | 40 | 77.06 | fa-light / supervisor | 1 |
| ردشده | tab / tab | 999px | 40 | 62.88 | fa-light / supervisor | 1 |
| جایگزین‌شده | tab / tab | 999px | 40 | 94.92 | fa-light / supervisor | 1 |
| تأیید قیمت | primary / action | 12px | 40 | 96.3 | fa-light / supervisor | 1 |
| رد کردن | danger / action | 12px | 40 | 75.5 | fa-light / supervisor | 2 |
| تأیید کالا | primary / action | 12px | 40 | 81.83 | fa-light / supervisor | 1 |
| Open menu | secondary / icon | 50% | 40 | 40 | phone / supervisor | 1 |

## Cross-screen status colors

No conflicting colors for the same visible status label within a language and theme across 100 measured status groups.

## Measured state coverage

| Screen | Appearance | Role | Buttons | Failures |
| --- | --- | --- | --- | --- |
| Settings: Company | desktop-en-light | supervisor | 30 | None |
| Settings: Company | desktop-en-dark | supervisor | 30 | None |
| Settings: Company | desktop-fa-light | supervisor | 30 | None |
| Settings: Branches | desktop-en-light | supervisor | 34 | None |
| Settings: Branches | desktop-en-dark | supervisor | 34 | None |
| Settings: Branches | desktop-fa-light | supervisor | 34 | None |
| Settings: People | desktop-en-light | supervisor | 25 | None |
| Settings: People | desktop-en-dark | supervisor | 25 | None |
| Settings: People | desktop-fa-light | supervisor | 25 | None |
| Settings: Catalog | desktop-en-light | supervisor | 39 | None |
| Settings: Catalog | desktop-en-dark | supervisor | 39 | None |
| Settings: Catalog | desktop-fa-light | supervisor | 39 | None |
| Settings: Pricing and approvals | desktop-en-light | supervisor | 28 | None |
| Settings: Pricing and approvals | desktop-en-dark | supervisor | 28 | None |
| Settings: Pricing and approvals | desktop-fa-light | supervisor | 28 | None |
| Settings: Offers | desktop-en-light | supervisor | 30 | None |
| Settings: Offers | desktop-en-dark | supervisor | 30 | None |
| Settings: Offers | desktop-fa-light | supervisor | 30 | None |
| Settings: Taxes | desktop-en-light | supervisor | 25 | None |
| Settings: Taxes | desktop-en-dark | supervisor | 25 | None |
| Settings: Taxes | desktop-fa-light | supervisor | 25 | None |
| Settings: Receiving | desktop-en-light | supervisor | 25 | None |
| Settings: Receiving | desktop-en-dark | supervisor | 25 | None |
| Settings: Receiving | desktop-fa-light | supervisor | 25 | None |
| Settings: Returns/date tracking/labels | desktop-en-light | supervisor | 64 | None |
| Settings: Returns/date tracking/labels | desktop-en-dark | supervisor | 64 | None |
| Settings: Returns/date tracking/labels | desktop-fa-light | supervisor | 64 | None |
| Settings: Notes | desktop-en-light | supervisor | 28 | None |
| Settings: Notes | desktop-en-dark | supervisor | 28 | None |
| Settings: Notes | desktop-fa-light | supervisor | 28 | None |
| Settings: Notifications | desktop-en-light | supervisor | 25 | None |
| Settings: Notifications | desktop-en-dark | supervisor | 25 | None |
| Settings: Notifications | desktop-fa-light | supervisor | 25 | None |
| Settings: Modules | desktop-en-light | supervisor | 33 | None |
| Settings: Modules | desktop-en-dark | supervisor | 33 | None |
| Settings: Modules | desktop-fa-light | supervisor | 33 | None |
| Settings: Data | desktop-en-light | supervisor | 25 | None |
| Settings: Data | desktop-en-dark | supervisor | 25 | None |
| Settings: Data | desktop-fa-light | supervisor | 25 | None |
| Add location dialog | desktop-en-light | supervisor | 38 | None |
| Edit location dialog | desktop-en-light | supervisor | 38 | None |
| Add pricing category dialog | desktop-en-light | supervisor | 46 | None |
| New notebook dialog | desktop-en-light | supervisor | 43 | None |
| Settings: Company | phone-en-light | supervisor | 26 | None |
| Settings: Company | phone-en-dark | supervisor | 26 | None |
| Settings: Company | phone-fa-light | supervisor | 26 | None |
| Settings: Branches | phone-en-light | supervisor | 29 | None |
| Settings: Branches | phone-en-dark | supervisor | 29 | None |
| Settings: Branches | phone-fa-light | supervisor | 29 | None |
| Settings: People | phone-en-light | supervisor | 20 | None |
| Settings: People | phone-en-dark | supervisor | 20 | None |
| Settings: People | phone-fa-light | supervisor | 20 | None |
| Settings: Catalog | phone-en-light | supervisor | 34 | None |
| Settings: Catalog | phone-en-dark | supervisor | 34 | None |
| Settings: Catalog | phone-fa-light | supervisor | 34 | None |
| Settings: Pricing and approvals | phone-en-light | supervisor | 23 | None |
| Settings: Pricing and approvals | phone-en-dark | supervisor | 23 | None |
| Settings: Pricing and approvals | phone-fa-light | supervisor | 23 | None |
| Settings: Offers | phone-en-light | supervisor | 25 | None |
| Settings: Offers | phone-en-dark | supervisor | 25 | None |
| Settings: Offers | phone-fa-light | supervisor | 25 | None |
| Settings: Taxes | phone-en-light | supervisor | 20 | None |
| Settings: Taxes | phone-en-dark | supervisor | 20 | None |
| Settings: Taxes | phone-fa-light | supervisor | 20 | None |
| Settings: Receiving | phone-en-light | supervisor | 20 | None |
| Settings: Receiving | phone-en-dark | supervisor | 20 | None |
| Settings: Receiving | phone-fa-light | supervisor | 20 | None |
| Settings: Returns/date tracking/labels | phone-en-light | supervisor | 59 | None |
| Settings: Returns/date tracking/labels | phone-en-dark | supervisor | 59 | None |
| Settings: Returns/date tracking/labels | phone-fa-light | supervisor | 59 | None |
| Settings: Notes | phone-en-light | supervisor | 23 | None |
| Settings: Notes | phone-en-dark | supervisor | 23 | None |
| Settings: Notes | phone-fa-light | supervisor | 23 | None |
| Settings: Notifications | phone-en-light | supervisor | 20 | None |
| Settings: Notifications | phone-en-dark | supervisor | 20 | None |
| Settings: Notifications | phone-fa-light | supervisor | 20 | None |
| Settings: Modules | phone-en-light | supervisor | 28 | None |
| Settings: Modules | phone-en-dark | supervisor | 28 | None |
| Settings: Modules | phone-fa-light | supervisor | 28 | None |
| Settings: Data | phone-en-light | supervisor | 20 | None |
| Settings: Data | phone-en-dark | supervisor | 20 | None |
| Settings: Data | phone-fa-light | supervisor | 20 | None |
| Add location dialog | phone-en-light | supervisor | 33 | None |
| Edit location dialog | phone-en-light | supervisor | 33 | None |
| Add pricing category dialog | phone-en-light | supervisor | 41 | None |
| New notebook dialog | phone-en-light | supervisor | 38 | None |
| Labels Products | desktop-en-light | supervisor | 39 | None |
| Labels Products | desktop-en-dark | supervisor | 39 | None |
| Labels Products | desktop-fa-light | supervisor | 39 | None |
| Labels ^Waitlist | desktop-en-light | supervisor | 36 | None |
| Labels ^Waitlist | desktop-en-dark | supervisor | 36 | None |
| Labels ^Waitlist | desktop-fa-light | supervisor | 36 | None |
| Labels ^Templates$ | desktop-en-light | supervisor | 41 | None |
| Labels ^Templates$ | desktop-en-dark | supervisor | 41 | None |
| Labels ^Templates$ | desktop-fa-light | supervisor | 41 | None |
| Edit Regular label template | desktop-en-light | supervisor | 41 | None |
| Edit Regular label template | desktop-en-dark | supervisor | 41 | None |
| Edit Regular label template | desktop-fa-light | supervisor | 41 | None |
| Notes | desktop-en-light | supervisor | 21 | None |
| Notes | desktop-en-dark | supervisor | 21 | None |
| Notes | desktop-fa-light | supervisor | 21 | None |
| Add note dialog | desktop-en-light | supervisor | 24 | None |
| Received | desktop-en-light | supervisor | 39 | None |
| Received | desktop-en-dark | supervisor | 39 | None |
| Received | desktop-fa-light | supervisor | 39 | None |
| History | desktop-en-light | supervisor | 18 | None |
| History | desktop-en-dark | supervisor | 18 | None |
| History | desktop-fa-light | supervisor | 18 | None |
| Payables overview | desktop-en-light | supervisor | 18 | None |
| Payables overview | desktop-en-dark | supervisor | 18 | None |
| Payables overview | desktop-fa-light | supervisor | 18 | None |
| Supplier ledger | desktop-en-light | supervisor | 30 | None |
| Supplier ledger | desktop-en-dark | supervisor | 30 | None |
| Supplier ledger | desktop-fa-light | supervisor | 30 | None |
| Record external payment form | desktop-en-light | supervisor | 32 | None |
| Record external payment form | desktop-en-dark | supervisor | 32 | None |
| Record external payment form | desktop-fa-light | supervisor | 32 | None |
| Record ledger entry form | desktop-en-light | supervisor | 33 | None |
| Record ledger entry form | desktop-en-dark | supervisor | 33 | None |
| Record ledger entry form | desktop-fa-light | supervisor | 33 | None |
| Record supplier dispute form | desktop-en-light | supervisor | 35 | None |
| Record supplier dispute form | desktop-en-dark | supervisor | 35 | None |
| Record supplier dispute form | desktop-fa-light | supervisor | 35 | None |
| Labels Products | phone-en-light | supervisor | 34 | None |
| Labels Products | phone-en-dark | supervisor | 34 | None |
| Labels Products | phone-fa-light | supervisor | 34 | None |
| Labels ^Waitlist | phone-en-light | supervisor | 31 | None |
| Labels ^Waitlist | phone-en-dark | supervisor | 31 | None |
| Labels ^Waitlist | phone-fa-light | supervisor | 31 | None |
| Labels ^Templates$ | phone-en-light | supervisor | 36 | None |
| Labels ^Templates$ | phone-en-dark | supervisor | 36 | None |
| Labels ^Templates$ | phone-fa-light | supervisor | 36 | None |
| Edit Regular label template | phone-en-light | supervisor | 36 | None |
| Edit Regular label template | phone-en-dark | supervisor | 36 | None |
| Edit Regular label template | phone-fa-light | supervisor | 36 | None |
| Notes | phone-en-light | supervisor | 16 | None |
| Notes | phone-en-dark | supervisor | 16 | None |
| Notes | phone-fa-light | supervisor | 16 | None |
| Add note dialog | phone-en-light | supervisor | 19 | None |
| Received | phone-en-light | supervisor | 34 | None |
| Received | phone-en-dark | supervisor | 34 | None |
| Received | phone-fa-light | supervisor | 34 | None |
| History | phone-en-light | supervisor | 13 | None |
| History | phone-en-dark | supervisor | 13 | None |
| History | phone-fa-light | supervisor | 13 | None |
| Payables overview | phone-en-light | supervisor | 13 | None |
| Payables overview | phone-en-dark | supervisor | 13 | None |
| Payables overview | phone-fa-light | supervisor | 13 | None |
| Supplier ledger | phone-en-light | supervisor | 25 | None |
| Supplier ledger | phone-en-dark | supervisor | 25 | None |
| Supplier ledger | phone-fa-light | supervisor | 25 | None |
| Record external payment form | phone-en-light | supervisor | 27 | None |
| Record external payment form | phone-en-dark | supervisor | 27 | None |
| Record external payment form | phone-fa-light | supervisor | 27 | None |
| Record ledger entry form | phone-en-light | supervisor | 28 | None |
| Record ledger entry form | phone-en-dark | supervisor | 28 | None |
| Record ledger entry form | phone-fa-light | supervisor | 28 | None |
| Record supplier dispute form | phone-en-light | supervisor | 30 | None |
| Record supplier dispute form | phone-en-dark | supervisor | 30 | None |
| Record supplier dispute form | phone-fa-light | supervisor | 30 | None |
| Orders list | desktop-en-light | supervisor | 19 | None |
| Orders list | desktop-en-dark | supervisor | 19 | None |
| Orders list | desktop-fa-light | supervisor | 19 | None |
| New order with supplier items | desktop-en-light | supervisor | 20 | None |
| New order with supplier items | desktop-en-dark | supervisor | 20 | None |
| New order with supplier items | desktop-fa-light | supervisor | 20 | None |
| New order item dialog | desktop-en-light | supervisor | 22 | None |
| Branch requests Incoming | desktop-en-light | supervisor | 17 | None |
| Branch requests Incoming | desktop-en-dark | supervisor | 17 | None |
| Branch requests Incoming | desktop-fa-light | supervisor | 17 | None |
| Branch requests Outgoing | desktop-en-light | supervisor | 17 | None |
| Branch requests Outgoing | desktop-en-dark | supervisor | 17 | None |
| Branch requests Outgoing | desktop-fa-light | supervisor | 17 | None |
| New request | desktop-en-light | supervisor | 19 | None |
| New request | desktop-en-dark | supervisor | 19 | None |
| New request | desktop-fa-light | supervisor | 19 | None |
| New request with item | desktop-en-light | supervisor | 21 | None |
| New request with item | desktop-en-dark | supervisor | 21 | None |
| New request with item | desktop-fa-light | supervisor | 21 | None |
| Saved request detail | desktop-en-light | supervisor | 18 | None |
| Saved request detail | desktop-en-dark | supervisor | 18 | None |
| Saved request detail | desktop-fa-light | supervisor | 18 | None |
| Cancel request reason | desktop-en-light | supervisor | 19 | None |
| Cancel request reason | desktop-en-dark | supervisor | 19 | None |
| Cancel request reason | desktop-fa-light | supervisor | 19 | None |
| Orders list | phone-en-light | supervisor | 14 | None |
| Orders list | phone-en-dark | supervisor | 14 | None |
| Orders list | phone-fa-light | supervisor | 14 | None |
| New order with supplier items | phone-en-light | supervisor | 15 | None |
| New order with supplier items | phone-en-dark | supervisor | 15 | None |
| New order with supplier items | phone-fa-light | supervisor | 15 | None |
| New order item dialog | phone-en-light | supervisor | 17 | None |
| Branch requests Incoming | phone-en-light | supervisor | 12 | None |
| Branch requests Incoming | phone-en-dark | supervisor | 12 | None |
| Branch requests Incoming | phone-fa-light | supervisor | 12 | None |
| Branch requests Outgoing | phone-en-light | supervisor | 12 | None |
| Branch requests Outgoing | phone-en-dark | supervisor | 12 | None |
| Branch requests Outgoing | phone-fa-light | supervisor | 12 | None |
| New request | phone-en-light | supervisor | 14 | None |
| New request | phone-en-dark | supervisor | 14 | None |
| New request | phone-fa-light | supervisor | 14 | None |
| New request with item | phone-en-light | supervisor | 16 | None |
| New request with item | phone-en-dark | supervisor | 16 | None |
| New request with item | phone-fa-light | supervisor | 16 | None |
| Saved request detail | phone-en-light | supervisor | 13 | None |
| Saved request detail | phone-en-dark | supervisor | 13 | None |
| Saved request detail | phone-fa-light | supervisor | 13 | None |
| Cancel request reason | phone-en-light | supervisor | 13 | None |
| Cancel request reason | phone-en-dark | supervisor | 13 | None |
| Cancel request reason | phone-fa-light | supervisor | 13 | None |
| Suppliers overview | desktop-en-light | supervisor | 28 | None |
| Suppliers overview | desktop-en-dark | supervisor | 28 | None |
| Suppliers overview | desktop-fa-light | supervisor | 28 | None |
| Add supplier dialog | desktop-en-light | supervisor | 34 | None |
| Supplier: Overview | desktop-en-light | supervisor | 24 | None |
| Supplier: Overview | desktop-en-dark | supervisor | 24 | None |
| Supplier: Overview | desktop-fa-light | supervisor | 24 | None |
| Supplier: Invoices | desktop-en-light | supervisor | 24 | None |
| Supplier: Invoices | desktop-en-dark | supervisor | 24 | None |
| Supplier: Invoices | desktop-fa-light | supervisor | 24 | None |
| Supplier: Supplier items | desktop-en-light | supervisor | 43 | None |
| Supplier: Supplier items | desktop-en-dark | supervisor | 43 | None |
| Supplier: Supplier items | desktop-fa-light | supervisor | 43 | None |
| Supplier: Received | desktop-en-light | supervisor | 38 | None |
| Supplier: Received | desktop-en-dark | supervisor | 38 | None |
| Supplier: Received | desktop-fa-light | supervisor | 38 | None |
| Supplier: Returns and credits | desktop-en-light | supervisor | 30 | None |
| Supplier: Returns and credits | desktop-en-dark | supervisor | 30 | None |
| Supplier: Returns and credits | desktop-fa-light | supervisor | 30 | None |
| Supplier: Shorts | desktop-en-light | supervisor | 24 | None |
| Supplier: Shorts | desktop-en-dark | supervisor | 24 | None |
| Supplier: Shorts | desktop-fa-light | supervisor | 24 | None |
| Supplier: Price alerts | desktop-en-light | supervisor | 24 | None |
| Supplier: Price alerts | desktop-en-dark | supervisor | 24 | None |
| Supplier: Price alerts | desktop-fa-light | supervisor | 24 | None |
| Supplier: Payments | desktop-en-light | supervisor | 24 | None |
| Supplier: Payments | desktop-en-dark | supervisor | 24 | None |
| Supplier: Payments | desktop-fa-light | supervisor | 24 | None |
| Supplier: Notes | desktop-en-light | supervisor | 24 | None |
| Supplier: Notes | desktop-en-dark | supervisor | 24 | None |
| Supplier: Notes | desktop-fa-light | supervisor | 24 | None |
| Edit supplier dialog | desktop-en-light | supervisor | 26 | None |
| Add supplier item dialog | desktop-en-light | supervisor | 46 | None |
| Supplier item price history dialog | desktop-en-light | supervisor | 45 | None |
| Edit supplier item dialog | desktop-en-light | supervisor | 46 | None |
| Suppliers overview | desktop-en-light | floor_worker | 21 | None |
| Suppliers overview | desktop-en-dark | floor_worker | 21 | None |
| Suppliers overview | desktop-fa-light | floor_worker | 21 | None |
| Supplier: Overview | desktop-en-light | floor_worker | 19 | None |
| Supplier: Overview | desktop-en-dark | floor_worker | 19 | None |
| Supplier: Overview | desktop-fa-light | floor_worker | 19 | None |
| Supplier: Invoices | desktop-en-light | floor_worker | 19 | None |
| Supplier: Invoices | desktop-en-dark | floor_worker | 19 | None |
| Supplier: Invoices | desktop-fa-light | floor_worker | 19 | None |
| Supplier: Supplier items | desktop-en-light | floor_worker | 25 | None |
| Supplier: Supplier items | desktop-en-dark | floor_worker | 25 | None |
| Supplier: Supplier items | desktop-fa-light | floor_worker | 25 | None |
| Supplier: Received | desktop-en-light | floor_worker | 32 | None |
| Supplier: Received | desktop-en-dark | floor_worker | 32 | None |
| Supplier: Received | desktop-fa-light | floor_worker | 32 | None |
| Supplier: Returns and credits | desktop-en-light | floor_worker | 25 | None |
| Supplier: Returns and credits | desktop-en-dark | floor_worker | 25 | None |
| Supplier: Returns and credits | desktop-fa-light | floor_worker | 25 | None |
| Supplier: Shorts | desktop-en-light | floor_worker | 19 | None |
| Supplier: Shorts | desktop-en-dark | floor_worker | 19 | None |
| Supplier: Shorts | desktop-fa-light | floor_worker | 19 | None |
| Supplier: Price alerts | desktop-en-light | floor_worker | 19 | None |
| Supplier: Price alerts | desktop-en-dark | floor_worker | 19 | None |
| Supplier: Price alerts | desktop-fa-light | floor_worker | 19 | None |
| Supplier: Notes | desktop-en-light | floor_worker | 19 | None |
| Supplier: Notes | desktop-en-dark | floor_worker | 19 | None |
| Supplier: Notes | desktop-fa-light | floor_worker | 19 | None |
| Suppliers overview | phone-en-light | supervisor | 23 | None |
| Suppliers overview | phone-en-dark | supervisor | 23 | None |
| Suppliers overview | phone-fa-light | supervisor | 23 | None |
| Add supplier dialog | phone-en-light | supervisor | 29 | None |
| Supplier: Overview | phone-en-light | supervisor | 19 | None |
| Supplier: Overview | phone-en-dark | supervisor | 19 | None |
| Supplier: Overview | phone-fa-light | supervisor | 19 | None |
| Supplier: Invoices | phone-en-light | supervisor | 19 | None |
| Supplier: Invoices | phone-en-dark | supervisor | 19 | None |
| Supplier: Invoices | phone-fa-light | supervisor | 19 | None |
| Supplier: Supplier items | phone-en-light | supervisor | 38 | None |
| Supplier: Supplier items | phone-en-dark | supervisor | 38 | None |
| Supplier: Supplier items | phone-fa-light | supervisor | 38 | None |
| Supplier: Received | phone-en-light | supervisor | 33 | None |
| Supplier: Received | phone-en-dark | supervisor | 33 | None |
| Supplier: Received | phone-fa-light | supervisor | 33 | None |
| Supplier: Returns and credits | phone-en-light | supervisor | 25 | None |
| Supplier: Returns and credits | phone-en-dark | supervisor | 25 | None |
| Supplier: Returns and credits | phone-fa-light | supervisor | 25 | None |
| Supplier: Shorts | phone-en-light | supervisor | 19 | None |
| Supplier: Shorts | phone-en-dark | supervisor | 19 | None |
| Supplier: Shorts | phone-fa-light | supervisor | 19 | None |
| Supplier: Price alerts | phone-en-light | supervisor | 19 | None |
| Supplier: Price alerts | phone-en-dark | supervisor | 19 | None |
| Supplier: Price alerts | phone-fa-light | supervisor | 19 | None |
| Supplier: Payments | phone-en-light | supervisor | 19 | None |
| Supplier: Payments | phone-en-dark | supervisor | 19 | None |
| Supplier: Payments | phone-fa-light | supervisor | 19 | None |
| Supplier: Notes | phone-en-light | supervisor | 19 | None |
| Supplier: Notes | phone-en-dark | supervisor | 19 | None |
| Supplier: Notes | phone-fa-light | supervisor | 19 | None |
| Edit supplier dialog | phone-en-light | supervisor | 21 | None |
| Add supplier item dialog | phone-en-light | supervisor | 41 | None |
| Supplier item price history dialog | phone-en-light | supervisor | 40 | None |
| Edit supplier item dialog | phone-en-light | supervisor | 41 | None |
| Suppliers overview | phone-en-light | floor_worker | 17 | None |
| Suppliers overview | phone-en-dark | floor_worker | 17 | None |
| Suppliers overview | phone-fa-light | floor_worker | 17 | None |
| Supplier: Overview | phone-en-light | floor_worker | 15 | None |
| Supplier: Overview | phone-en-dark | floor_worker | 15 | None |
| Supplier: Overview | phone-fa-light | floor_worker | 15 | None |
| Supplier: Invoices | phone-en-light | floor_worker | 15 | None |
| Supplier: Invoices | phone-en-dark | floor_worker | 15 | None |
| Supplier: Invoices | phone-fa-light | floor_worker | 15 | None |
| Supplier: Supplier items | phone-en-light | floor_worker | 21 | None |
| Supplier: Supplier items | phone-en-dark | floor_worker | 21 | None |
| Supplier: Supplier items | phone-fa-light | floor_worker | 21 | None |
| Supplier: Received | phone-en-light | floor_worker | 28 | None |
| Supplier: Received | phone-en-dark | floor_worker | 28 | None |
| Supplier: Received | phone-fa-light | floor_worker | 28 | None |
| Supplier: Returns and credits | phone-en-light | floor_worker | 21 | None |
| Supplier: Returns and credits | phone-en-dark | floor_worker | 21 | None |
| Supplier: Returns and credits | phone-fa-light | floor_worker | 21 | None |
| Supplier: Shorts | phone-en-light | floor_worker | 15 | None |
| Supplier: Shorts | phone-en-dark | floor_worker | 15 | None |
| Supplier: Shorts | phone-fa-light | floor_worker | 15 | None |
| Supplier: Price alerts | phone-en-light | floor_worker | 15 | None |
| Supplier: Price alerts | phone-en-dark | floor_worker | 15 | None |
| Supplier: Price alerts | phone-fa-light | floor_worker | 15 | None |
| Supplier: Notes | phone-en-light | floor_worker | 15 | None |
| Supplier: Notes | phone-en-dark | floor_worker | 15 | None |
| Supplier: Notes | phone-fa-light | floor_worker | 15 | None |
| Sign in | desktop-en-light | anonymous | 3 | None |
| Sign in | desktop-fa-light | anonymous | 3 | None |
| Choose a new password | desktop-en-light | floor_worker | 5 | None |
| Choose a new password | desktop-fa-light | floor_worker | 5 | None |
| Screen locked | desktop-en-dark | supervisor | 4 | None |
| Screen locked | desktop-fa-dark | supervisor | 4 | None |
| Sign in | phone-en-light | anonymous | 3 | None |
| Sign in | phone-fa-light | anonymous | 3 | None |
| Choose a new password | phone-en-light | floor_worker | 5 | None |
| Choose a new password | phone-fa-light | floor_worker | 5 | None |
| Screen locked | phone-en-dark | supervisor | 4 | None |
| Screen locked | phone-fa-dark | supervisor | 4 | None |
| Add product dialog | desktop-en-light | supervisor | 49 | None |
| Edit product dialog | desktop-en-light | supervisor | 36 | None |
| Remove date reason dialog | desktop-en-light | supervisor | 29 | None |
| Stop tracking this product dialog | desktop-en-light | supervisor | 29 | None |
| Apply conflict price to all branches dialog | desktop-en-light | supervisor | 18 | None |
| Review approval confirmation | desktop-en-light | supervisor | 23 | None |
| Reject proposal confirmation | desktop-en-light | supervisor | 22 | None |
| New invoice upload entry | desktop-en-light | supervisor | 91 | None |
| New invoice upload entry | desktop-en-dark | supervisor | 91 | None |
| New invoice upload entry | desktop-fa-light | supervisor | 91 | None |
| Simulated invoice upload review | desktop-en-light | supervisor | 95 | None |
| Simulated invoice upload review | desktop-en-dark | supervisor | 94 | None |
| Simulated invoice upload review | desktop-fa-light | supervisor | 94 | None |
| Add product dialog | phone-en-light | supervisor | 44 | None |
| Edit product dialog | phone-en-light | supervisor | 31 | None |
| Remove date reason dialog | phone-en-light | supervisor | 24 | None |
| Stop tracking this product dialog | phone-en-light | supervisor | 24 | None |
| Apply conflict price to all branches dialog | phone-en-light | supervisor | 13 | None |
| Review approval confirmation | phone-en-light | supervisor | 18 | None |
| Reject proposal confirmation | phone-en-light | supervisor | 17 | None |
| New invoice upload entry | phone-en-light | supervisor | 87 | None |
| New invoice upload entry | phone-en-dark | supervisor | 87 | None |
| New invoice upload entry | phone-fa-light | supervisor | 87 | None |
| Simulated invoice upload review | phone-en-light | supervisor | 91 | None |
| Simulated invoice upload review | phone-en-dark | supervisor | 91 | None |
| Simulated invoice upload review | phone-fa-light | supervisor | 91 | None |
| Lookup date tracking Off and inline Add | desktop-en-light | supervisor | 20 | None |
| Lookup date tracking Off and inline Add | phone-en-light | supervisor | 15 | None |
| Lookup date tracking Off and inline Add | desktop-en-light | floor_worker | 17 | None |
| Lookup date tracking Off and inline Add | phone-en-light | floor_worker | 13 | None |
| Record return pickup form | desktop-en-light | supervisor | 18 | None |
| Waiting for credit across return states | desktop-en-light | supervisor | 21 | None |
| Record return pickup form | phone-en-light | supervisor | 14 | None |
| Waiting for credit across return states | phone-en-light | supervisor | 16 | None |
| Waiting for credit across return states | desktop-fa-light | supervisor | 21 | None |
| Waiting for credit across return states | phone-fa-light | supervisor | 16 | None |
| Waiting for credit across return states | desktop-en-dark | supervisor | 21 | None |
| Waiting for credit across return states | phone-en-dark | supervisor | 16 | None |
| Posted invoice | desktop-en-light | supervisor | 26 | None |
| Move invoice dialog | desktop-en-light | supervisor | 29 | None |
| Correct invoice | desktop-en-light | supervisor | 64 | None |
| Return policy | desktop-en-light | supervisor | 17 | None |
| Posted invoice | phone-en-light | supervisor | 21 | None |
| Move invoice dialog | phone-en-light | supervisor | 24 | None |
| Correct invoice | phone-en-light | supervisor | 59 | None |
| Return policy | phone-en-light | supervisor | 12 | None |
| Posted invoice | desktop-en-dark | supervisor | 26 | None |
| Move invoice dialog | desktop-en-dark | supervisor | 29 | None |
| Correct invoice | desktop-en-dark | supervisor | 64 | None |
| Return policy | desktop-en-dark | supervisor | 17 | None |
| Posted invoice | phone-en-dark | supervisor | 21 | None |
| Move invoice dialog | phone-en-dark | supervisor | 24 | None |
| Correct invoice | phone-en-dark | supervisor | 59 | None |
| Return policy | phone-en-dark | supervisor | 12 | None |
| Posted invoice | desktop-fa-light | supervisor | 26 | None |
| Move invoice dialog | desktop-fa-light | supervisor | 29 | None |
| Correct invoice | desktop-fa-light | supervisor | 64 | None |
| Return policy | desktop-fa-light | supervisor | 17 | None |
| Posted invoice | phone-fa-light | supervisor | 21 | None |
| Move invoice dialog | phone-fa-light | supervisor | 24 | None |
| Correct invoice | phone-fa-light | supervisor | 59 | None |
| Return policy | phone-fa-light | supervisor | 12 | None |
| Create offer dialog | desktop-en-light | supervisor | 34 | None |
| Stop offer confirmation | desktop-en-light | supervisor | 29 | None |
| Create offer dialog | phone-en-light | supervisor | 29 | None |
| Stop offer confirmation | phone-en-light | supervisor | 24 | None |
| Return original-goods cancellation form | desktop-en-light | supervisor | 19 | None |
| Retained return memo dialog | desktop-en-light | supervisor | 21 | None |
| Return settlement form: Replaced | desktop-en-light | supervisor | 24 | None |
| Return settlement form: Credited | desktop-en-light | supervisor | 21 | None |
| Return settlement form: Cash or other compensation | desktop-en-light | supervisor | 20 | None |
| Return settlement form: Written off | desktop-en-light | supervisor | 20 | None |
| Return settlement form: Replaced | desktop-en-light | floor_worker | 22 | None |
| Return settlement form: Credited | desktop-en-light | floor_worker | 19 | None |
| Return settlement form: Cash or other compensation | desktop-en-light | floor_worker | 18 | None |
| Return original-goods cancellation form | phone-en-light | supervisor | 14 | None |
| Retained return memo dialog | phone-en-light | supervisor | 17 | None |
| Return settlement form: Replaced | phone-en-light | supervisor | 20 | None |
| Return settlement form: Credited | phone-en-light | supervisor | 16 | None |
| Return settlement form: Cash or other compensation | phone-en-light | supervisor | 15 | None |
| Return settlement form: Written off | phone-en-light | supervisor | 15 | None |
| Return settlement form: Replaced | phone-en-light | floor_worker | 19 | None |
| Return settlement form: Credited | phone-en-light | floor_worker | 15 | None |
| Return settlement form: Cash or other compensation | phone-en-light | floor_worker | 14 | None |
| invoices | desktop-fa-light | supervisor | 26 | None |
| products | desktop-fa-light | supervisor | 43 | None |
| Products weighed item | desktop-fa-light | supervisor | 29 | None |
| alerts | desktop-fa-light | supervisor | 16 | None |
| returns | desktop-fa-light | supervisor | 21 | None |
| expiry | desktop-fa-light | supervisor | 26 | None |
| offers | desktop-fa-light | supervisor | 27 | None |
| approvals | desktop-fa-light | supervisor | 20 | None |
| invoices | phone-fa-light | supervisor | 22 | None |
| products | phone-fa-light | supervisor | 38 | None |
| Products weighed item | phone-fa-light | supervisor | 24 | None |
| alerts | phone-fa-light | supervisor | 11 | None |
| returns | phone-fa-light | supervisor | 16 | None |
| expiry | phone-fa-light | supervisor | 21 | None |
| offers | phone-fa-light | supervisor | 22 | None |
| approvals | phone-fa-light | supervisor | 15 | None |
| invoices | desktop-en-dark | supervisor | 26 | None |
| products | desktop-en-dark | supervisor | 42 | None |
| Products weighed item | desktop-en-dark | supervisor | 29 | None |
| alerts | desktop-en-dark | supervisor | 16 | None |
| returns | desktop-en-dark | supervisor | 21 | None |
| expiry | desktop-en-dark | supervisor | 26 | None |
| offers | desktop-en-dark | supervisor | 27 | None |
| approvals | desktop-en-dark | supervisor | 20 | None |
| invoices | phone-en-dark | supervisor | 22 | None |
| products | phone-en-dark | supervisor | 37 | None |
| Products weighed item | phone-en-dark | supervisor | 24 | None |
| alerts | phone-en-dark | supervisor | 11 | None |
| returns | phone-en-dark | supervisor | 16 | None |
| expiry | phone-en-dark | supervisor | 21 | None |
| offers | phone-en-dark | supervisor | 22 | None |
| approvals | phone-en-dark | supervisor | 15 | None |
| invoices | desktop-en-light | supervisor | 26 | None |
| products | desktop-en-light | supervisor | 42 | None |
| Products weighed item | desktop-en-light | supervisor | 29 | None |
| alerts | desktop-en-light | supervisor | 16 | None |
| returns | desktop-en-light | supervisor | 21 | None |
| expiry | desktop-en-light | supervisor | 26 | None |
| offers | desktop-en-light | supervisor | 27 | None |
| approvals | desktop-en-light | supervisor | 20 | None |
| invoices | phone-en-light | supervisor | 22 | None |
| products | phone-en-light | supervisor | 37 | None |
| Products weighed item | phone-en-light | supervisor | 24 | None |
| alerts | phone-en-light | supervisor | 11 | None |
| returns | phone-en-light | supervisor | 16 | None |
| expiry | phone-en-light | supervisor | 21 | None |
| offers | phone-en-light | supervisor | 22 | None |
| approvals | phone-en-light | supervisor | 15 | None |
| Date quick-add with More | desktop-en-light | supervisor | 27 | None |
| New shelf date and Undo | desktop-en-light | supervisor | 30 | None |
| Date quick-add with More | phone-en-light | supervisor | 22 | None |
| New shelf date and Undo | phone-en-light | supervisor | 25 | None |
| Request catalog search result | desktop-en-light | floor_worker | 18 | None |
| Requested branch request | desktop-en-light | floor_worker | 13 | None |
| Request Short decision and Mark as sent | desktop-en-light | supervisor | 17 | None |
| Request Missing decision and Mark as received | desktop-en-light | floor_worker | 16 | None |
| Received request and Close request | desktop-en-light | floor_worker | 15 | None |
| Closed request and residual-copy action | desktop-en-light | floor_worker | 15 | None |
| Copied short or missing draft | desktop-en-light | floor_worker | 19 | None |
| Request catalog search result | phone-en-light | floor_worker | 14 | None |
| Requested branch request | phone-en-light | floor_worker | 9 | None |
| Request Short decision and Mark as sent | phone-en-light | supervisor | 12 | None |
| Request Missing decision and Mark as received | phone-en-light | floor_worker | 12 | None |
| Received request and Close request | phone-en-light | floor_worker | 11 | None |
| Closed request and residual-copy action | phone-en-light | floor_worker | 11 | None |
| Copied short or missing draft | phone-en-light | floor_worker | 15 | None |
| Saved order Place/Edit/Print/Cancel actions | desktop-en-light | supervisor | 18 | None |
| Saved order print preview dialog | desktop-en-light | supervisor | 20 | None |
| Cancel order Keep order confirmation | desktop-en-light | supervisor | 20 | None |
| Saved order Place/Edit/Print/Cancel actions | phone-en-light | supervisor | 13 | None |
| Saved order print preview dialog | phone-en-light | supervisor | 15 | None |
| Cancel order Keep order confirmation | phone-en-light | supervisor | 15 | None |
| Invoice correction preview Continue/Back actions | desktop-en-light | supervisor | 28 | None |
| Invoice correction final confirmation | desktop-en-light | supervisor | 28 | None |
| Corrected posted invoice version actions | desktop-en-light | supervisor | 28 | None |
| Corrected History More actions menu | desktop-en-light | supervisor | 21 | None |
| Revert History change confirmation | desktop-en-light | supervisor | 24 | None |
| Invoice correction preview Continue/Back actions | phone-en-light | supervisor | 23 | None |
| Invoice correction final confirmation | phone-en-light | supervisor | 23 | None |
| Corrected posted invoice version actions | phone-en-light | supervisor | 23 | None |
| Corrected History More actions menu | phone-en-light | supervisor | 16 | None |
| Revert History change confirmation | phone-en-light | supervisor | 19 | None |
| Notebook entry Edit note action | desktop-en-light | supervisor | 27 | None |
| Edit notebook entry form | desktop-en-light | supervisor | 30 | None |
| Supervisor note Mark seen and Mark done actions | desktop-en-light | supervisor | 23 | None |
| Completed notebook entry Mark open action | desktop-en-light | supervisor | 23 | None |
| Notebook entry Edit note action | phone-en-light | supervisor | 22 | None |
| Edit notebook entry form | phone-en-light | supervisor | 25 | None |
| Supervisor note Mark seen and Mark done actions | phone-en-light | supervisor | 18 | None |
| Completed notebook entry Mark open action | phone-en-light | supervisor | 18 | None |
| Return cancellation disposition submission | desktop-en-light | floor_worker | 18 | None |
| Return cancellation awaiting Supervisor | desktop-en-light | floor_worker | 11 | None |
| Supervisor cancellation approve/decline review | desktop-en-light | supervisor | 17 | None |
| Return cancellation disposition submission | phone-en-light | floor_worker | 14 | None |
| Return cancellation awaiting Supervisor | phone-en-light | floor_worker | 7 | None |
| Supervisor cancellation approve/decline review | phone-en-light | supervisor | 12 | None |
| Saved label template archive action | desktop-en-light | floor_worker | 40 | None |
| Archived label template restore action | desktop-en-light | floor_worker | 41 | None |
| Selected product add-to-waitlist action | desktop-en-light | floor_worker | 23 | None |
| Waitlist with printable label copies | desktop-en-light | floor_worker | 36 | None |
| Label print confirmation Yes and No | desktop-en-light | floor_worker | 38 | None |
| Saved label template archive action | phone-en-light | floor_worker | 36 | None |
| Archived label template restore action | phone-en-light | floor_worker | 37 | None |
| Selected product add-to-waitlist action | phone-en-light | floor_worker | 19 | None |
| Waitlist with printable label copies | phone-en-light | floor_worker | 32 | None |
| Label print confirmation Yes and No | phone-en-light | floor_worker | 34 | None |
| Expired session reauthentication dialog | desktop-en-light | supervisor | 15 | None |
| Expired session reauthentication dialog | phone-en-light | supervisor | 10 | None |
| topbar | en-light | supervisor | 40 | None |
| invoices-list | en-light | supervisor | 24 | None |
| products-weight | en-light | supervisor | 25 | None |
| alerts | en-light | supervisor | 12 | None |
| returns-list | en-light | supervisor | 17 | None |
| return-detail | en-light | supervisor | 11 | None |
| return-policy | en-light | supervisor | 13 | None |
| date-quick-add | en-light | supervisor | 23 | None |
| lookup-dates | en-light | supervisor | 16 | None |
| offers-current | en-light | supervisor | 23 | None |
| offers-past | en-light | supervisor | 19 | None |
| posted-invoice | en-light | supervisor | 22 | None |
| original-whole-page | en-light | supervisor | 22 | None |
| correct-invoice | en-light | supervisor | 60 | None |
| approvals-tabs | en-light | supervisor | 16 | None |
| topbar | en-dark | supervisor | 40 | None |
| invoices-list | en-dark | supervisor | 24 | None |
| products-weight | en-dark | supervisor | 25 | None |
| alerts | en-dark | supervisor | 12 | None |
| returns-list | en-dark | supervisor | 17 | None |
| return-detail | en-dark | supervisor | 11 | None |
| return-policy | en-dark | supervisor | 13 | None |
| date-quick-add | en-dark | supervisor | 23 | None |
| lookup-dates | en-dark | supervisor | 16 | None |
| offers-current | en-dark | supervisor | 23 | None |
| offers-past | en-dark | supervisor | 19 | None |
| posted-invoice | en-dark | supervisor | 22 | None |
| original-whole-page | en-dark | supervisor | 22 | None |
| correct-invoice | en-dark | supervisor | 60 | None |
| approvals-tabs | en-dark | supervisor | 16 | None |
| topbar | fa-light | supervisor | 40 | None |
| invoices-list | fa-light | supervisor | 24 | None |
| products-weight | fa-light | supervisor | 25 | None |
| alerts | fa-light | supervisor | 12 | None |
| returns-list | fa-light | supervisor | 17 | None |
| return-detail | fa-light | supervisor | 11 | None |
| return-policy | fa-light | supervisor | 13 | None |
| date-quick-add | fa-light | supervisor | 23 | None |
| lookup-dates | fa-light | supervisor | 16 | None |
| offers-current | fa-light | supervisor | 23 | None |
| offers-past | fa-light | supervisor | 19 | None |
| posted-invoice | fa-light | supervisor | 22 | None |
| original-whole-page | fa-light | supervisor | 22 | None |
| correct-invoice | fa-light | supervisor | 60 | None |
| approvals-tabs | fa-light | supervisor | 16 | None |
| topbar | phone | supervisor | 39 | None |
| invoices-list | phone | supervisor | 23 | None |
| products-weight | phone | supervisor | 24 | None |
| alerts | phone | supervisor | 11 | None |
| returns-list | phone | supervisor | 16 | None |
| return-detail | phone | supervisor | 10 | None |
| return-policy | phone | supervisor | 12 | None |
| date-quick-add | phone | supervisor | 22 | None |
| lookup-dates | phone | supervisor | 15 | None |
| offers-current | phone | supervisor | 22 | None |
| offers-past | phone | supervisor | 18 | None |
| posted-invoice | phone | supervisor | 21 | None |
| original-whole-page | phone | supervisor | 21 | None |
| correct-invoice | phone | supervisor | 59 | None |
| approvals-tabs | phone | supervisor | 15 | None |

## Conditional states and coverage limits

The source census is complete; runtime observations cover the states listed above. The following conditions are not exhaustively opened in this presentation run. Some controls can appear in another recorded scene, but shared text alone does not prove that a specific source callsite was exercised. Their geometry remains a source contract until that state has an explicit browser observation. Additional operational tests verify behavior separately and are not substituted for computed geometry.

| Component | Additional conditional controls | Coverage limit |
| --- | --- | --- |
| Notes | Custom notebook definition edit/archive/restore confirmations | Notebook entry editing and seen/done/open actions are measured. Definition lifecycle confirmations are not exhaustively opened; they use the inventoried shared Dialog and Button contracts. |
| Orders | Linked receipt references and removal of an attached notebook note | The presentation run includes saved-order print/cancel dialogs. These additional controls require a linked receiving record or an attached ordering note. |
| InvoiceOrderReview / Invoices | Order comparison refresh, short-delivery receiving, manual new-product line, and successful move state | Posted invoices, original viewer, correction preview/confirmation/version links, move dialog, upload entry, and simulated upload review are measured. These additional actions require a linked order or further manual-entry/move progression. |
| Returns / SupplierApproval | Supplier/product approval rejection and Supervisor claim verification | Pickup, memo, cancellation request/disposition, Supervisor cancellation approval/decline, policy, and settlement forms are measured. These additional approval/verification actions require specific supplier or submitted-claim states. |
| All additional conditional forms | All combinations of language, theme, role, field values, and popup options | The supplemental lifecycle observations use English light on desktop and phone. Main screens have additional English dark and Persian coverage; extra dialogs are English light unless their recorded appearance says otherwise. The audit does not claim the full Cartesian product of application states. |
| Shared Menu / Select / Columns / DateField | Every popup option, optional-column reset, and calendar month/day selection | Shared implementations and their visible triggers are inventoried. A closed popup's options are not claimed as measured; the raw reports identify the options actually open in each scene. |
