-- الفواتير القديمة حفظت الإجمالي قبل الضريبة في total؛ ننقله إلى subtotal ونحسب الإجمالي شاملاً 15%.
UPDATE "PurchaseInvoice" SET "total" = ROUND("subtotal" * 1.15 * 1.15, 2), "subtotal" = ROUND("subtotal" * 1.15, 2) WHERE "subtotal" > 0;
