import { calculateInvoice } from '../../domain/invoice.ts';
import { isValidInvoiceDate } from '../../utils/dateUtils.ts';
import type { AcceptanceSeed, QuoteSeed } from './workflowHandoff.ts';

export type AcceptanceStatus = 'pending' | 'accepted' | 'needs-fix';

export interface AcceptanceLine {
  id: string;
  name: string;
  quantity: string;
  status: AcceptanceStatus;
  improvement: string;
}

export interface AcceptanceDraft {
  issuer: string;
  customer: string;
  title: string;
  reference: string;
  date: string;
  deliveryDate: string;
  notes: string;
  lines: AcceptanceLine[];
  pricing?: AcceptanceSeed['pricing'];
}

export const acceptanceStatusLabels: Record<AcceptanceStatus, string> = {
  pending: '待驗收',
  accepted: '通過',
  'needs-fix': '待改善',
};

export function newAcceptanceLine(): AcceptanceLine {
  return { id: crypto.randomUUID(), name: '', quantity: '1', status: 'pending', improvement: '' };
}

export function emptyAcceptance(): AcceptanceDraft {
  return {
    issuer: '',
    customer: '',
    title: '',
    reference: '',
    date: '',
    deliveryDate: '',
    notes: '',
    lines: [newAcceptanceLine()],
  };
}

export function acceptanceFromSeed(seed: AcceptanceSeed): AcceptanceDraft {
  return {
    ...emptyAcceptance(),
    issuer: seed.issuer,
    customer: seed.customer,
    reference: seed.reference,
    // Delivery or quotation data is not evidence that acceptance took place.
    lines: seed.lines.map((line) => ({
      ...newAcceptanceLine(),
      name: line.name,
      quantity: line.quantity,
    })),
    pricing: seed.pricing
      ? { ...seed.pricing, lines: seed.pricing.lines.map((line) => ({ ...line })) }
      : undefined,
  };
}

export function hasAcceptanceContent(draft: AcceptanceDraft): boolean {
  return (
    [
      draft.issuer,
      draft.customer,
      draft.title,
      draft.reference,
      draft.date,
      draft.deliveryDate,
      draft.notes,
    ].some(Boolean) ||
    Boolean(draft.pricing) ||
    draft.lines.length !== 1 ||
    draft.lines.some(
      (line) => line.name || line.quantity !== '1' || line.status !== 'pending' || line.improvement,
    )
  );
}

export function acceptanceSummary(lines: AcceptanceLine[]) {
  const accepted = lines.filter((line) => line.status === 'accepted').length;
  const needsFix = lines.filter((line) => line.status === 'needs-fix').length;
  const pending = lines.length - accepted - needsFix;
  const status: AcceptanceStatus = needsFix
    ? 'needs-fix'
    : lines.length > 0 && accepted === lines.length
      ? 'accepted'
      : 'pending';
  return {
    accepted,
    needsFix,
    pending,
    status,
    label: status === 'accepted' ? '全部通過' : acceptanceStatusLabels[status],
  };
}

export function acceptanceResult(draft: AcceptanceDraft) {
  const errors: string[] = [];
  if (!draft.issuer.trim()) errors.push('請填寫交付方。');
  if (!draft.customer.trim()) errors.push('請填寫驗收方。');
  if (!isValidInvoiceDate(draft.date)) errors.push('請填寫有效的驗收日期。');
  if (
    draft.deliveryDate &&
    (!isValidInvoiceDate(draft.deliveryDate) || draft.deliveryDate > draft.date)
  )
    errors.push('交付日期須為有效日期，且不得晚於驗收日期。');
  const lineCheck = calculateInvoice(
    draft.lines.map((line) => ({ ...line, unitPrice: '0' })),
    'subtotal',
    'exempt',
  );
  if (!draft.lines.length) errors.push('請至少新增一個驗收項目。');
  const lineErrors: Record<string, string[]> = {};
  draft.lines.forEach((line, index) => {
    const messages: string[] = [];
    for (const field of ['name', 'quantity']) {
      const message = lineCheck.errors[`${line.id}.${field}`];
      if (message) messages.push(message);
    }
    if (!Object.prototype.hasOwnProperty.call(acceptanceStatusLabels, line.status))
      messages.push('請選擇有效的驗收結果');
    if (line.status === 'needs-fix' && !line.improvement.trim())
      messages.push('待改善項目請填寫檢查／改善說明');
    if (messages.length) {
      lineErrors[line.id] = messages;
      errors.push(`項目 ${index + 1}：${messages.join('；')}。`);
    }
  });
  const summary = acceptanceSummary(draft.lines);
  const valid = lineCheck.valid && errors.length === 0;
  const sourceCalculation = draft.pricing
    ? calculateInvoice(draft.pricing.lines, draft.pricing.priceMode, draft.pricing.taxType)
    : null;
  const pricingMatches = Boolean(
    sourceCalculation?.valid &&
    lineCheck.valid &&
    sourceCalculation.lines.length === lineCheck.lines.length &&
    sourceCalculation.lines.every(
      (line, index) =>
        line.name.trim() === lineCheck.lines[index].name.trim() &&
        line.quantity === lineCheck.lines[index].quantity,
    ),
  );
  const canCreatePayment = valid && summary.status === 'accepted' && pricingMatches;
  return {
    errors,
    lineErrors,
    valid,
    summary,
    pricingMatches,
    sourceCalculation,
    canCreatePayment,
  };
}

export function acceptanceText(draft: AcceptanceDraft): string {
  const result = acceptanceResult(draft);
  if (!result.valid) return '';
  return [
    '驗收／結案確認單',
    draft.title ? `專案／交付名稱：${draft.title}` : '',
    draft.reference ? `對應文件編號：${draft.reference}` : '',
    `交付方：${draft.issuer}`,
    `驗收方：${draft.customer}`,
    `驗收日期：${draft.date}`,
    draft.deliveryDate ? `交付日期：${draft.deliveryDate}` : '',
    `整體結果：${result.summary.label}`,
    `通過 ${result.summary.accepted} 項；待驗收 ${result.summary.pending} 項；待改善 ${result.summary.needsFix} 項`,
    '品項\t數量\t驗收結果\t檢查／改善說明',
    ...draft.lines.map(
      (line) =>
        `${line.name}\t${Number(line.quantity)}\t${acceptanceStatusLabels[line.status]}\t${line.improvement || '—'}`,
    ),
    draft.notes ? `備註：${draft.notes}` : '',
    '交付方確認：________________',
    '驗收方確認：________________',
    '本單記錄逐項檢查結果，確認與簽章由雙方完成；非統一發票，不表示款項已收。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function acceptanceToPayment(draft: AcceptanceDraft): QuoteSeed | null {
  if (!acceptanceResult(draft).canCreatePayment || !draft.pricing) return null;
  return {
    kind: 'payment',
    issuer: draft.issuer,
    customer: draft.customer,
    // A source reference is not a new bill number. The receiving tool asks for it.
    reference: '',
    priceMode: draft.pricing.priceMode,
    taxType: draft.pricing.taxType,
    lines: draft.pricing.lines.map((line) => ({ ...line })),
    notes: [
      draft.title ? `對應交付：${draft.title}` : '',
      draft.reference ? `驗收對應文件：${draft.reference}` : '',
      `驗收日期：${draft.date}；逐項結果：全部通過。`,
      '請核對本次請款金額與付款條件；本次帶入不表示款項已收。',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
