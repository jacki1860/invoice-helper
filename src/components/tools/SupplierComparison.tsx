import { useRef, useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import {
  compareSuppliers,
  comparisonText,
  comparisonPriceLabels,
  comparisonTaxLabels,
  supplierToPurchase,
  type ComparisonItem,
  type SupplierOffer,
} from '../../domain/supplierComparison';
import type { PurchaseSeed } from '../../features/tools/workflowHandoff';
import type { PriceMode, TaxType } from '../../domain/invoice';
import { getTaiwanDate } from '../../utils/dateUtils';
import {
  TradeActions,
  TradeErrors,
  TradeField,
  TradePreview,
  SampleButton,
} from './TradeDocuments';
import { SourceNote, ToolPage } from './ToolPage';
import './business-calculators.css';

const newItem = (): ComparisonItem => ({ id: crypto.randomUUID(), name: '', quantity: '1' });
const newSupplier = (): SupplierOffer => ({
  id: crypto.randomUUID(),
  name: '',
  contact: '',
  prices: {},
  priceMode: 'subtotal',
  taxType: 'regular',
  shipping: '0',
  deliveryDate: '',
  leadTime: '',
  warranty: '',
  paymentTerms: '',
});
const money = (value: number | null) =>
  value === null ? '—' : `NT$ ${value.toLocaleString('zh-TW')}`;
export function SupplierComparison({
  onCreatePurchase,
}: {
  onCreatePurchase?: (seed: PurchaseSeed) => void;
}) {
  const [items, setItems] = useState<ComparisonItem[]>(() => [newItem()]);
  const [offers, setOffers] = useState<SupplierOffer[]>(() => [newSupplier(), newSupplier()]);
  const [notice, setNotice] = useState('');
  const paper = useRef<HTMLDivElement>(null);
  const result = compareSuppliers(items, offers);
  const text = comparisonText(items, offers);
  const patchOffer = (id: string, update: Partial<SupplierOffer>) =>
    setOffers((current) =>
      current.map((offer) => (offer.id === id ? { ...offer, ...update } : offer)),
    );
  const sample = () => {
    if (!window.confirm('載入範例會取代共同品項與全部廠商報價。確定載入？')) return;
    const sampleItems = [
      { ...newItem(), name: '展示層板', quantity: '6' },
      { ...newItem(), name: '金屬支架', quantity: '12' },
    ];
    setItems(sampleItems);
    setOffers([
      {
        ...newSupplier(),
        name: '甲廠商',
        prices: { [sampleItems[0].id]: '1200.00', [sampleItems[1].id]: '180.00' },
        shipping: '500.00',
        leadTime: '確認後 14 個工作天',
        warranty: '1 年',
        paymentTerms: '訂金 30%，交貨後付尾款',
      },
      {
        ...newSupplier(),
        name: '乙廠商',
        priceMode: 'total',
        prices: { [sampleItems[0].id]: '1280.00', [sampleItems[1].id]: '190.00' },
        shipping: '0.00',
        leadTime: '確認後 10 個工作天',
        warranty: '6 個月',
        paymentTerms: '交貨時付款',
      },
    ]);
    setNotice('已載入範例；尚未選定任何廠商。');
  };
  const transfer = (id: string) => {
    const seed = supplierToPurchase(items, offers, id);
    if (!seed || !onCreatePurchase) return;
    if (
      !window.confirm(
        `確認選用「${seed.supplier}」並帶入採購單？商品會轉成含稅批次列（數量 1），原品名、原數量、原單價及稅別保留於名稱與備註；運費另列，總額維持一致。`,
      )
    )
      return;
    onCreatePurchase(seed);
  };
  return (
    <ToolPage title="多家報價比較" description="放在相同採購基準，連同交期與條件一起看。">
      <div className="document-workspace business-calculator-workspace">
        <section className="document-editor">
          <SampleButton onClick={sample} />
          <h2 className="numbered-title">
            <span>01</span>共同採購品項
          </h2>
          <p className="trade-hint">
            所有廠商使用相同品名與數量。最多 20 筆，數量須為 1 至 9,999 的整數。
          </p>
          {items.map((item, index) => (
            <div className="business-shared-item" key={item.id}>
              <TradeField
                label={`共同品名 ${index + 1}`}
                value={item.name}
                onChange={(name) =>
                  setItems((current) =>
                    current.map((entry) => (entry.id === item.id ? { ...entry, name } : entry)),
                  )
                }
              />
              <TradeField
                label={`共同數量 ${index + 1}`}
                value={item.quantity}
                type="amount"
                onChange={(quantity) =>
                  setItems((current) =>
                    current.map((entry) => (entry.id === item.id ? { ...entry, quantity } : entry)),
                  )
                }
              />
              <button
                className="icon-button"
                aria-label={`刪除共用品項 ${index + 1}`}
                disabled={items.length <= 1}
                onClick={() =>
                  setItems((current) => current.filter((entry) => entry.id !== item.id))
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button
            className="button button-outline"
            disabled={items.length >= 20}
            onClick={() => setItems((current) => [...current, newItem()])}
          >
            <Plus size={17} /> 新增共用品項
          </button>
          <h2 className="numbered-title">
            <span>02</span>廠商報價與條件
          </h2>
          <p className="trade-hint">
            比較 2 至 5
            家。各家可使用不同單價含稅方式；含稅運費會加進總支出，並沿用該廠商稅別。單價與運費最多 2
            位小數。
          </p>
          {offers.map((offer, index) => (
            <fieldset className="business-supplier-editor" key={offer.id}>
              <legend>廠商 {index + 1}</legend>
              <div className="tool-form-grid">
                <TradeField
                  label={`廠商名稱 ${index + 1}`}
                  value={offer.name}
                  onChange={(name) => patchOffer(offer.id, { name })}
                />
                <TradeField
                  label={`聯絡資訊 ${index + 1}`}
                  value={offer.contact}
                  onChange={(contact) => patchOffer(offer.id, { contact })}
                />
              </div>
              <div className="tool-form-grid">
                <label className="tool-field">
                  <span>廠商 {index + 1} 單價方式</span>
                  <select
                    value={offer.priceMode}
                    onChange={(event) =>
                      patchOffer(offer.id, { priceMode: event.target.value as PriceMode })
                    }
                  >
                    {Object.entries(comparisonPriceLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}單價
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tool-field">
                  <span>廠商 {index + 1} 稅別（含運費）</span>
                  <select
                    value={offer.taxType}
                    onChange={(event) =>
                      patchOffer(offer.id, { taxType: event.target.value as TaxType })
                    }
                  >
                    {Object.entries(comparisonTaxLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {items.map((item, itemIndex) => (
                <label className="tool-field" key={item.id}>
                  <span>
                    {offer.name || `廠商 ${index + 1}`} · {item.name || `品項 ${itemIndex + 1}`}{' '}
                    單價（{comparisonPriceLabels[offer.priceMode]}）
                  </span>
                  <input
                    inputMode="decimal"
                    value={offer.prices[item.id] ?? ''}
                    placeholder="0.00"
                    onChange={(event) =>
                      patchOffer(offer.id, {
                        prices: { ...offer.prices, [item.id]: event.target.value },
                      })
                    }
                  />
                </label>
              ))}
              <label className="tool-field">
                <span>廠商 {index + 1} 運費（含稅元）</span>
                <input
                  inputMode="decimal"
                  value={offer.shipping}
                  onChange={(event) => patchOffer(offer.id, { shipping: event.target.value })}
                />
                <small>免運填 0；不會再對此金額加稅。</small>
              </label>
              <div className="tool-form-grid">
                <TradeField
                  label={`預計交貨日期 ${index + 1}（選填）`}
                  type="date"
                  value={offer.deliveryDate}
                  onChange={(deliveryDate) => patchOffer(offer.id, { deliveryDate })}
                />
                <TradeField
                  label={`交期說明 ${index + 1}`}
                  value={offer.leadTime}
                  onChange={(leadTime) => patchOffer(offer.id, { leadTime })}
                />
                <TradeField
                  label={`保固 ${index + 1}`}
                  value={offer.warranty}
                  onChange={(warranty) => patchOffer(offer.id, { warranty })}
                />
                <TradeField
                  label={`付款條件 ${index + 1}`}
                  value={offer.paymentTerms}
                  onChange={(paymentTerms) => patchOffer(offer.id, { paymentTerms })}
                />
              </div>
              <TradeErrors
                show={Boolean(offer.name || Object.values(offer.prices).some(Boolean))}
                errors={result.suppliers[index].errors}
              />
              <div className="business-row-end">
                <span className="field-hint">未提供的條件會明確標示。</span>
                <button
                  className="text-button"
                  disabled={offers.length <= 2}
                  onClick={() =>
                    setOffers((current) => current.filter((entry) => entry.id !== offer.id))
                  }
                >
                  <Trash2 size={16} /> 移除廠商 {index + 1}
                </button>
              </div>
            </fieldset>
          ))}
          <button
            className="button button-outline"
            disabled={offers.length >= 5}
            onClick={() => setOffers((current) => [...current, newSupplier()])}
          >
            <Plus size={17} /> 新增廠商
          </button>
          <TradeErrors show errors={result.errors} />
          <p className="calculation-note">
            以含稅總支出比較，未扣除可能可扣抵的進項稅額。商品依既有發票規則先逐列取整、整張計稅，再加上取整的含稅運費。合併預覽的未稅額與稅額按整張總額拆分。最低金額不是選商建議，請一併確認規格與條件。
          </p>
          {onCreatePurchase && (
            <section className="business-next-step">
              <h3>確認條件後，選定廠商</h3>
              <p>
                帶入採購時，商品以含稅批次金額列入（數量
                1）；原數量保留在名稱，原單價與含稅方式寫入備註。運費會完整另列，含稅總額與比較結果一致。
              </p>
              <div className="business-supplier-choices">
                {offers.map((offer, index) => (
                  <button
                    key={offer.id}
                    className="button button-outline"
                    disabled={!result.suppliers[index].valid}
                    onClick={() => transfer(offer.id)}
                  >
                    選用{offer.name ? `「${offer.name}」` : `廠商 ${index + 1}`}並建立採購單{' '}
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <p className="action-status" role="status">
            {notice}
          </p>
          <TradeActions
            paper={paper}
            title="多家報價比較"
            date={getTaiwanDate()}
            text={text}
            valid={result.valid}
          />
          <SourceNote
            checkedOn="2026-09-30"
            sources={[
              {
                label: '財政部：營業稅申報與取整規則',
                url: 'https://law-out.mof.gov.tw/LawContent.aspx?id=GL009478&media=print',
              },
            ]}
          />
        </section>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target business-calculator-paper"
            aria-label="多家報價比較結果"
          >
            <header>
              <p className="trade-paper-kicker">相同品項 · 含稅總支出 · 新臺幣</p>
              <h2>多家報價比較</h2>
              <p>最低金額只供參考；請自行確認交易條件。</p>
            </header>
            <ul className="business-shared-summary">
              {items.map((item, index) => (
                <li key={item.id}>
                  {item.name || `品項 ${index + 1} 待填`} × {item.quantity || '—'}
                </li>
              ))}
            </ul>
            {offers.map((offer, index) => {
              const row = result.suppliers[index];
              return (
                <section className="business-supplier-result" key={offer.id}>
                  <h3>{offer.name || `廠商 ${index + 1}`}</h3>
                  <p className="business-supplier-tax">
                    {comparisonPriceLabels[offer.priceMode]}單價 ·{' '}
                    {comparisonTaxLabels[offer.taxType]}
                  </p>
                  {row.valid ? (
                    <>
                      <table className="business-line-table business-offer-table">
                        <thead>
                          <tr>
                            <th>品項</th>
                            <th>原單價（{comparisonPriceLabels[offer.priceMode]}）</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td>
                                NT${' '}
                                {Number(offer.prices[item.id]).toLocaleString('zh-TW', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <dl className="business-calculation-totals">
                        <div>
                          <dt>商品含稅合計</dt>
                          <dd>{money(row.productsGross)}</dd>
                        </div>
                        <div>
                          <dt>含稅運費</dt>
                          <dd>{money(row.shippingGross)}</dd>
                        </div>
                        <div>
                          <dt>合計未稅／稅額</dt>
                          <dd>
                            {money(row.calculation!.subtotal)} ／ {money(row.calculation!.tax)}
                          </dd>
                        </div>
                        <div className="business-grand-total">
                          <dt>含稅總支出</dt>
                          <dd>{money(row.calculation!.amount)}</dd>
                        </div>
                        <div>
                          <dt>與最低有效報價差額</dt>
                          <dd>
                            {row.difference === 0
                              ? '最低金額（可能同額）'
                              : `+ ${money(row.difference)}`}
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p className="business-invalid-result">
                      資料未完整或有誤，不列入最低金額比較。
                    </p>
                  )}
                  <dl className="business-supplier-terms">
                    <div>
                      <dt>預計交貨</dt>
                      <dd>{offer.deliveryDate || '未提供'}</dd>
                    </div>
                    <div>
                      <dt>交期</dt>
                      <dd>{offer.leadTime || '未提供'}</dd>
                    </div>
                    <div>
                      <dt>保固</dt>
                      <dd>{offer.warranty || '未提供'}</dd>
                    </div>
                    <div>
                      <dt>付款條件</dt>
                      <dd>{offer.paymentTerms || '未提供'}</dd>
                    </div>
                  </dl>
                </section>
              );
            })}
            <footer>
              以輸入的報價與條件比較，不自動選商。含稅運費已列入；規格、品質與可否扣抵稅額仍須自行確認。
            </footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}
