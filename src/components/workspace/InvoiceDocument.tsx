import type { InvoiceCalculation, TaxType } from '../../domain/invoice';
import type { InvoiceDraft } from '../../features/invoice/draft';
import { formatTaiwanDate } from '../../utils/dateUtils';
import { formatChineseAmountText } from '../../utils/numberUtils';
import { formatMoney } from './Totals';

interface Props {
  draft: InvoiceDraft;
  calculation: InvoiceCalculation;
  selectedLine?: string | null;
}

const taxRowLabels: Record<TaxType, string> = {
  regular: '營業稅（5%）',
  'zero-rate': '營業稅（零稅率）',
  exempt: '營業稅（免稅）',
};

export function InvoiceDocument({ draft, calculation, selectedLine }: Props) {
  const emptyRows = Math.max(0, 4 - calculation.lines.length);
  const date = formatTaiwanDate(draft.date)
    .map((part) => part.text)
    .join('');
  const digits = Array.from({ length: 8 }, (_, index) => draft.uniformNumber[index] || '');
  return (
    <div className="invoice-paper" aria-label="發票預覽文件">
      <span className="preview-ribbon" aria-hidden="true">
        PREVIEW
      </span>
      <h2 className="document-title">
        統一發票<span>（三聯式）</span>
      </h2>
      <p className="document-date">{date || '請填寫有效日期'}</p>
      <div className="document-meta">
        <div className="document-buyer">
          <div>
            <span>買受人：</span>
            <strong>{draft.buyer || '\u00a0'}</strong>
          </div>
          <div className="document-uniform">
            <span>統一編號：</span>
            <span className="uniform-digits">
              {digits.map((digit, index) => (
                <b key={index}>{digit}</b>
              ))}
            </span>
          </div>
          <div>
            <span>地址：</span>
            <span className="blank-rule" />
          </div>
        </div>
        <div className="document-extra">
          <div>
            <span>發票號碼：</span>
            <span className="dotted-rule" />
          </div>
          <div>
            <span>開立人：</span>
            <span className="dotted-rule" />
          </div>
          <div>
            <span>買受人註記：</span>
            <span className="blank-rule" />
          </div>
        </div>
      </div>
      <table className="document-table">
        <colgroup>
          <col className="document-col-name" />
          <col className="document-col-quantity" />
          <col className="document-col-price" />
          <col className="document-col-amount" />
          <col className="document-col-note" />
        </colgroup>
        <thead>
          <tr>
            <th>品名</th>
            <th>數量</th>
            <th>
              單價<span>（未稅）</span>
            </th>
            <th>
              金額<span>（未稅）</span>
            </th>
            <th>備註</th>
          </tr>
        </thead>
        <tbody>
          {calculation.lines.map((line) => (
            <tr
              key={line.id}
              className={line.id === selectedLine ? 'document-line is-selected' : 'document-line'}
            >
              <td>{line.name || '品名待填'}</td>
              <td>{line.quantity}</td>
              <td>{line.unitPriceExcl.toLocaleString('zh-TW', { maximumFractionDigits: 4 })}</td>
              <td>{formatMoney(line.subtotal)}</td>
              <td />
            </tr>
          ))}
          {Array.from({ length: emptyRows }, (_, index) => (
            <tr className="empty-document-line" key={`empty-${index}`} aria-hidden="true">
              <td>&nbsp;</td>
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
          <tr className="document-summary">
            <th colSpan={3} scope="row">
              銷售額合計
            </th>
            <td colSpan={2}>{calculation.valid ? formatMoney(calculation.subtotal) : '—'}</td>
          </tr>
          <tr className="document-summary">
            <th colSpan={3} scope="row">
              {taxRowLabels[draft.taxType]}
            </th>
            <td colSpan={2}>{calculation.valid ? formatMoney(calculation.tax) : '—'}</td>
          </tr>
          <tr className="document-summary">
            <th colSpan={3} scope="row">
              總計
            </th>
            <td colSpan={2}>{calculation.valid ? formatMoney(calculation.amount) : '—'}</td>
          </tr>
          <tr className="chinese-amount">
            <td colSpan={5}>
              <span>總計新臺幣（大寫）</span>
              <strong>
                {calculation.valid ? formatChineseAmountText(calculation.amount) : '金額待填'}
              </strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="document-footnote">填寫參考・非電子發票</p>
    </div>
  );
}
