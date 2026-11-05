'use client';

import { Boxes, ClipboardCheck, FileText, MessageCircle, PackageCheck, Phone, ShoppingCart, BarChart3, ShieldCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import { Button, Card, PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

/** رقم الدعم والاستفسار (بصيغة دولية للواتساب: 966 بدل الصفر الأول) */
const SUPPORT_LOCAL = '0531847156';
const SUPPORT_INTL = '966531847156';

type Feature = { icon: ComponentType<{ className?: string }>; title: string; text: string };

const CONTENT = {
  ar: {
    title: 'من نحن',
    subtitle: 'فكرة المشروع وكيف نخدمك',
    idea: 'الفكرة',
    ideaText:
      'شركات كبيرة بإدارات وفروع كثيرة تحتاج مكاناً واحداً ينظّم شراء وصرف الأجهزة الإلكترونية والطابعات والأدوات المكتبية والمطبوعات. المستودع المركزي يجعل كل احتياج طلباً موثّقاً يمرّ بمدير الإدارة ثم أمين المستودع، فيصبح الصرف منظماً والمخزون معروفاً والمشتريات مبنية على أرقام حقيقية.',
    featuresTitle: 'ماذا يقدّم النظام',
    features: [
      { icon: ClipboardCheck, title: 'دورة اعتماد واضحة', text: 'كل طلب له سجل بمن فعل ماذا ومتى.' },
      { icon: PackageCheck, title: 'مخزون بنظام FIFO', text: 'الدفعات تُصرف بترتيب وصولها وبتكلفتها الفعلية.' },
      { icon: FileText, title: 'فواتير رسمية برمز QR', text: 'إدخال الفاتورة بضريبة القيمة المضافة وطباعتها بصيغة رسمية.' },
      { icon: ShoppingCart, title: 'طلبات شراء تلقائية', text: 'حدّ أدنى لكل صنف يُنشئ طلب الشراء دون متابعة يدوية.' },
      { icon: BarChart3, title: 'تقارير تحليلية', text: 'الأكثر طلباً، واعتماد الإدارات، ومشتريات الفروع.' },
      { icon: ShieldCheck, title: 'صلاحيات حسب الدور', text: 'كل مستخدم يرى ويفعل ما يخصّه فقط.' },
    ] as Feature[],
    supportTitle: 'الدعم والاستفسار',
    supportText: 'لأي سؤال أو ملاحظة أو مشكلة في الاستخدام، تواصل معنا مباشرة.',
    call: 'اتصال',
    whatsapp: 'واتساب',
    phoneLabel: 'رقم الدعم',
  },
  en: {
    title: 'About us',
    subtitle: 'The idea behind the project and how we help',
    idea: 'The idea',
    ideaText:
      'Large companies with many departments and branches need one place to organise buying and issuing electronics, printers, office supplies and printed materials. Central Warehouse turns every need into a documented request that goes through the department manager and then the warehouse keeper, so issuing is orderly, stock is known and purchasing is based on real numbers.',
    featuresTitle: 'What the system offers',
    features: [
      { icon: ClipboardCheck, title: 'Clear approval flow', text: 'Every request keeps a history of who did what and when.' },
      { icon: PackageCheck, title: 'FIFO stock', text: 'Batches are issued in arrival order at their actual cost.' },
      { icon: FileText, title: 'Official invoices with QR', text: 'Enter invoices with VAT and print them in an official layout.' },
      { icon: ShoppingCart, title: 'Automatic purchase requests', text: 'A minimum level per item creates purchase requests for you.' },
      { icon: BarChart3, title: 'Analytical reports', text: 'Most requested, department approvals, branch purchases.' },
      { icon: ShieldCheck, title: 'Role-based access', text: 'Each user sees and does only what concerns them.' },
    ] as Feature[],
    supportTitle: 'Support and enquiries',
    supportText: 'For any question, feedback or usage problem, contact us directly.',
    call: 'Call',
    whatsapp: 'WhatsApp',
    phoneLabel: 'Support number',
  },
} as const;

export default function AboutPage() {
  const { lang } = useI18n();
  const c = CONTENT[lang];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={c.title} subtitle={c.subtitle} />

      <Card className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-plum text-white shadow-[0_6px_18px_-6px_rgb(10_132_255/0.8)]" aria-hidden>
            <Boxes className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">{c.idea}</h2>
            <p className="mt-2 max-w-[68ch] leading-8 text-fg/85">{c.ideaText}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="mb-5 text-xl font-semibold">{c.featuresTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.features.map((f) => (
            <li key={f.title} className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-white/10">
              <span className="grid size-9 place-items-center rounded-full bg-accent/20 text-accent-soft" aria-hidden><f.icon className="size-[18px]" /></span>
              <p className="mt-3 font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{c.supportTitle}</h2>
        <p className="mt-2 text-fg/85">{c.supportText}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-muted">{c.phoneLabel}</p>
            <p className="text-2xl font-bold tabular-nums tracking-wide" dir="ltr">{SUPPORT_LOCAL}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:ms-auto">
            <Button asChild size="lg"><a href={`tel:${SUPPORT_LOCAL}`}><Phone className="size-4" /> {c.call}</a></Button>
            <Button asChild size="lg" variant="success">
              <a href={`https://wa.me/${SUPPORT_INTL}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> {c.whatsapp}</a>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
