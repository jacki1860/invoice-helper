import { useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import {
  emptyExpenseClaim,
  emptyExpenseLine,
  expenseClaimResult,
  expenseClaimText,
  exportExpenseClaim,
  formatExpenseCents,
  hasExpenseClaimContent,
  importExpenseClaim,
  EXPENSE_BACKUP_LIMIT,
  MAX_EXPENSE_LINES,
  type ExpenseClaimDraft,
  type ExpenseLine,
} from '../../features/tools/expenseClaim';
import { getTaiwanDate } from '../../utils/dateUtils';
import { ToolPage, SourceNote } from './ToolPage';
import {
  TradeField,
  SampleButton,
  TradeErrors,
  TradeActions,
  TradePreview,
  PaperData,
  PaperNotes,
  Signatures,
} from './TradeDocuments';
import './expense-equipment.css';

export function ExpenseClaimTool() {
  const [draft, setDraft] = useState(emptyExpenseClaim);
  const [initialDate] = useState(draft.date);
  const [notice, setNotice] = useState('');
  const [backupError, setBackupError] = useState('');
  const [importing, setImporting] = useState(false);
  const paper = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const result = expenseClaimResult(draft);
  const hasContent = hasExpenseClaimContent(draft, initialDate);
  const patch = (update: Partial<ExpenseClaimDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setNotice('');
    setBackupError('');
  };
  const patchLine = (id: string, update: Partial<ExpenseLine>) =>
    patch({ lines: draft.lines.map((line) => (line.id === id ? { ...line, ...update } : line)) });
  const differenceLabel =
    result.difference === null
      ? '預支差額'
      : result.difference > 0
        ? '應補付申請人'
        : result.difference < 0
          ? '申請人應繳回'
          : '無應補／應繳回差額';

  const downloadBackup = () => {
    setBackupError('');
    try {
      const text = exportExpenseClaim(draft);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `費用報支單-${draft.date}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('已產生報支 JSON 備份，請查看下載項目。');
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '無法建立備份。');
    }
  };

  const importBackup = async (file: File) => {
    const before = currentDraft.current;
    setImporting(true);
    setNotice('');
    setBackupError('');
    try {
      if (file.size > EXPENSE_BACKUP_LIMIT) throw new Error('備份檔不可超過 5 MB。');
      const imported = importExpenseClaim(await file.text());
      if (currentDraft.current !== before) throw new Error('讀取期間文件已變更，請重新選取備份。');
      if (!window.confirm(`確定以備份中的 ${imported.lines.length} 筆支出取代目前全部報支內容？`))
        return;
      setDraft(imported);
      setNotice('已匯入報支備份，請核對內容。');
    } catch (error) {
      setBackupError(
        `未匯入，原有內容保留。${error instanceof Error ? error.message : '無法讀取備份。'}`,
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <ToolPage title="費用報支單" description="把代墊支出與預支款一起核對，差額清清楚楚。">
      <div className="document-workspace trade-workspace records-document">
        <div className="document-editor">
          <SampleButton
            onClick={() => {
              if (hasContent && !window.confirm('載入範例會取代目前報支內容。確定取代？')) return;
              const date = getTaiwanDate();
              setDraft({
                ...emptyExpenseClaim(date),
                applicant: '陳小事',
                unit: '範例工作室',
                project: '展場搭建',
                reference: 'EX-001',
                advance: '500',
                lines: [
                  {
                    ...emptyExpenseLine(date),
                    category: '交通',
                    purpose: '展場往返車資',
                    voucher: 'TR-001',
                    amount: '320.50',
                  },
                  {
                    ...emptyExpenseLine(date),
                    category: '材料',
                    purpose: '固定配件及耗材',
                    voucher: 'MT-002',
                    amount: '480.25',
                  },
                ],
                notes: '示範內容，請依實際支出及憑證調整。',
              });
              setNotice('已載入範例。');
              setBackupError('');
            }}
          />
          <h2 className="numbered-title">
            <span>01</span>申請資料
          </h2>
          <div className="tool-form-grid">
            <TradeField
              label="申請人 *"
              value={draft.applicant}
              onChange={(applicant) => patch({ applicant })}
            />
            <TradeField
              label="報支單位 *"
              value={draft.unit}
              onChange={(unit) => patch({ unit })}
            />
            <TradeField
              label="專案（選填）"
              value={draft.project}
              maxLength={200}
              onChange={(project) => patch({ project })}
            />
            <TradeField
              label="報支編號（選填）"
              value={draft.reference}
              maxLength={80}
              onChange={(reference) => patch({ reference })}
            />
            <TradeField
              label="申請日期 *"
              type="date"
              value={draft.date}
              onChange={(date) => patch({ date })}
            />
            <label className="tool-field">
              <span>已預支金額（新臺幣）*</span>
              <input
                inputMode="decimal"
                maxLength={15}
                value={draft.advance}
                onChange={(event) => patch({ advance: event.target.value })}
              />
              <small>無預支請填 0，可輸入兩位小數。</small>
            </label>
          </div>
          <h2 className="numbered-title">
            <span>02</span>支出明細
          </h2>
          <p className="trade-hint">
            填入實際支出金額，含已支付的稅額；每筆及合計上限 NT$
            999,999,999.00。憑證編號可留空，是否可報支仍由收件單位審核。
          </p>
          {draft.lines.map((line, index) => (
            <fieldset className="records-line-card" key={line.id}>
              <legend>支出 {index + 1}</legend>
              <button
                className="icon-button records-remove-line"
                aria-label={`移除支出 ${index + 1}`}
                onClick={() => {
                  if (!window.confirm(`確定移除支出 ${index + 1}？`)) return;
                  patch({ lines: draft.lines.filter((entry) => entry.id !== line.id) });
                }}
              >
                <Trash2 size={17} />
              </button>
              <div className="tool-form-grid">
                <TradeField
                  label={`支出日期 ${index + 1} *`}
                  type="date"
                  value={line.date}
                  onChange={(date) => patchLine(line.id, { date })}
                />
                <TradeField
                  label={`分類 ${index + 1} *`}
                  value={line.category}
                  maxLength={80}
                  hint="例如交通、材料、餐費。"
                  onChange={(category) => patchLine(line.id, { category })}
                />
              </div>
              <TradeField
                label={`用途 ${index + 1} *`}
                value={line.purpose}
                maxLength={300}
                onChange={(purpose) => patchLine(line.id, { purpose })}
              />
              <div className="tool-form-grid">
                <TradeField
                  label={`憑證編號 ${index + 1}（選填）`}
                  value={line.voucher}
                  onChange={(voucher) => patchLine(line.id, { voucher })}
                />
                <label className="tool-field">
                  <span>支出金額 {index + 1}（新臺幣）*</span>
                  <input
                    inputMode="decimal"
                    maxLength={15}
                    value={line.amount}
                    onChange={(event) => patchLine(line.id, { amount: event.target.value })}
                  />
                </label>
              </div>
            </fieldset>
          ))}
          <div className="trade-line-actions">
            <button
              className="button button-outline"
              disabled={draft.lines.length >= MAX_EXPENSE_LINES}
              onClick={() => patch({ lines: [...draft.lines, emptyExpenseLine()] })}
            >
              <Plus size={17} />
              新增支出
            </button>
            <span className="trade-hint">{draft.lines.length} / 50 筆</span>
          </div>
          <dl className="records-totals" aria-label="報支計算結果" aria-live="polite">
            <div>
              <dt>支出合計</dt>
              <dd>{result.total === null ? '—' : `NT$ ${formatExpenseCents(result.total)}`}</dd>
            </div>
            <div>
              <dt>已預支金額</dt>
              <dd>{result.advance === null ? '—' : `NT$ ${formatExpenseCents(result.advance)}`}</dd>
            </div>
            <div className="records-grand-total">
              <dt>{differenceLabel}</dt>
              <dd>
                {result.difference === null
                  ? '—'
                  : `NT$ ${formatExpenseCents(Math.abs(result.difference))}`}
              </dd>
            </div>
          </dl>
          <TradeField
            label="報支備註（選填）"
            multiline
            value={draft.notes}
            maxLength={1000}
            onChange={(notes) => patch({ notes })}
          />
          <TradeErrors errors={result.errors} show={hasContent} />
          <section className="records-backup" aria-label="報支文件備份">
            <h3>保留一份可繼續編輯的文件</h3>
            <p>填妥後可下載 JSON 備份；下次匯入即可繼續編輯。最多 50 筆，檔案上限 5 MB。</p>
            <div className="records-backup-actions">
              <button
                className="button button-outline"
                disabled={!result.valid}
                onClick={downloadBackup}
              >
                <Download size={16} />
                下載 JSON 備份
              </button>
              <button
                className="button button-outline"
                disabled={importing}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={16} />
                {importing ? '讀取中…' : '匯入 JSON 備份'}
              </button>
            </div>
            <input
              hidden
              type="file"
              ref={fileInput}
              accept=".json,application/json"
              aria-label="選取報支備份"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importBackup(file);
              }}
            />
          </section>
          <p className="action-status" role="status">
            {notice}
          </p>
          {backupError && (
            <p className="field-error" role="alert">
              {backupError}
            </p>
          )}
          <TradeActions
            paper={paper}
            title="費用報支單"
            date={draft.date}
            text={expenseClaimText(draft)}
            valid={result.valid}
          />
          <SourceNote
            checkedOn="2026-09-30"
            sources={[
              {
                label: '主計總處・政府支出憑證處理要點',
                url: 'https://law.dgbas.gov.tw/LawContent.aspx?id=FL017556',
              },
            ]}
          >
            <p>本工具彙整支出，不代替實際憑證。報支與憑證要求請依收件單位規定確認。</p>
          </SourceNote>
        </div>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target trade-paper expense-paper"
            data-valid={result.valid}
          >
            <header>
              <p className="business-issuer">{draft.unit || '報支單位'}</p>
              <h2>費用報支單</h2>
              <p className="trade-paper-kicker">支出彙整・預支核對</p>
            </header>
            <PaperData
              pairs={[
                ['申請人', draft.applicant || '待填'],
                ['申請日期', draft.date],
                ['專案', draft.project],
                ['報支編號', draft.reference],
              ]}
            />
            <table className="records-expense-table">
              <thead>
                <tr>
                  <th>日期／分類</th>
                  <th>用途／憑證</th>
                  <th>金額 NT$</th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line, index) => (
                  <tr key={line.id}>
                    <td>
                      {line.date}
                      <small>{line.category || '分類待填'}</small>
                    </td>
                    <td>
                      {line.purpose || '用途待填'}
                      {line.voucher && <small>憑證：{line.voucher}</small>}
                    </td>
                    <td>
                      {result.amounts[index] === null
                        ? '—'
                        : formatExpenseCents(result.amounts[index])}
                    </td>
                  </tr>
                ))}
                {!draft.lines.length && (
                  <tr>
                    <td colSpan={3}>尚未填寫支出明細。</td>
                  </tr>
                )}
              </tbody>
            </table>
            <dl className="business-totals">
              <div>
                <dt>支出合計</dt>
                <dd>{result.total === null ? '—' : formatExpenseCents(result.total)}</dd>
              </div>
              <div>
                <dt>已預支金額</dt>
                <dd>{result.advance === null ? '—' : formatExpenseCents(result.advance)}</dd>
              </div>
              <div className="business-grand-total">
                <dt>{differenceLabel}</dt>
                <dd>
                  {result.difference === null
                    ? '—'
                    : formatExpenseCents(Math.abs(result.difference))}
                </dd>
              </div>
            </dl>
            <PaperNotes text={draft.notes} />
            <Signatures labels={['申請人簽章', '審核／付款確認']} />
            <footer>金額單位：新臺幣。請另附實際憑證，依收件單位規定審核。</footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}
