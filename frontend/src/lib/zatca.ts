/**
 * رمز QR بصيغة TLV المعتمدة في الفاتورة الإلكترونية السعودية (هيئة الزكاة والضريبة والجمارك):
 * 1 اسم البائع، 2 الرقم الضريبي، 3 وقت الفاتورة (ISO 8601)، 4 الإجمالي شاملاً الضريبة، 5 مبلغ الضريبة.
 * القيمة النهائية Base64 لسلسلة البايتات.
 */
export function zatcaTlv(fields: { seller: string; vatNumber: string; timestamp: string; total: number; vat: number }): string {
  const enc = new TextEncoder();
  const parts = [fields.seller, fields.vatNumber, fields.timestamp, fields.total.toFixed(2), fields.vat.toFixed(2)].map((v, i) => {
    const bytes = enc.encode(v);
    if (bytes.length > 255) throw new RangeError(`قيمة الحقل ${i + 1} أطول من 255 بايت`);
    return [i + 1, bytes.length, ...bytes];
  });
  const all = Uint8Array.from(parts.flat());
  let bin = '';
  all.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
