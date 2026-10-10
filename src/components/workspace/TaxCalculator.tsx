import { useEffect, useRef, useState } from 'react';
import { Copy, ArrowDown, RotateCcw } from 'lucide-react';
import { calculateInvoice, type PriceMode, type TaxType } from '../../domain/invoice';
import { formatChineseAmountText } from '../../utils/numberUtils';
import { PricingControls, taxLabels } from './PricingControls';
import { formatMoney, Totals } from './Totals';

export function TaxCalculator() {
  const [amount, setAmount] = useState('');
  const [priceMode, setPriceMode] = useState<PriceMode>('total');
  const [taxType, setTaxType] = useState<TaxType>('regular');
  const [notice, setNotice] = useState('');
  const copyVersion = useRef(0);
  useEffect(
    () => () => {
      copyVersion.current += 1;
    },
    [],
  );

  function updateNotice(message = '') {
    copyVersion.current += 1;
    setNotice(message);
  }
  const result = calculateInvoice(
    [{ id: 'tax', name: '金額試算', quantity: '1', unitPrice: amount }],
    priceMode,
    taxType,
  );
  const error = amount ? result.errors['tax.unitPrice'] || result.errors.total : '';

  const copy = async () => {
    const version = ++copyVersion.current;
    setNotice('');
    try {
      await navigator.clipboard.writeText(
        `${taxLabels[taxType]}\n銷售額：${result.subtotal}\n稅額：${result.tax}\n總計：${result.amount}`,
      );
      if (copyVersion.current === version) setNotice('已複製試算結果。');
    } catch {
      if (copyVersion.current === version) setNotice('瀏覽器未允許複製，請允許剪貼簿存取後重試。');
    }
  };

  return (
    <div className="workspace secondary-workspace">
      <div className="editor-panel">
        <div className="workspace-heading">
          <div>
            <h1>稅額試算</h1>
            <p className="lead">含稅、未稅，一眼算明白。</p>
          </div>
        </div>
        <section className="editor-section">
          <div className="section-heading">
            <h2>
              <span>01</span>計算方式
            </h2>
          </div>
          <div className="calculator-controls">
            <PricingControls
              id="calculator"
              priceMode={priceMode}
              taxType={taxType}
              onModeChange={(mode) => {
                setPriceMode(mode);
                updateNotice();
              }}
              onTaxChange={(tax) => {
                setTaxType(tax);
                updateNotice();
              }}
            />
          </div>
          <label className="field calculator-input">
            <span>{priceMode === 'total' ? '含稅金額' : '未稅金額'}</span>
            <div>
              <span className="currency-prefix">NT$</span>
              <input
                aria-label={priceMode === 'total' ? '含稅金額' : '未稅金額'}
                inputMode="decimal"
                placeholder="0"
                value={amount}
                aria-invalid={Boolean(error)}
                aria-describedby="calculator-hint"
                onChange={(event) => {
                  setAmount(event.target.value);
                  updateNotice();
                }}
              />
            </div>
          </label>
          <p id="calculator-hint" className={error ? 'field-error' : 'field-hint'}>
            {error || '支援兩位小數，先將輸入取整元再計算。切換模式保留輸入數字，不會自動換算。'}
          </p>
          <div className="calculator-examples" role="group" aria-label="稅額試算範例">
            <button
              className="text-button calculator-example"
              onClick={() => {
                setAmount('1050');
                setPriceMode('total');
                setTaxType('regular');
                updateNotice('已帶入 1,050 元範例。');
              }}
            >
              <RotateCcw size={15} />
              試算 1,050 元範例
            </button>
            <button
              className="text-button calculator-example"
              onClick={() => {
                setAmount('1000');
                setPriceMode('subtotal');
                setTaxType('regular');
                updateNotice('已帶入未稅 1,000 元範例。');
              }}
            >
              <RotateCcw size={15} />
              試算未稅 1,000 元範例
            </button>
          </div>
        </section>
        <Totals {...result} invalid={!result.valid} />
        <button className="button button-primary" disabled={!result.valid} onClick={copy}>
          <Copy size={18} />
          複製結果
        </button>
        <p className="action-status" role="status">
          {notice}
        </p>
        <footer className="workspace-footer">
          <p>試算與發票助手共用計算方式，資料不會儲存。</p>
          <p>適用本工具的一般稅額試算，不包含申報或特殊稅務情境。</p>
        </footer>
      </div>
      <aside className="preview-stage calculator-stage">
        <h2 className="preview-heading">數字的來龍去脈</h2>
        <div className="calculation-paper">
          <p className="calculation-label">
            {priceMode === 'total' ? '從含稅金額拆解' : '從未稅金額計算'}
          </p>
          <div className="calculation-source">
            <span>NT$</span>
            {result.valid
              ? formatMoney(priceMode === 'total' ? result.amount : result.subtotal)
              : '—'}
          </div>
          <ArrowDown className="calculation-arrow" size={32} strokeWidth={1.2} />
          <div className="equation-row">
            <span>銷售額</span>
            <strong>{result.valid ? formatMoney(result.subtotal) : '—'}</strong>
          </div>
          <div className="equation-row">
            <span>
              ＋ 稅額 <small>{taxLabels[taxType]}</small>
            </span>
            <strong>{result.valid ? formatMoney(result.tax) : '—'}</strong>
          </div>
          <div className="equation-total">
            <span>總計</span>
            <strong>{result.valid ? formatMoney(result.amount) : '—'}</strong>
          </div>
          <p className="equation-chinese">
            {result.valid
              ? formatChineseAmountText(result.amount)
              : '填入金額，結果就會出現在這裡。'}
          </p>
          <div className="calculation-explanation">
            <p>
              {taxType !== 'regular'
                ? '零稅率與免稅在此試算中不加計稅額。'
                : priceMode === 'total'
                  ? '稅額＝含稅總額 × 5 ÷ 105，最後四捨五入。'
                  : '稅額＝未稅銷售額 × 5%，最後四捨五入。'}
            </p>
            <p>銷售額 ＋ 稅額 ＝ 總計</p>
            <p>先將輸入金額四捨五入至整元，再計算稅額並取整元；反向試算可能有取整差異。</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
