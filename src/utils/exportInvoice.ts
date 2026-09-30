import type { InvoiceCalculation } from '../domain/invoice';
import type { InvoiceDraft } from '../features/invoice/draft';

export function invoiceText(draft: InvoiceDraft, calculation: InvoiceCalculation): string {
  const lines = calculation.lines.map(
    (line) => `${line.name}\t${line.quantity}\t${line.unitPrice}\t${line.inputAmount}`,
  );
  const mode = draft.priceMode === 'total' ? '含稅' : '未稅';
  return [
    '發票填寫明細（參考）',
    `日期：${draft.date}`,
    `買受人：${draft.buyer || '未填寫'}`,
    `統一編號：${draft.uniformNumber || '未填寫'}`,
    `品名\t數量\t單價（${mode}）\t金額（${mode}）`,
    ...lines,
    `銷售額：${calculation.subtotal}`,
    `稅額：${calculation.tax}`,
    `總計：${calculation.amount}`,
  ].join('\n');
}

export async function downloadInvoice(element: HTMLElement, filename: string): Promise<void> {
  // Freeze the clicked document before any await, independently of the active tool.
  const snapshot = document.createElement('div');
  snapshot.className = 'export-surface';
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.append(element.cloneNode(true));
  document.body.append(snapshot);
  try {
    await document.fonts.ready;
    await Promise.all(Array.from(snapshot.querySelectorAll('img'), (image) => image.decode()));
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(snapshot, {
      scale: 2,
      backgroundColor: '#fffdf9',
      useCORS: true,
      logging: false,
      windowWidth: 1505,
      onclone: (clone) => {
        clone
          .querySelectorAll('.document-line.is-selected')
          .forEach((line) => line.classList.remove('is-selected'));
      },
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Image generation failed'))),
        'image/png',
      ),
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    snapshot.remove();
  }
}
