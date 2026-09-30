import { useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { insuranceData } from '../../data/insurance';
import {
  findInsuranceBracket,
  getHealthBrackets,
  getLaborBrackets,
  laborIdentities,
  laborIdentityNotes,
  parseInsuranceSalary,
} from '../../domain/insurance';
import type { InsuranceBracket, InsuranceKind, LaborIdentity } from '../../domain/insurance';
import { SourceNote, ToolPage } from './ToolPage';
import './insurance.css';

const money = new Intl.NumberFormat('zh-TW');
const healthBrackets = getHealthBrackets(insuranceData.health.rows);
const laborTables = Object.fromEntries(
  laborIdentities.map((identity) => [
    identity,
    getLaborBrackets(insuranceData.labor.rows, identity),
  ]),
) as Record<LaborIdentity, InsuranceBracket[]>;

function rangeLabel(row: InsuranceBracket) {
  if (row.lowerInclusive === null) return `${money.format(row.upperInclusive!)} 元以下`;
  if (row.upperInclusive === null) return `${money.format(row.lowerInclusive)} 元以上`;
  return `${money.format(row.lowerInclusive)}～${money.format(row.upperInclusive)} 元`;
}

export default function InsuranceLookup() {
  const [kind, setKind] = useState<InsuranceKind>('labor');
  const [identity, setIdentity] = useState<LaborIdentity>('一般勞工');
  const [salaryInput, setSalaryInput] = useState('');
  const [queriedSalary, setQueriedSalary] = useState<number | null>(null);
  const [error, setError] = useState('');
  const laborTab = useRef<HTMLButtonElement>(null);
  const healthTab = useRef<HTMLButtonElement>(null);
  const table = kind === 'labor' ? laborTables[identity] : healthBrackets;
  const source = insuranceData[kind];
  const result = queriedSalary === null ? null : findInsuranceBracket(table, queriedSalary);
  const amountLabel = kind === 'labor' ? '月投保薪資' : '月投保金額';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salary = parseInsuranceSalary(salaryInput);
    setQueriedSalary(salary);
    setError(
      salary === null ? '請輸入正整數月薪（新臺幣），例如 35,000；不接受小數或科學記號。' : '',
    );
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'labor'
        : event.key === 'End'
          ? 'health'
          : kind === 'labor'
            ? 'health'
            : 'labor';
    setKind(next);
    (next === 'labor' ? laborTab : healthTab).current?.focus();
  }

  return (
    <ToolPage title="勞健保級距" description="依月薪對照官方投保分級表，查看級距、金額與適用範圍。">
      <div className="insurance-tabs" role="tablist" aria-label="保險種類">
        {(['labor', 'health'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            ref={tab === 'labor' ? laborTab : healthTab}
            id={`insurance-tab-${tab}`}
            role="tab"
            aria-selected={kind === tab}
            aria-controls="insurance-panel"
            tabIndex={kind === tab ? 0 : -1}
            onKeyDown={moveTab}
            onClick={() => setKind(tab)}
          >
            {tab === 'labor' ? '勞工保險' : '全民健康保險'}
          </button>
        ))}
      </div>

      <section
        id="insurance-panel"
        role="tabpanel"
        aria-labelledby={`insurance-tab-${kind}`}
        className="insurance-panel"
      >
        <div className="insurance-version">
          <span>2026 年・民國 115 年版本</span>
          <span>{source.effectiveFrom} 生效</span>
        </div>
        <div className="insurance-workspace">
          <form className="insurance-form" onSubmit={submit} noValidate>
            <h2>查詢投保級距</h2>
            {kind === 'labor' ? (
              <div className="insurance-field">
                <label htmlFor="insurance-identity">投保身分</label>
                <select
                  id="insurance-identity"
                  value={identity}
                  aria-describedby="insurance-scope"
                  onChange={(event) => setIdentity(event.target.value as LaborIdentity)}
                >
                  {laborIdentities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <p id="insurance-scope" className="insurance-help">
                  {laborIdentityNotes[identity]}
                </p>
              </div>
            ) : (
              <p id="insurance-scope" className="insurance-scope">
                健保沒有部分工時專用低級距。本表可供一般受僱者對照；雇主、自營業主、職業工會會員等身分另有申報規則，不能只依輸入薪資決定申報金額。
              </p>
            )}
            <div className="insurance-field">
              <label htmlFor="insurance-salary">
                {kind === 'labor' ? '月薪資總額' : '實際薪資月額'}
              </label>
              <div className="insurance-input-wrap">
                <input
                  id="insurance-salary"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="例如 35,000"
                  value={salaryInput}
                  aria-invalid={Boolean(error)}
                  aria-describedby={
                    error ? 'insurance-error insurance-salary-help' : 'insurance-salary-help'
                  }
                  onChange={(event) => {
                    setSalaryInput(event.target.value);
                    setQueriedSalary(null);
                    setError('');
                  }}
                />
                <span>元／月</span>
              </div>
              <p id="insurance-salary-help" className="insurance-help">
                請填每月薪資總額，非扣除保費後的實領金額。此處僅接受整數新臺幣。
              </p>
              {error && (
                <p id="insurance-error" className="insurance-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <button className="insurance-submit" type="submit">
              查詢級距
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>

          <div className="insurance-result" aria-live="polite" aria-atomic="true">
            {result && queriedSalary !== null ? (
              <>
                <p className="insurance-eyebrow">表列對照結果 · 第 {result.grade} 級</p>
                <h2>{amountLabel}</h2>
                <p className="insurance-amount">
                  <strong>{money.format(result.amount)}</strong>
                  <span>元</span>
                </p>
                <dl>
                  <div>
                    <dt>輸入月薪</dt>
                    <dd>{money.format(queriedSalary)} 元</dd>
                  </div>
                  {kind === 'labor' && (
                    <div>
                      <dt>投保身分</dt>
                      <dd>{identity}</dd>
                    </div>
                  )}
                  <div>
                    <dt>官方薪資區間</dt>
                    <dd>{rangeLabel(result)}</dd>
                  </div>
                </dl>
                {queriedSalary < table[0].amount && (
                  <p className="insurance-result-note">
                    輸入低於本表最低投保金額，對照第一級；仍須確認適用身分與申報規則。
                  </p>
                )}
                {queriedSalary > table[table.length - 1].amount && (
                  <p className="insurance-result-note">
                    輸入高於本表最高投保金額，對照最高級；不代表其他保險或勞退也以此金額封頂。
                  </p>
                )}
                <p className="insurance-result-note">
                  此為級距對照，非每月應繳保費，也不判定納保資格或正式申報金額。
                </p>
              </>
            ) : (
              <div className="insurance-empty">
                <p className="insurance-eyebrow">
                  {kind === 'labor' ? identity : '全民健康保險'} · 共 {table.length} 級
                </p>
                <h2>找到薪資對應的那一級</h2>
                <p>輸入月薪後，顯示官方薪資區間及{amountLabel}。</p>
                <p className="insurance-range-overview">
                  {money.format(table[0].amount)}
                  <span>—</span>
                  {money.format(table[table.length - 1].amount)}
                  <small>元／月</small>
                </p>
              </div>
            )}
          </div>
        </div>

        <details className="insurance-table-details">
          <summary>
            查看完整分級表
            <span>
              {kind === 'labor' ? identity : '健保'} · {table.length} 級
              <ChevronDown size={17} aria-hidden="true" />
            </span>
          </summary>
          <div
            className="insurance-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="投保級距完整表格"
          >
            <table className="insurance-table">
              <caption>
                {source.name} · {kind === 'labor' ? `${identity} · ` : ''}
                {source.effectiveFrom} 生效
              </caption>
              <thead>
                <tr>
                  <th scope="col">等級</th>
                  <th scope="col">{kind === 'labor' ? '月薪資總額' : '實際薪資月額'}</th>
                  <th scope="col">{amountLabel}</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr
                    key={row.grade}
                    className={result?.grade === row.grade ? 'insurance-matched-row' : undefined}
                  >
                    <th scope="row">
                      {row.grade}
                      {result?.grade === row.grade && (
                        <span className="sr-only">，查詢對應級距</span>
                      )}
                    </th>
                    <td>{rangeLabel(row)}</td>
                    <td>{money.format(row.amount)} 元</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <SourceNote
        checkedOn={source.reviewedOn}
        sources={[
          { label: '官方完整分級表', url: source.tableUrl },
          { label: '政府開放資料', url: source.datasetUrl },
          kind === 'labor'
            ? { label: '部分工時適用說明', url: 'https://www.bli.gov.tw/0101373.htm' }
            : {
                label: '投保申報規則',
                url: 'https://www.nhi.gov.tw/ch/dl-59101-5973763b26a04419a0118bf61255504e-1.pdf',
              },
        ]}
      >
        <p>
          本頁收錄 2026
          年已核對版本；其他年度請查官方歷年資料。勞保、健保分開對照，不含勞退與職災保險。
        </p>
        {kind === 'labor' ? (
          <p>身分選項依官方資料集分類；職業工會等其他情形請向投保單位或勞保局確認。</p>
        ) : (
          <p>
            健保申報還須符合身分規定，以及不得低於相應勞保、就保、職災投保薪資與勞退月提繳工資等要求。
          </p>
        )}
      </SourceNote>
    </ToolPage>
  );
}
