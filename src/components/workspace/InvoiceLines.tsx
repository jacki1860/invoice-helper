import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { InvoiceCalculation, InvoiceLineInput, PriceMode } from '../../domain/invoice';
import { formatMoney } from './Totals';

interface Props {
  lines: InvoiceLineInput[];
  calculation: InvoiceCalculation;
  priceMode: PriceMode;
  selectedLine: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<InvoiceLineInput>) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export function InvoiceLines({
  lines,
  calculation,
  priceMode,
  selectedLine,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}: Props) {
  return (
    <>
      <div className="line-table-wrap">
        <table className="line-table">
          <caption className="sr-only">發票品項，可以直接編輯每個欄位</caption>
          <colgroup>
            <col className="col-name" />
            <col className="col-quantity" />
            <col className="col-price" />
            <col className="col-amount" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>品名</th>
              <th>數量</th>
              <th>單價</th>
              <th>金額</th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const calculated = calculation.lines.find((item) => item.id === line.id);
              const errors = ['name', 'quantity', 'unitPrice']
                .map((field) => calculation.errors[`${line.id}.${field}`])
                .filter(Boolean);
              const showErrors = Boolean(line.name || line.unitPrice || line.quantity !== '1');
              return (
                <tr
                  key={line.id}
                  className={selectedLine === line.id ? 'is-selected' : ''}
                  onFocus={() => onSelect(line.id)}
                >
                  <td data-label="品名">
                    <input
                      id={`line-${line.id}`}
                      aria-label={`品名 ${index + 1}`}
                      placeholder="品名或服務內容"
                      maxLength={100}
                      value={line.name}
                      onChange={(event) => onChange(line.id, { name: event.target.value })}
                      aria-invalid={showErrors && Boolean(calculation.errors[`${line.id}.name`])}
                      aria-describedby={
                        showErrors && errors.length ? `line-error-${line.id}` : undefined
                      }
                    />
                    {showErrors && errors.length > 0 && (
                      <p className="line-error field-error" id={`line-error-${line.id}`}>
                        {errors.join(' ')}
                      </p>
                    )}
                  </td>
                  <td data-label="數量">
                    <input
                      aria-label={`數量 ${index + 1}`}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(event) => onChange(line.id, { quantity: event.target.value })}
                      aria-invalid={
                        showErrors && Boolean(calculation.errors[`${line.id}.quantity`])
                      }
                    />
                  </td>
                  <td data-label={`單價（${priceMode === 'total' ? '含稅' : '未稅'}）`}>
                    <input
                      aria-label={`單價 ${index + 1}`}
                      inputMode="decimal"
                      placeholder="0"
                      value={line.unitPrice}
                      onChange={(event) => onChange(line.id, { unitPrice: event.target.value })}
                      aria-invalid={
                        showErrors && Boolean(calculation.errors[`${line.id}.unitPrice`])
                      }
                    />
                  </td>
                  <td data-label="金額">
                    <output className="line-amount" aria-label={`金額 ${index + 1}`}>
                      {calculated ? formatMoney(calculated.inputAmount) : '—'}
                    </output>
                  </td>
                  <td className="line-actions">
                    <button
                      type="button"
                      className="icon-button edit-line"
                      aria-label={`編輯品項 ${index + 1}`}
                      onClick={() => document.getElementById(`line-${line.id}`)?.focus()}
                    >
                      <Pencil size={18} strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`刪除品項 ${index + 1}`}
                      onClick={() => onDelete(line.id)}
                    >
                      <Trash2 size={18} strokeWidth={1.6} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="button button-outline add-line" onClick={onAdd}>
        <Plus size={19} strokeWidth={1.6} />
        新增品項
      </button>
      {calculation.errors.total && (
        <p className="field-error" role="alert">
          {calculation.errors.total}
        </p>
      )}
    </>
  );
}
