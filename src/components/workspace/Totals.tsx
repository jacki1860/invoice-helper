interface Props {
  subtotal: number;
  tax: number;
  amount: number;
  invalid?: boolean;
}

export const formatMoney = (amount: number) =>
  amount.toLocaleString('zh-TW', { maximumFractionDigits: 0 });

export function Totals({ subtotal, tax, amount, invalid = false }: Props) {
  return (
    <dl
      className={`totals${amount >= 1_000_000 ? ' has-large-amount' : ''}`}
      aria-label="計算結果"
      aria-live="polite"
      aria-atomic="true"
    >
      <div>
        <dt>銷售額</dt>
        <dd>{invalid ? '—' : formatMoney(subtotal)}</dd>
      </div>
      <div>
        <dt>稅額</dt>
        <dd>{invalid ? '—' : formatMoney(tax)}</dd>
      </div>
      <div className="grand-total">
        <dt>總計</dt>
        <dd>
          <span>NT$ </span>
          {invalid ? '—' : formatMoney(amount)}
        </dd>
      </div>
    </dl>
  );
}
