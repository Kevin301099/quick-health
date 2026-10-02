import type { CaseMeta, Corridor } from './types';

/* Client messages are drafted in English and Arabic. Agencies in the UAE write to clients in both. */

export const AGENCY = { en: 'Gulf Horizon Travel', ar: 'خليج هورايزن للسفر' };

const PERMIT_AR: Record<Corridor['id'], string> = {
  'uk-eta': 'تصريح السفر الإلكتروني للمملكة المتحدة',
  'ca-eta': 'تصريح السفر الإلكتروني لكندا',
  'us-b1b2': 'تأشيرة زيارة الولايات المتحدة',
  etias: 'تصريح السفر الأوروبي ETIAS',
};

const OWN_STEPS_AR: Record<Corridor['id'], string> = {
  'uk-eta': 'الصورة الذاتية والإقرارات',
  'ca-eta': 'الأسئلة والدفع',
  'us-b1b2': 'الأسئلة الأمنية والتوقيع',
  etias: 'الأسئلة الأمنية',
};

export function travellersAr(n: number) {
  if (n === 1) return 'مسافر واحد';
  if (n === 2) return 'مسافران';
  if (n <= 10) return `${n} مسافرين`;
  return `${n} مسافراً`;
}

function firstName(full: string) {
  return full.replace(/^(Mr|Mrs|Ms)\.?\s+/i, '').split(' ')[0];
}

const arName = (meta: CaseMeta) => meta.client.ar ?? firstName(meta.client.name);

export function applicantMessage(meta: CaseMeta, corridor: Corridor, n: number) {
  const name = firstName(meta.client.name);
  const link = `rihla.example/c/${meta.id}`;
  const own = corridor.applicantOnly.title.toLowerCase();
  const en = `Hello ${name}, this is ${AGENCY.en}. Everything for ${n} traveller${n === 1 ? '' : 's'} is prepared for the ${corridor.short}. Please open the secure link to complete the part that only you can do (${own}). It takes about 5 minutes. ${link}`;
  const ar = `مرحباً ${arName(meta)}، معكم ${AGENCY.ar}. جهّزنا كل ما يخص ${travellersAr(n)} لـ${PERMIT_AR[corridor.id]}. يرجى فتح الرابط الآمن لإكمال الخطوات التي تخصكم فقط (${OWN_STEPS_AR[corridor.id]}). يستغرق ذلك نحو 5 دقائق. ${link}`;
  return { en, ar };
}

export function decisionMessage(meta: CaseMeta, corridor: Corridor, n: number, note?: string) {
  const name = firstName(meta.client.name);
  if (corridor.id === 'us-b1b2') {
    return {
      en: `Hello ${name}, your DS-160 is signed and your interview file is ready. Official visa appointments in the UAE are not available right now. We will message you the moment they reopen so you can book straight away.`,
      ar: `مرحباً ${arName(meta)}، تم توقيع نموذج DS-160 وملف المقابلة جاهز. مواعيد التأشيرة الرسمية في الإمارات غير متاحة حالياً. سنراسلكم فور إعادة فتحها لتتمكنوا من الحجز مباشرة.`,
    };
  }
  if (corridor.id === 'etias') {
    return {
      en: `Hello ${name}, your ETIAS profile is ready. The official portal has not opened yet. We are watching it and will message you the day it does, so you can confirm in minutes.`,
      ar: `مرحباً ${arName(meta)}، ملف ETIAS جاهز. لم تُفتح البوابة الرسمية بعد. نتابعها وسنراسلكم في اليوم الذي تُفتح فيه لتؤكدوا الطلب خلال دقائق.`,
    };
  }
  return {
    en: `Good news ${name}: the ${corridor.short} is approved for ${n} traveller${n === 1 ? '' : 's'}. It is linked to each passport, so there is nothing to print. ${note ? `${note} ` : ''}Have a great trip.`,
    ar: `أخبار سارة ${arName(meta)}: تمت الموافقة على ${PERMIT_AR[corridor.id]} لـ${travellersAr(n)}. التصريح مرتبط بجواز السفر ولا حاجة لطباعته. ${note ? 'يرجى ملاحظة أن صلاحية أحد التصاريح مرتبطة بانتهاء جواز السفر. ' : ''}رحلة سعيدة.`,
  };
}

export function missingDocsMessage(meta: CaseMeta, items: string[]) {
  const name = firstName(meta.client.name);
  return {
    en: `Hello ${name}, one more thing for your file: ${items.join(', ')}. A photo from your phone is fine. Reply here and we will take it from there.`,
    ar: `مرحباً ${arName(meta)}، نحتاج إلى أمر إضافي لملفكم: ${items.join('، ')}. يكفي إرسال صورة من الهاتف هنا وسنكمل نحن.`,
  };
}
