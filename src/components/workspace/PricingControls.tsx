import type { PriceMode, TaxType } from '../../domain/invoice';

export const taxLabels: Record<TaxType, string> = {
  regular: '應稅 5%',
  'zero-rate': '零稅率',
  exempt: '免稅',
};

interface Props {
  id: string;
  priceMode: PriceMode;
  taxType: TaxType;
  onModeChange: (mode: PriceMode) => void;
  onTaxChange: (tax: TaxType) => void;
}

export function PricingControls({ id, priceMode, taxType, onModeChange, onTaxChange }: Props) {
  return (
    <div className="pricing-controls">
      <fieldset className="price-mode">
        <legend className="sr-only">金額輸入方式</legend>
        {(['subtotal', 'total'] as const).map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              name={`${id}-mode`}
              value={mode}
              checked={priceMode === mode}
              onChange={() => onModeChange(mode)}
            />
            <span>{mode === 'total' ? '含稅輸入' : '未稅輸入'}</span>
          </label>
        ))}
      </fieldset>
      <label className="tax-select">
        <span className="sr-only">課稅別</span>
        <select value={taxType} onChange={(event) => onTaxChange(event.target.value as TaxType)}>
          {Object.entries(taxLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
