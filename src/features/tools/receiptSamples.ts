import type { ReceiptDraft } from './tradeDocuments.ts';

export type ReceiptSampleId = 'general' | 'deposit' | 'balance' | 'service';

export const receiptSamples: {
  id: ReceiptSampleId;
  label: string;
  description: string;
}[] = [
  { id: 'general', label: '通用範例', description: '以道具製作尾款示範完整收據欄位。' },
  { id: 'deposit', label: '訂金', description: '記錄先收到的一部分款項，金額填這次實收。' },
  { id: 'balance', label: '尾款', description: '記錄本次尾款，另行核對先前款項與未收餘額。' },
  { id: 'service', label: '服務費', description: '記錄單次服務的實收費用與付款方式。' },
];

const sampleFields: Record<ReceiptSampleId, Omit<ReceiptDraft, 'date'>> = {
  general: {
    payer: '範例商行',
    payee: '小事務工作室',
    amount: '12600',
    purpose: '展場道具製作尾款',
    reference: 'RC-001',
    method: '銀行轉帳',
    notes: '此為示範內容，請依實際收款情形修改。',
  },
  deposit: {
    payer: '範例客戶',
    payee: '小事務工作室',
    amount: '6000',
    purpose: '設計專案訂金',
    reference: 'RC-DEPOSIT-001',
    method: '銀行轉帳',
    notes: '此為示範內容。本次僅記錄訂金實收，剩餘款項另行核對，請依實際收款情形修改。',
  },
  balance: {
    payer: '範例客戶',
    payee: '小事務工作室',
    amount: '14000',
    purpose: '設計專案尾款',
    reference: 'RC-BALANCE-001',
    method: '支票',
    notes: '此為示範內容。請核對本次尾款與先前收款紀錄；載入範本不代表已收齊款項。',
  },
  service: {
    payer: '範例商行',
    payee: '小事務工作室',
    amount: '3500',
    purpose: '單次設備維護服務費',
    reference: 'RC-SERVICE-001',
    method: '現金',
    notes: '此為示範內容。記錄單次服務實收費用，請依實際服務與收款情形修改。',
  },
};

export function createReceiptSample(id: ReceiptSampleId, date: string): ReceiptDraft {
  return { ...sampleFields[id], date };
}
