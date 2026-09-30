import { useEffect, useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import {
  emptyEquipmentLoan,
  emptyEquipmentLine,
  equipmentLoanResult,
  equipmentLoanText,
  exportEquipmentLoan,
  hasEquipmentLoanContent,
  importEquipmentLoan,
  equipmentLoanStatusLabel,
  EQUIPMENT_BACKUP_LIMIT,
  MAX_EQUIPMENT_LINES,
  type EquipmentLoanDraft,
  type EquipmentLoanLine,
} from '../../features/tools/equipmentLoan';
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

export function EquipmentLoanTool() {
  const [draft, setDraft] = useState(emptyEquipmentLoan);
  const [initialDate] = useState(draft.loanDate);
  const [today, setToday] = useState(getTaiwanDate);
  const [notice, setNotice] = useState('');
  const [backupError, setBackupError] = useState('');
  const [importing, setImporting] = useState(false);
  const paper = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  useEffect(() => {
    const update = () => setToday(getTaiwanDate());
    const interval = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
    };
  }, []);
  const result = equipmentLoanResult(draft, today);
  const hasContent = hasEquipmentLoanContent(draft, initialDate);
  const patch = (update: Partial<EquipmentLoanDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setNotice('');
    setBackupError('');
  };
  const patchLine = (id: string, update: Partial<EquipmentLoanLine>) =>
    patch({ lines: draft.lines.map((line) => (line.id === id ? { ...line, ...update } : line)) });
  const statusLabel = result.valid
    ? `${equipmentLoanStatusLabel[result.status]}${result.overdue ? '・已逾期' : ''}`
    : '資料待確認';

  const downloadBackup = () => {
    setBackupError('');
    try {
      const text = exportEquipmentLoan(draft);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `器材借還單-${draft.loanDate}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('已產生器材借還 JSON 備份，請查看下載項目。');
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
      if (file.size > EQUIPMENT_BACKUP_LIMIT) throw new Error('備份檔不可超過 5 MB。');
      const imported = importEquipmentLoan(await file.text());
      if (currentDraft.current !== before) throw new Error('讀取期間文件已變更，請重新選取備份。');
      if (!window.confirm(`確定以備份中的 ${imported.lines.length} 筆器材取代目前全部借還內容？`))
        return;
      setDraft(imported);
      setNotice('已匯入器材借還備份，請核對內容。');
    } catch (error) {
      setBackupError(
        `未匯入，原有內容保留。${error instanceof Error ? error.message : '無法讀取備份。'}`,
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <ToolPage title="器材借還單" description="借出時記清楚，歸還時逐項核對。">
      <div className="document-workspace trade-workspace records-document">
        <div className="document-editor">
          <SampleButton
            onClick={() => {
              if (hasContent && !window.confirm('載入範例會取代目前器材借還內容。確定取代？'))
                return;
              const date = getTaiwanDate();
              setDraft({
                ...emptyEquipmentLoan(date),
                lender: '範例工作室',
                lenderContact: '器材管理窗口',
                borrower: '陳小事',
                borrowerContact: '活動執行窗口',
                reference: 'EQ-001',
                dueDate: date,
                purpose: '展場測試',
                lines: [
                  {
                    ...emptyEquipmentLine(),
                    assetId: 'PJ-001',
                    name: '投影機',
                    accessories: '電源線、遙控器各 1',
                    outCondition: '可正常開機，外觀完整',
                  },
                  {
                    ...emptyEquipmentLine(),
                    assetId: 'CB-001',
                    name: '延長線',
                    quantity: '2',
                    outCondition: '通電正常',
                    returnedQuantity: '1',
                    returnDate: date,
                    returnCondition: '已點收 1 條，功能正常',
                  },
                ],
                notes: '示範內容；請在實際交接時核對配件與狀況。',
              });
              setNotice('已載入範例。');
              setBackupError('');
            }}
          />
          <h2 className="numbered-title">
            <span>01</span>交接資料
          </h2>
          <div className="tool-form-grid">
            <TradeField
              label="出借人／單位 *"
              value={draft.lender}
              onChange={(lender) => patch({ lender })}
            />
            <TradeField
              label="借用人／單位 *"
              value={draft.borrower}
              onChange={(borrower) => patch({ borrower })}
            />
            <TradeField
              label="出借聯絡資訊（選填）"
              value={draft.lenderContact}
              maxLength={200}
              onChange={(lenderContact) => patch({ lenderContact })}
            />
            <TradeField
              label="借用聯絡資訊（選填）"
              value={draft.borrowerContact}
              maxLength={200}
              onChange={(borrowerContact) => patch({ borrowerContact })}
            />
            <TradeField
              label="實際借出日期 *"
              type="date"
              value={draft.loanDate}
              onChange={(loanDate) => patch({ loanDate })}
            />
            <TradeField
              label="預定歸還日期 *"
              type="date"
              value={draft.dueDate}
              onChange={(dueDate) => patch({ dueDate })}
            />
          </div>
          <TradeField
            label="借用編號（選填）"
            value={draft.reference}
            maxLength={80}
            onChange={(reference) => patch({ reference })}
          />
          <TradeField
            label="借用用途（選填）"
            value={draft.purpose}
            multiline
            maxLength={500}
            onChange={(purpose) => patch({ purpose })}
          />
          <div className="equipment-progress" aria-live="polite">
            <p>{statusLabel}</p>
            <strong>
              {result.valid
                ? `待還 ${result.outstanding} / 借出 ${result.borrowed} 件`
                : '填妥資料後顯示進度'}
            </strong>
            <small>以臺北日期 {today} 判斷；預定歸還當天不算逾期。</small>
          </div>
          <h2 className="numbered-title">
            <span>02</span>器材與歸還
          </h2>
          <p className="trade-hint">
            每列記錄累計已還數量，以及最近一次實際歸還日期與點收狀況。若需逐次保留交接歷程，可在每次更新前下載備份。
          </p>
          {draft.lines.map((line, index) => (
            <fieldset className="records-line-card" key={line.id}>
              <legend>器材 {index + 1}</legend>
              <button
                className="icon-button records-remove-line"
                aria-label={`移除器材 ${index + 1}`}
                onClick={() => {
                  if (!window.confirm(`確定移除器材 ${index + 1} 及其歸還紀錄？`)) return;
                  patch({ lines: draft.lines.filter((entry) => entry.id !== line.id) });
                }}
              >
                <Trash2 size={17} />
              </button>
              <div className="tool-form-grid">
                <TradeField
                  label={`器材名稱 ${index + 1} *`}
                  value={line.name}
                  onChange={(name) => patchLine(line.id, { name })}
                />
                <TradeField
                  label={`器材編號 ${index + 1}（選填）`}
                  value={line.assetId}
                  maxLength={80}
                  onChange={(assetId) => patchLine(line.id, { assetId })}
                />
              </div>
              <TradeField
                label={`配件 ${index + 1}（選填）`}
                value={line.accessories}
                maxLength={300}
                onChange={(accessories) => patchLine(line.id, { accessories })}
              />
              <div className="tool-form-grid">
                <TradeField
                  label={`借出數量 ${index + 1} *`}
                  type="amount"
                  value={line.quantity}
                  onChange={(quantity) => patchLine(line.id, { quantity })}
                  hint="1 至 9,999 件，整數。"
                />
                <TradeField
                  label={`累計已還數量 ${index + 1} *`}
                  type="amount"
                  value={line.returnedQuantity}
                  onChange={(returnedQuantity) => patchLine(line.id, { returnedQuantity })}
                  hint="尚未歸還請填 0。"
                />
              </div>
              <TradeField
                label={`借出狀況 ${index + 1} *`}
                value={line.outCondition}
                multiline
                maxLength={300}
                onChange={(outCondition) => patchLine(line.id, { outCondition })}
              />
              <div className="equipment-return-fields">
                <TradeField
                  label={`最近實際歸還日期 ${index + 1}`}
                  type="date"
                  value={line.returnDate}
                  onChange={(returnDate) => patchLine(line.id, { returnDate })}
                  hint="已還數量大於 0 時必填；尚未歸還請留空。"
                />
                <TradeField
                  label={`最近歸還狀況 ${index + 1}`}
                  value={line.returnCondition}
                  multiline
                  maxLength={300}
                  onChange={(returnCondition) => patchLine(line.id, { returnCondition })}
                  hint="已還數量大於 0 時必填，包含配件核對與異常。"
                />
              </div>
            </fieldset>
          ))}
          <div className="trade-line-actions">
            <button
              className="button button-outline"
              disabled={draft.lines.length >= MAX_EQUIPMENT_LINES}
              onClick={() => patch({ lines: [...draft.lines, emptyEquipmentLine()] })}
            >
              <Plus size={17} />
              新增器材
            </button>
            <span className="trade-hint">{draft.lines.length} / 50 筆</span>
          </div>
          <TradeField
            label="交接備註（選填）"
            multiline
            maxLength={1000}
            value={draft.notes}
            onChange={(notes) => patch({ notes })}
          />
          <TradeErrors errors={result.errors} show={hasContent} />
          <section className="records-backup" aria-label="器材借還文件備份">
            <h3>把借還進度帶到下一次</h3>
            <p>填妥後可下載 JSON 備份；下次匯入可更新歸還數量。最多 50 筆，檔案上限 5 MB。</p>
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
              aria-label="選取器材借還備份"
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
            title="器材借還單"
            date={draft.loanDate}
            text={equipmentLoanText(draft, today)}
            valid={result.valid}
          />
          <SourceNote
            checkedOn="2026-09-30"
            sources={[
              {
                label: '屏東大學・器材借用流程',
                url: 'https://act.nptu.edu.tw/p/412-1077-6451.php?Lang=zh-tw',
              },
            ]}
          >
            <p>
              借出與歸還時，請由雙方核對數量、配件及外觀功能；本單提供交接紀錄，不自動更新庫存。
            </p>
          </SourceNote>
        </div>
        <TradePreview>
          <div
            ref={paper}
            className="business-paper document-print-target trade-paper equipment-paper"
            data-valid={result.valid}
          >
            <header>
              <p className="business-issuer">{draft.lender || '出借人／單位'}</p>
              <h2>器材借還單</h2>
              <p className="trade-paper-kicker">交接與歸還核對紀錄</p>
            </header>
            <PaperData
              pairs={[
                ['借用編號', draft.reference],
                ['出借人', draft.lender || '待填'],
                ['出借聯絡資訊', draft.lenderContact],
                ['借用人', draft.borrower || '待填'],
                ['借用聯絡資訊', draft.borrowerContact],
                ['借出日期', draft.loanDate],
                ['預定歸還', draft.dueDate || '待填'],
                ['借用用途', draft.purpose],
              ]}
            />
            <div className="equipment-paper-summary">
              <strong>{statusLabel}</strong>
              <span>
                {result.valid
                  ? `累計已還 ${result.returned} 件／待還 ${result.outstanding} 件`
                  : '數量待確認'}
              </span>
              <small>核對日期 {today}（臺北時間）</small>
            </div>
            {draft.lines.map((line, index) => (
              <section className="equipment-paper-row" key={line.id}>
                <div className="equipment-paper-row-heading">
                  <h3>
                    {index + 1}. {line.name || '器材名稱待填'}
                  </h3>
                  <span>
                    {result.valid
                      ? `${equipmentLoanStatusLabel[result.lines[index].status]}${result.lines[index].overdue ? '・逾期' : ''}`
                      : '待確認'}
                  </span>
                </div>
                <PaperData
                  pairs={[
                    ['器材編號', line.assetId],
                    ['配件', line.accessories],
                    [
                      '借出／已還／待還',
                      result.lines[index].outstanding === null
                        ? '數量待確認'
                        : `${line.quantity}／${line.returnedQuantity}／${result.lines[index].outstanding}`,
                    ],
                    ['借出狀況', line.outCondition || '待填'],
                    ['最近歸還日期', line.returnDate],
                    ['最近歸還狀況', line.returnCondition],
                  ]}
                />
              </section>
            ))}
            {!draft.lines.length && <p>尚未填寫器材。</p>}
            <PaperNotes text={draft.notes} />
            <Signatures labels={['出借人確認', '借用人確認', '歸還點收確認', '點收日期']} />
            <footer>
              部分歸還欄位記錄累計數量及最近一次歸還日期、狀況。器材與配件請由雙方現場核對。
            </footer>
          </div>
        </TradePreview>
      </div>
    </ToolPage>
  );
}
