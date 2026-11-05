'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';

const dict = {
  ar: {
    appName: 'المستودع المركزي', appTagline: 'الطلبات والمخزون والمشتريات',
    signIn: 'تسجيل الدخول', signOut: 'تسجيل الخروج', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    demoAccounts: 'حسابات تجريبية', demoHint: 'كلمة المرور لجميعها',
    navDashboard: 'لوحة التحكم', navRequests: 'الطلبات', navMyRequests: 'طلباتي', navApprovals: 'طلبات الإدارة',
    navWarehouseQueue: 'طابور الصرف', navNewRequest: 'طلب جديد', navInventory: 'المخزون', navInvoices: 'فواتير الشراء',
    navPurchase: 'طلبات الشراء', navReports: 'التقارير',
    hello: 'مرحباً', loading: 'جارٍ التحميل…', retry: 'إعادة المحاولة', save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق',
    search: 'بحث', all: 'الكل', none: 'لا يوجد', total: 'الإجمالي', units: 'وحدة', currency: 'ر.س',
    // roles
    role_EMPLOYEE: 'موظف', role_DEPT_MANAGER: 'مدير إدارة', role_WAREHOUSE_KEEPER: 'أمين المستودع', role_ADMIN: 'مدير النظام',
    // statuses
    st_PENDING_MANAGER: 'بانتظار المدير', st_NEEDS_EDIT: 'يحتاج تعديل', st_REJECTED: 'مرفوض', st_PENDING_WAREHOUSE: 'بانتظار المستودع',
    st_AWAITING_PURCHASE: 'بانتظار الشراء', st_PARTIALLY_ISSUED: 'صرف جزئي', st_ISSUED: 'تم الصرف', st_CANCELLED: 'ملغى',
    pr_OPEN: 'مفتوح', pr_ORDERED: 'تم الطلب من المورد', pr_RECEIVED: 'تم الاستلام', pr_CANCELLED: 'ملغى',
    // pipeline
    stageManager: 'عند المدير', stageWarehouse: 'عند المستودع', stagePurchase: 'بانتظار الشراء', stageIssued: 'تم الصرف',
    pipelineTitle: 'مسار الطلبات الآن', pipelineHint: 'اضغط على مرحلة لعرض طلباتها',
    // dashboard
    requestsPerMonth: 'الطلبات خلال آخر 6 أشهر', unitsByCategory: 'الكميات المطلوبة حسب الفئة',
    stockValue: 'قيمة المخزون', stockUnits: 'وحدات في المخزون', lowItems: 'أصناف تحت الحد الأدنى', openPR: 'طلبات شراء مفتوحة',
    lowStockTitle: 'أصناف تحتاج توريداً', latestInvoices: 'آخر الفواتير', nothingLow: 'كل الأصناف فوق الحد الأدنى.',
    needsEditBanner: 'لديك طلبات أعادها المدير للتعديل', rejectedCount: 'مرفوضة',
    // requests
    requestNo: 'طلب رقم', newRequest: 'طلب جديد', requester: 'مقدّم الطلب', department: 'الإدارة', branch: 'الفرع',
    date: 'التاريخ', status: 'الحالة', itemsCount: 'عدد الأصناف', qty: 'الكمية', item: 'الصنف', category: 'الفئة',
    justification: 'سبب الطلب', justificationPh: 'مثال: استبدال جهاز تالف، موظف جديد…', addItem: 'إضافة صنف', chooseItem: 'اختر صنفاً',
    submitRequest: 'إرسال الطلب إلى المدير', requestSent: 'أُرسل الطلب إلى المدير', requested: 'المطلوب', approved: 'المعتمد',
    issued: 'المصروف', approve: 'اعتماد', reject: 'رفض', returnForEdit: 'إعادة للتعديل', cancelRequest: 'إلغاء الطلب',
    issueNow: 'صرف من المخزون (FIFO)', managerNote: 'ملاحظة المدير', noteRequired: 'اكتب السبب ليراه الموظف',
    approvedQtyHint: 'يمكنك تقليل الكمية المعتمدة لكل صنف قبل الاعتماد', timeline: 'سجل الطلب',
    emptyRequests: 'لا توجد طلبات هنا بعد.', emptyRequestsHint: 'ابدأ بطلب جديد وسيظهر هنا مباشرة.',
    editAndResend: 'عدّل وأعد الإرسال', resubmit: 'إعادة الإرسال', autoApproved: 'طلبك اعتُمد تلقائياً لأنك مدير الإدارة',
    ev_SUBMITTED: 'أُرسل الطلب', ev_APPROVED: 'اعتمده المدير', ev_REJECTED: 'رفضه المدير', ev_RETURNED: 'أعاده المدير للتعديل',
    ev_RESUBMITTED: 'أُعيد إرسال الطلب', ev_ISSUED: 'صرف من المستودع', ev_CANCELLED: 'أُلغي الطلب',
    issuedOk: 'تم الصرف', issuedPartial: 'صُرف جزء من الطلب وحُوّل الباقي إلى طلب شراء', shortageNote: 'العجز تحوّل إلى طلب شراء رقم',
    // inventory
    onHand: 'الرصيد', minStock: 'الحد الأدنى', value: 'القيمة', sku: 'الرمز', unit: 'الوحدة', lowOnly: 'تحت الحد فقط',
    batchesFifo: 'الدفعات بترتيب الصرف (الأقدم أولاً)', batchNext: 'تُصرف أولاً', invoice: 'فاتورة', received: 'استلام',
    remaining: 'المتبقي', unitCost: 'سعر الوحدة', addNewItem: 'صنف جديد', itemName: 'اسم الصنف',
    // invoices
    newInvoice: 'فاتورة جديدة', invoiceNo: 'رقم الفاتورة', supplier: 'المورد', invoiceDate: 'تاريخ الفاتورة',
    linkedPR: 'ربط بطلب شراء (اختياري)', addLine: 'إضافة سطر', invoiceSaved: 'سُجّلت الفاتورة وأضيفت الدفعات للمخزون',
    lines: 'الأسطر', createdBy: 'أدخلها',
    // purchase
    markOrdered: 'تم الطلب من المورد', forRequest: 'للطلب', registerInvoice: 'تسجيل فاتورة الاستلام',
    emptyPR: 'لا توجد طلبات شراء. تُنشأ هنا تلقائياً عندما يبلغ رصيد صنف حدّه الأدنى أو لا يكفي المخزون لطلب.',
    // reports
    topRequesters: 'الأكثر طلباً', topItems: 'الأصناف الأكثر طلباً', deptApprovals: 'اعتماد الإدارات', branchPurchases: 'مشتريات الفروع',
    monthlyPurchases: 'المشتريات الشهرية', approvedN: 'معتمد', rejectedN: 'مرفوض', returnedN: 'معاد', requestsN: 'طلب', from: 'من', to: 'إلى',
    apply: 'تطبيق', invoicesN: 'فاتورة', exportCsv: 'تصدير CSV', approvalRate: 'نسبة الاعتماد',
    errorTitle: 'تعذر تحميل البيانات', errorHint: 'تأكد من تشغيل الخادم ثم أعد المحاولة.',
    navAdmin: 'المستخدمون والهيكل', tabUsers: 'المستخدمون', tabOrg: 'الفروع والإدارات', newUser: 'مستخدم جديد', editUser: 'تعديل المستخدم',
    fullName: 'الاسم الكامل', role: 'الدور', active: 'فعّال', inactive: 'موقوف', edit: 'تعديل', setPassword: 'كلمة مرور جديدة',
    passwordKeep: 'اتركها فارغة للإبقاء على الحالية', passwordMin: '8 أحرف على الأقل', newBranch: 'فرع جديد', city: 'المدينة',
    newDepartment: 'إدارة جديدة', branchName: 'اسم الفرع', deptName: 'اسم الإدارة', noDepartments: 'لا توجد إدارات بعد', saved: 'تم الحفظ',
    kpiTotal: 'إجمالي الطلبات', kpiDone: 'تم صرفها', kpiProgress: 'قيد المعالجة', kpiAttention: 'بانتظار إجراءك', kpiAttentionAdmin: 'بانتظار الشراء',
    thisMonth: 'هذا الشهر', vsLastMonth: 'عن الشهر الماضي', ofTotalPct: 'من الإجمالي', progressTitle: 'نظرة على الإنجاز', completedWord: 'مكتمل',
    remainingWord: 'المتبقي', completedOf: 'طلب مكتمل من', weeklyTitle: 'الطلبات هذا الأسبوع', boardTitle: 'لوحة الطلبات', showAll: 'عرض الكل',
    noCardsHere: 'لا طلبات في هذه المرحلة', recentActivity: 'المشاريع الأحدث',
    username: 'رقم المستخدم', usernameHint: 'أو البريد الإلكتروني', usernameRule: 'أرقام أو أحرف إنجليزية فقط',
    code: 'الكود', rowTotalVat: 'الإجمالي شامل الضريبة', subtotalLabel: 'المجموع قبل الضريبة', vatLabel: 'ضريبة القيمة المضافة', vatRateLabel: 'نسبة الضريبة %',
    unitCostExVat: 'التكلفة (قبل الضريبة)', qtyShort: 'العدد', moreOptions: 'خيارات إضافية', exVat: 'قبل الضريبة', removeRow: 'حذف السطر',
    invoiceDetails: 'تفاصيل الفاتورة', lineSubtotal: 'قبل الضريبة', linkedPurchase: 'طلب الشراء المرتبط', notesLabel: 'ملاحظات',
    invoiceTitle: 'فاتورة مشتريات', vatNo: 'الرقم الضريبي', sellerLabel: 'المورد (البائع)', buyerLabel: 'جهة الاستلام', print: 'طباعة', scanQr: 'رمز التحقق (QR)',
    storekeeper: 'أمين المستودع', financeMgr: 'المدير المالي', signatureLabel: 'التوقيع', unitLabel: 'الوحدة', phoneLabel: 'الهاتف', generatedBy: 'صدرت من نظام المستودع المركزي', deleteRow: 'حذف الصف', notRegistered: 'غير مسجل',
    reorderQty: 'كمية إعادة الطلب', minStockHint: 'عند بلوغ هذا الرصيد أو النزول عنه يُنشأ طلب شراء تلقائي', reorderQtyHint: '0 = تلقائي (ضعف الحد الأدنى ناقص الرصيد)',
    editItem: 'تعديل الصنف', autoReorder: 'تلقائي: بلغ الحد الأدنى', shortageKind: 'عجز في طلب', itemSaved: 'تم حفظ الصنف',
    pagination: 'الترقيم', ofCount: 'من', prevPage: 'الصفحة السابقة', nextPage: 'الصفحة التالية', pageWord: 'الصفحة',
    navAbout: 'من نحن', supportLine: 'للدعم والاستفسار',
    requestInfo: 'بيانات الطلب', requestInfoHint: 'الفرع والإدارة الطالبة', requestedItems: 'الأصناف المطلوبة', chooseBranch: 'اختر الفرع', chooseDepartment: 'اختر الإدارة', completeRequest: 'أكمل الحقول المطلوبة للإرسال', noItemsHint: 'لا توجد أصناف معرّفة بعد. أضفها من شاشة التهيئة.',
    tabSections: 'الأقسام', setupSectionsHint: 'قائمة الأقسام (مستقلة عن الفروع والإدارات)', sectionName: 'اسم القسم', newSection: 'قسم جديد', editSection: 'تعديل القسم', noSections: 'لا توجد أقسام بعد', section: 'القسم', chooseSection: 'اختر القسم (اختياري)',
    navSetup: 'التهيئة', tabDepartments: 'الإدارات', tabBranches: 'الفروع', setupDeptsHint: 'قائمة الإدارات (مستقلة عن الفروع)', tabItems: 'الأصناف', setupItemsHint: 'بيانات الأصناف الأساسية', setupBranchesHint: 'بيانات الفروع',
    itemNumber: 'رقم الصنف', itemDescription: 'الوصف', barcode: 'الباركود', branchNumber: 'رقم الفرع', newItem: 'صنف جديد',
    editBranch: 'تعديل الفرع', editDepartment: 'تعديل الإدارة', departmentsCount: 'الإدارات', searchItems: 'ابحث بالاسم أو الرقم أو الباركود',
    lang: 'English',
  },
  en: {
    appName: 'Central Warehouse', appTagline: 'Requests, stock and purchasing',
    signIn: 'Sign in', signOut: 'Sign out', email: 'Email', password: 'Password',
    demoAccounts: 'Demo accounts', demoHint: 'Same password for all',
    navDashboard: 'Dashboard', navRequests: 'Requests', navMyRequests: 'My requests', navApprovals: 'Department requests',
    navWarehouseQueue: 'Issue queue', navNewRequest: 'New request', navInventory: 'Inventory', navInvoices: 'Purchase invoices',
    navPurchase: 'Purchase requests', navReports: 'Reports',
    hello: 'Hello', loading: 'Loading…', retry: 'Retry', save: 'Save', cancel: 'Cancel', close: 'Close',
    search: 'Search', all: 'All', none: 'None', total: 'Total', units: 'units', currency: 'SAR',
    role_EMPLOYEE: 'Employee', role_DEPT_MANAGER: 'Department manager', role_WAREHOUSE_KEEPER: 'Warehouse keeper', role_ADMIN: 'Administrator',
    st_PENDING_MANAGER: 'With manager', st_NEEDS_EDIT: 'Needs edit', st_REJECTED: 'Rejected', st_PENDING_WAREHOUSE: 'With warehouse',
    st_AWAITING_PURCHASE: 'Awaiting purchase', st_PARTIALLY_ISSUED: 'Partly issued', st_ISSUED: 'Issued', st_CANCELLED: 'Cancelled',
    pr_OPEN: 'Open', pr_ORDERED: 'Ordered from supplier', pr_RECEIVED: 'Received', pr_CANCELLED: 'Cancelled',
    stageManager: 'With manager', stageWarehouse: 'With warehouse', stagePurchase: 'Awaiting purchase', stageIssued: 'Issued',
    pipelineTitle: 'Requests in flight', pipelineHint: 'Select a stage to see its requests',
    requestsPerMonth: 'Requests over the last 6 months', unitsByCategory: 'Requested units by category',
    stockValue: 'Stock value', stockUnits: 'Units in stock', lowItems: 'Items below minimum', openPR: 'Open purchase requests',
    lowStockTitle: 'Items to restock', latestInvoices: 'Latest invoices', nothingLow: 'Every item is above its minimum.',
    needsEditBanner: 'Your manager returned requests for editing', rejectedCount: 'rejected',
    requestNo: 'Request', newRequest: 'New request', requester: 'Requester', department: 'Department', branch: 'Branch',
    date: 'Date', status: 'Status', itemsCount: 'Items', qty: 'Qty', item: 'Item', category: 'Category',
    justification: 'Reason', justificationPh: 'e.g. replacing a broken device, new hire…', addItem: 'Add item', chooseItem: 'Choose an item',
    submitRequest: 'Send to manager', requestSent: 'Request sent to your manager', requested: 'Requested', approved: 'Approved',
    issued: 'Issued', approve: 'Approve', reject: 'Reject', returnForEdit: 'Return for edit', cancelRequest: 'Cancel request',
    issueNow: 'Issue from stock (FIFO)', managerNote: 'Manager note', noteRequired: 'Write the reason so the employee can see it',
    approvedQtyHint: 'You can lower the approved quantity per item before approving', timeline: 'Request history',
    emptyRequests: 'No requests here yet.', emptyRequestsHint: 'Create a request and it will show up right away.',
    editAndResend: 'Edit and resend', resubmit: 'Resend', autoApproved: 'Auto-approved because you manage the department',
    ev_SUBMITTED: 'Request sent', ev_APPROVED: 'Approved by manager', ev_REJECTED: 'Rejected by manager', ev_RETURNED: 'Returned for edit',
    ev_RESUBMITTED: 'Request resent', ev_ISSUED: 'Issued from warehouse', ev_CANCELLED: 'Request cancelled',
    issuedOk: 'Issued', issuedPartial: 'Partly issued; the rest became a purchase request', shortageNote: 'Shortage moved to purchase request',
    onHand: 'On hand', minStock: 'Minimum', value: 'Value', sku: 'SKU', unit: 'Unit', lowOnly: 'Below minimum only',
    batchesFifo: 'Batches in issue order (oldest first)', batchNext: 'Issued first', invoice: 'Invoice', received: 'Received',
    remaining: 'Remaining', unitCost: 'Unit cost', addNewItem: 'New item', itemName: 'Item name',
    newInvoice: 'New invoice', invoiceNo: 'Invoice number', supplier: 'Supplier', invoiceDate: 'Invoice date',
    linkedPR: 'Link to purchase request (optional)', addLine: 'Add line', invoiceSaved: 'Invoice saved and batches added to stock',
    lines: 'Lines', createdBy: 'Entered by',
    markOrdered: 'Ordered from supplier', forRequest: 'For request', registerInvoice: 'Record receiving invoice',
    emptyPR: 'No purchase requests. They are created here automatically when an item reaches its minimum stock or a request cannot be fully issued.',
    topRequesters: 'Top requesters', topItems: 'Most requested items', deptApprovals: 'Department approvals', branchPurchases: 'Branch purchases',
    monthlyPurchases: 'Monthly purchases', approvedN: 'Approved', rejectedN: 'Rejected', returnedN: 'Returned', requestsN: 'requests', from: 'From', to: 'To',
    apply: 'Apply', invoicesN: 'invoices', exportCsv: 'Export CSV', approvalRate: 'Approval rate',
    errorTitle: 'Could not load data', errorHint: 'Check that the server is running, then retry.',
    navAdmin: 'Users & structure', tabUsers: 'Users', tabOrg: 'Branches & departments', newUser: 'New user', editUser: 'Edit user',
    fullName: 'Full name', role: 'Role', active: 'Active', inactive: 'Disabled', edit: 'Edit', setPassword: 'New password',
    passwordKeep: 'Leave empty to keep the current one', passwordMin: 'At least 8 characters', newBranch: 'New branch', city: 'City',
    newDepartment: 'New department', branchName: 'Branch name', deptName: 'Department name', noDepartments: 'No departments yet', saved: 'Saved',
    kpiTotal: 'Total requests', kpiDone: 'Issued', kpiProgress: 'In progress', kpiAttention: 'Needs your action', kpiAttentionAdmin: 'Awaiting purchase',
    thisMonth: 'this month', vsLastMonth: 'vs last month', ofTotalPct: 'of total', progressTitle: 'Completion overview', completedWord: 'Completed',
    remainingWord: 'Remaining', completedOf: 'requests completed of', weeklyTitle: 'Requests this week', boardTitle: 'Request board', showAll: 'View all',
    noCardsHere: 'No requests at this stage', recentActivity: 'Recent',
    username: 'User number', usernameHint: 'or email', usernameRule: 'Digits or English letters only',
    code: 'Code', rowTotalVat: 'Total incl. VAT', subtotalLabel: 'Subtotal (excl. VAT)', vatLabel: 'VAT', vatRateLabel: 'VAT rate %',
    unitCostExVat: 'Unit cost (excl. VAT)', qtyShort: 'Qty', moreOptions: 'More options', exVat: 'excl. VAT', removeRow: 'Remove row',
    invoiceDetails: 'Invoice details', lineSubtotal: 'Excl. VAT', linkedPurchase: 'Linked purchase request', notesLabel: 'Notes',
    invoiceTitle: 'Purchase invoice', vatNo: 'VAT number', sellerLabel: 'Supplier (seller)', buyerLabel: 'Receiving party', print: 'Print', scanQr: 'Verification code (QR)',
    storekeeper: 'Warehouse keeper', financeMgr: 'Finance manager', signatureLabel: 'Signature', unitLabel: 'Unit', phoneLabel: 'Phone', generatedBy: 'Generated by Central Warehouse system', deleteRow: 'Delete row', notRegistered: 'Not registered',
    reorderQty: 'Reorder quantity', minStockHint: 'A purchase request is created automatically when stock reaches or drops below this level', reorderQtyHint: '0 = automatic (double the minimum minus on hand)',
    editItem: 'Edit item', autoReorder: 'Auto: reached minimum stock', shortageKind: 'Request shortage', itemSaved: 'Item saved',
    pagination: 'Pagination', ofCount: 'of', prevPage: 'Previous page', nextPage: 'Next page', pageWord: 'Page',
    navAbout: 'About us', supportLine: 'Support and enquiries',
    requestInfo: 'Request details', requestInfoHint: 'Requesting branch and department', requestedItems: 'Requested items', chooseBranch: 'Choose branch', chooseDepartment: 'Choose department', completeRequest: 'Complete the required fields to submit', noItemsHint: 'No items defined yet. Add them from Setup.',
    tabSections: 'Sections', setupSectionsHint: 'Sections list (independent of branches and departments)', sectionName: 'Section name', newSection: 'New section', editSection: 'Edit section', noSections: 'No sections yet', section: 'Section', chooseSection: 'Choose section (optional)',
    navSetup: 'Setup', tabDepartments: 'Departments', tabBranches: 'Branches', setupDeptsHint: 'Departments list (independent of branches)', tabItems: 'Items', setupItemsHint: 'Master item data', setupBranchesHint: 'Branch data',
    itemNumber: 'Item number', itemDescription: 'Description', barcode: 'Barcode', branchNumber: 'Branch number', newItem: 'New item',
    editBranch: 'Edit branch', editDepartment: 'Edit department', departmentsCount: 'Departments', searchItems: 'Search by name, number or barcode',
    lang: 'العربية',
  },
} as const;

export type Key = keyof (typeof dict)['ar'];

interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (k: Key | (string & {})) => string;
  toggle: () => void;
  fmt: { num: (n: number) => string; money: (n: number) => string; money2: (n: number) => string; date: (d: string | Date) => string; month: (ym: string) => string };
}

const Ctx = createContext<I18n | null>(null);
const STORE = 'procure.lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORE);
      if (saved === 'en' || saved === 'ar') setLang(saved);
    } catch { /* التخزين غير متاح */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { window.localStorage.setItem(STORE, lang); } catch { /* تجاهل */ }
  }, [lang]);

  const t = useCallback((k: string) => (dict[lang] as Record<string, string>)[k] ?? k, [lang]);

  const value = useMemo<I18n>(() => {
    // أرقام لاتينية في الاتجاهين: أوضح في الجداول المالية وأسهل مطابقة الفواتير
    const locale = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
    const nf = new Intl.NumberFormat(locale);
    const mf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const m2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t,
      toggle: () => setLang((l) => (l === 'ar' ? 'en' : 'ar')),
      fmt: {
        num: (n) => nf.format(n),
        money: (n) => `${mf.format(n)} ${dict[lang].currency}`,
        money2: (n) => `${m2.format(n)} ${dict[lang].currency}`,
        date: (d) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(d)),
        month: (ym) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(`${ym}-01T00:00:00`)),
      },
    };
  }, [lang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
