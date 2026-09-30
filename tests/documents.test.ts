import test from 'node:test';
import assert from 'node:assert/strict';
import {
  businessDocumentText,
  businessDocumentContactFields,
  documentResult,
  hasBusinessDocumentContent,
  type BusinessDocumentDraft,
} from '../src/features/tools/documents.ts';

const draft: BusinessDocumentDraft = {
  kind: 'quote',
  logo: null,
  issuer: '工作室',
  issuerNumber: '',
  issuerPhone: '',
  issuerEmail: '',
  customFields: [],
  customer: '客戶',
  customerNumber: '',
  number: 'Q1',
  date: '2026-09-30',
  dueDate: '2026-10-31',
  paymentDetails: '分期付款',
  notes: '',
  priceMode: 'total',
  taxType: 'regular',
  lines: [{ id: 'one', name: '服務', quantity: '1', unitPrice: '10' }],
};
test('business documents share gross-preserving calculation and safe output gating', () => {
  assert.equal(documentResult(draft).valid, true);
  const text = businessDocumentText(draft);
  assert.ok(text.includes('總計：10'));
  assert.ok(text.includes('報價有效期限：2026-10-31'));
  assert.ok(text.includes('本文件非統一發票。'));
  assert.ok(businessDocumentText({ ...draft, kind: 'payment' }).includes('付款期限：2026-10-31'));
  for (const patch of [
    { issuer: '' },
    { customer: '' },
    { date: '2026-02-29' },
    { dueDate: '2026-09-29' },
    { issuerNumber: '123' },
    { customerNumber: 'ABCDEFGH' },
    { lines: [] },
  ]) {
    const result = { ...draft, ...patch };
    assert.equal(documentResult(result).valid, false);
    assert.equal(businessDocumentText(result), '');
  }
});

test('loading a sample protects every field that can hold user work', () => {
  const blank: BusinessDocumentDraft = {
    kind: 'quote',
    logo: null,
    issuer: '',
    issuerNumber: '',
    issuerPhone: '',
    issuerEmail: '',
    customFields: [],
    customer: '',
    customerNumber: '',
    number: '',
    date: '2026-09-30',
    dueDate: '',
    paymentDetails: '',
    notes: '',
    priceMode: 'subtotal',
    taxType: 'regular',
    lines: [{ id: 'one', name: '', quantity: '1', unitPrice: '' }],
  };
  assert.equal(hasBusinessDocumentContent(blank, blank.date), false);
  assert.equal(hasBusinessDocumentContent({ ...blank, kind: 'payment' }, blank.date), false);
  for (const field of [
    'issuer',
    'issuerNumber',
    'issuerPhone',
    'issuerEmail',
    'customer',
    'customerNumber',
    'number',
    'dueDate',
    'paymentDetails',
    'notes',
    'date',
  ]) {
    assert.equal(
      hasBusinessDocumentContent({ ...blank, [field]: 'entered' }, blank.date),
      true,
      field,
    );
  }
  for (const patch of [
    { logo: { dataUrl: 'data:image/png;base64,test', name: 'logo.png', width: 100, height: 50 } },
    { customFields: [{ id: 'custom', label: '地址', value: '' }] },
    { customFields: [{ id: 'custom', label: '', value: '示範地址' }] },
    { priceMode: 'total' as const },
    { taxType: 'exempt' as const },
    { lines: [{ ...blank.lines[0], quantity: '2' }] },
    { lines: [{ ...blank.lines[0], name: 'x' }] },
    { lines: [{ ...blank.lines[0], unitPrice: '0' }] },
    { lines: [...blank.lines, { ...blank.lines[0], id: 'two' }] },
  ]) {
    assert.equal(hasBusinessDocumentContent({ ...blank, ...patch }, blank.date), true);
  }
});

test('optional contacts and custom fields appear in order in both document types', () => {
  for (const kind of ['quote', 'payment'] as const) {
    const withContacts = {
      ...draft,
      kind,
      issuerPhone: ' 02-1234-5678 分機 9 ',
      issuerEmail: ' hello@example.com ',
      customFields: [
        { id: 'address', label: ' 地址 ', value: '示範路 1 號\n2 樓' },
        { id: 'empty', label: ' ', value: '  ' },
        { id: 'reference', label: '專案代號', value: '<Demo & Co>' },
      ],
    };
    assert.equal(documentResult(withContacts).valid, true);
    assert.deepEqual(
      businessDocumentContactFields(withContacts).map(({ label, value }) => [label, value]),
      [
        ['電話', '02-1234-5678 分機 9'],
        ['信箱', 'hello@example.com'],
        ['地址', '示範路 1 號\n2 樓'],
        ['專案代號', '<Demo & Co>'],
      ],
    );
    assert.ok(
      businessDocumentText(withContacts).includes(
        '電話：02-1234-5678 分機 9\n信箱：hello@example.com\n地址：示範路 1 號\n2 樓\n專案代號：<Demo & Co>',
      ),
    );
    const removed = {
      ...withContacts,
      customFields: withContacts.customFields.filter(({ id }) => id !== 'address'),
    };
    assert.ok(!businessDocumentText(removed).includes('示範路'));
  }
});

test('blank optional fields are omitted but incomplete custom fields block output', () => {
  assert.deepEqual(businessDocumentContactFields(draft), []);
  const blank = { ...draft, customFields: [{ id: 'blank', label: ' ', value: '\n' }] };
  assert.equal(documentResult(blank).valid, true);
  assert.equal(businessDocumentText(blank), businessDocumentText(draft));
  for (const field of [
    { id: 'one', label: '地址', value: ' ' },
    { id: 'one', label: ' ', value: '示範路' },
  ]) {
    const incomplete = { ...draft, customFields: [field] };
    assert.equal(documentResult(incomplete).valid, false);
    assert.ok(documentResult(incomplete).errors.some((error) => error.includes('自訂欄位 1')));
    assert.equal(businessDocumentText(incomplete), '');
  }
});

test('logo does not leak image data or filenames into copied document text', () => {
  const withLogo = {
    ...draft,
    logo: {
      dataUrl: 'data:image/png;base64,test',
      name: 'private-file.png',
      width: 100,
      height: 50,
    },
  };
  assert.equal(businessDocumentText(withLogo), businessDocumentText(draft));
});
