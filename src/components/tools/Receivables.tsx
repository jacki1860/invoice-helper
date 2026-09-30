import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { MAX_AMOUNT } from '../../domain/invoice';
import { getTaiwanDate } from '../../utils/dateUtils';
import type { ReceivableSeed, ReceiptSeed, ToolHandoff } from '../../features/tools/handoff';
import {
  addReceivablePayment,
  emptyPaymentDraft,
  emptyReceivableDraft,
  exportReceivables,
  importReceivables,
  makeReceivable,
  MAX_RECEIVABLES,
  RECEIVABLE_BACKUP_LIMIT,
  RECEIVABLE_STORAGE_KEY,
  ReceivableStorageConflict,
  receivableProgress,
  receivableReminder,
  receivableStatusLabel,
  receivableSummary,
  receivableToDraft,
  receiptFromPayment,
  reconciliationText,
  removeReceivableStorage,
  writeReceivableStorage,
  type PaymentDraft,
  type Receivable,
} from '../../features/tools/receivables';
import { formatMoney } from '../workspace/Totals';
import { CopyAction } from './CopyAction';
import { ToolPage } from './ToolPage';
import './receivables.css';

interface Store {
  records: Receivable[];
  enabled: boolean;
  blocked: boolean;
  raw: string | null;
  error: string;
}

interface Editor {
  selectedId: string | null;
  draft: ReceivableSeed;
  payment: PaymentDraft;
  paymentInitialDate: string;
  appliedHandoff: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '發生無法辨識的錯誤。';
}

function readStore(): Store {
  const empty: Store = { records: [], enabled: false, blocked: false, raw: null, error: '' };
  try {
    const raw = window.localStorage.getItem(RECEIVABLE_STORAGE_KEY);
    if (raw === null) return empty;
    try {
      return { ...empty, records: importReceivables(raw), enabled: true, raw };
    } catch (error) {
      return {
        ...empty,
        raw,
        blocked: true,
        error: `本機資料無法讀取，已保留原始資料並暫停儲存。${errorMessage(error)}`,
      };
    }
  } catch (error) {
    return {
      ...empty,
      blocked: true,
      error: `瀏覽器無法讀取本機儲存，目前只使用記憶體。${errorMessage(error)}`,
    };
  }
}

function initialEditor(): Editor {
  const today = getTaiwanDate();
  return {
    selectedId: null,
    draft: emptyReceivableDraft(),
    payment: emptyPaymentDraft(today),
    paymentInitialDate: today,
    appliedHandoff: '',
  };
}

function downloadBackup(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Receivables({
  incoming,
  onCreateReceipt,
}: {
  incoming?: ToolHandoff<ReceivableSeed>;
  onCreateReceipt?: (seed: ReceiptSeed) => void;
}) {
  const [store, setStore] = useState(readStore);
  const [editor, setEditor] = useState(initialEditor);
  const [today, setToday] = useState(getTaiwanDate);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [uiError, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorPanel = useRef<HTMLElement>(null);
  const currentWork = useRef({ store, editor });
  currentWork.current = { store, editor };

  useEffect(() => {
    const update = () => setToday(getTaiwanDate());
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);

  const selected = store.records.find((record) => record.id === editor.selectedId);
  const originalDraft = selected ? receivableToDraft(selected) : emptyReceivableDraft();
  const dirty = JSON.stringify(originalDraft) !== JSON.stringify(editor.draft);
  const paymentDirty =
    JSON.stringify(editor.payment) !== JSON.stringify(emptyPaymentDraft(editor.paymentInitialDate));
  const summary = receivableSummary(store.records, today);
  const selectedProgress = selected ? receivableProgress(selected, today) : null;
  const filtered = store.records.filter((record) => {
    const progress = receivableProgress(record, today);
    const matchesStatus =
      filter === 'all' || (filter === 'overdue' ? progress.overdue : progress.status === filter);
    return (
      matchesStatus &&
      [record.customer, record.issuer, record.title, record.reference]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    );
  });

  function resetFeedback() {
    setMessage('');
    setError('');
  }

  function updateStore(next: Store) {
    setStore(next);
  }

  function commitRecords(records: Receivable[]): boolean {
    let raw: string;
    try {
      raw = exportReceivables(records);
    } catch (error) {
      setError(errorMessage(error));
      return false;
    }
    let next = { ...store, records };
    if (store.enabled) {
      try {
        writeReceivableStorage(window.localStorage, store.raw, raw);
        next = { ...next, raw, error: '' };
      } catch (error) {
        next = {
          ...next,
          enabled: false,
          blocked: true,
          raw: error instanceof ReceivableStorageConflict ? error.currentRaw : store.raw,
          error: `本次變更留在記憶體，本機儲存已暫停，請匯出備份。${errorMessage(error)}`,
        };
      }
    }
    updateStore(next);
    return true;
  }

  function canReplaceEditor(): boolean {
    return (
      (!dirty && !paymentDirty) ||
      window.confirm('案件資料或收款欄位有尚未儲存的內容，確定放棄並切換嗎？')
    );
  }

  function openRecord(record?: Receivable, draft = emptyReceivableDraft()) {
    if (!canReplaceEditor()) return;
    resetFeedback();
    const date = getTaiwanDate();
    setEditor({
      ...editor,
      selectedId: record?.id ?? null,
      draft: record ? receivableToDraft(record) : draft,
      payment: emptyPaymentDraft(date),
      paymentInitialDate: date,
    });
    if (window.matchMedia('(max-width: 900px)').matches)
      editorPanel.current?.scrollIntoView({ block: 'start' });
  }

  function changeField(field: keyof ReceivableSeed, value: string) {
    setEditor({ ...editor, draft: { ...editor.draft, [field]: value } });
    resetFeedback();
  }

  function changePayment(field: keyof PaymentDraft, value: string) {
    setEditor({ ...editor, payment: { ...editor.payment, [field]: value } });
    resetFeedback();
  }

  function saveRecord(event: FormEvent) {
    event.preventDefault();
    resetFeedback();
    try {
      if (!selected && store.records.length >= MAX_RECEIVABLES)
        throw new Error(`最多保留 ${MAX_RECEIVABLES} 筆案件，請先備份並整理既有紀錄。`);
      const record = makeReceivable(
        editor.draft,
        selected?.id ?? crypto.randomUUID(),
        selected?.payments,
      );
      if (selected && !window.confirm('確定儲存這筆案件的修改？既有實收紀錄會保留。')) return;
      const records = selected
        ? store.records.map((entry) => (entry.id === record.id ? record : entry))
        : [...store.records, record];
      if (commitRecords(records)) {
        setEditor({ ...editor, selectedId: record.id, draft: receivableToDraft(record) });
        setMessage(selected ? '案件資料已更新。' : '已新增案件，可繼續登記實際收到的款項。');
      }
    } catch (error) {
      setError(errorMessage(error));
    }
  }

  function addPayment(event: FormEvent) {
    event.preventDefault();
    resetFeedback();
    if (!selected) return;
    if (dirty) {
      setError('請先儲存案件資料的修改，再登記實收款項。');
      return;
    }
    try {
      const record = addReceivablePayment(selected, editor.payment, crypto.randomUUID());
      const payment = record.payments[record.payments.length - 1];
      if (
        !window.confirm(
          `確認已在 ${payment.date} 收到「${selected.customer}」NT$ ${formatMoney(payment.amount)}（${payment.method}）？`,
        )
      )
        return;
      if (commitRecords(store.records.map((entry) => (entry.id === record.id ? record : entry)))) {
        const date = getTaiwanDate();
        setEditor({ ...editor, payment: emptyPaymentDraft(date), paymentInitialDate: date });
        setMessage('已登記實收款項，餘額已更新。');
      }
    } catch (error) {
      setError(errorMessage(error));
    }
  }

  function togglePersistence() {
    resetFeedback();
    if (store.enabled) {
      if (
        !window.confirm(
          '停止本機儲存，並刪除這個瀏覽器已保存的收款資料？目前畫面紀錄仍會保留，重新整理後將消失。建議先匯出備份。',
        )
      )
        return;
      try {
        removeReceivableStorage(window.localStorage, store.raw);
        updateStore({ ...store, enabled: false, blocked: false, raw: null, error: '' });
        setMessage('已停止本機儲存，目前紀錄仍留在本次頁面。');
      } catch (error) {
        if (error instanceof ReceivableStorageConflict)
          updateStore({
            ...store,
            enabled: false,
            blocked: true,
            raw: error.currentRaw,
            error: error.message,
          });
        setError(`無法刪除本機資料，尚未停用。${errorMessage(error)}`);
      }
      return;
    }
    if (store.blocked) return;
    try {
      const raw = exportReceivables(store.records);
      writeReceivableStorage(window.localStorage, null, raw);
      updateStore({ ...store, enabled: true, raw, error: '' });
      setMessage('已啟用本機儲存，已儲存的案件與收款會在此瀏覽器保留。');
    } catch (error) {
      updateStore({
        ...store,
        blocked: true,
        raw: error instanceof ReceivableStorageConflict ? error.currentRaw : store.raw,
        error: `無法啟用本機儲存，畫面紀錄仍保留。${errorMessage(error)}`,
      });
    }
  }

  async function importBackup(file: File) {
    resetFeedback();
    setImporting(true);
    const before = currentWork.current;
    try {
      if (file.size > RECEIVABLE_BACKUP_LIMIT) throw new Error('檔案超過 5 MB，未匯入任何資料。');
      const records = importReceivables(await file.text());
      if (
        currentWork.current.store !== before.store ||
        currentWork.current.editor !== before.editor
      )
        throw new Error('讀取檔案期間資料已變更，請重新選取備份檔。');
      if (
        !window.confirm(
          `備份含 ${records.length} 筆案件。確定取代目前全部 ${store.records.length} 筆紀錄及未儲存內容？${store.enabled ? '本機儲存也會同步取代。' : ''}建議先匯出目前資料。`,
        )
      )
        return;
      if (commitRecords(records)) {
        const date = getTaiwanDate();
        setEditor({
          ...editor,
          selectedId: null,
          draft: emptyReceivableDraft(),
          payment: emptyPaymentDraft(date),
          paymentInitialDate: date,
        });
        setMessage(`已匯入 ${records.length} 筆案件。`);
      }
    } catch (error) {
      setError(`匯入未完成，原有資料未變更。${errorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  }

  const pendingHandoff = incoming && incoming.id !== editor.appliedHandoff;

  return (
    <ToolPage title="收款進度管理" description="把應收、實收與下一次提醒，整理在同一處。">
      <div className="receivables">
        {pendingHandoff && (
          <aside className="receivable-handoff" aria-label="待帶入的文件資料">
            <p>
              有一筆「{incoming.data.title || incoming.data.reference || '文件'}
              」資料可帶入新增表單。
            </p>
            <div className="receivable-actions">
              <button
                className="button button-primary"
                onClick={() => {
                  if (!canReplaceEditor()) return;
                  const date = getTaiwanDate();
                  setEditor({
                    selectedId: null,
                    draft: { ...incoming.data },
                    payment: emptyPaymentDraft(date),
                    paymentInitialDate: date,
                    appliedHandoff: incoming.id,
                  });
                  resetFeedback();
                  setMessage('已帶入表單，核對後按「新增案件」才會加入紀錄。');
                }}
              >
                帶入新增表單
              </button>
              <button
                className="text-button"
                onClick={() => setEditor({ ...editor, appliedHandoff: incoming.id })}
              >
                略過
              </button>
            </div>
          </aside>
        )}

        <dl className="receivable-summary" aria-label="全部案件收款摘要">
          <div>
            <dt>尚待收款</dt>
            <dd>
              <small>NT$</small> {formatMoney(summary.outstanding)}
            </dd>
          </div>
          <div>
            <dt>其中已逾期</dt>
            <dd>
              <small>NT$</small> {formatMoney(summary.overdue)}
            </dd>
          </div>
          <div>
            <dt>累計實收</dt>
            <dd>
              <small>NT$</small> {formatMoney(summary.received)}
            </dd>
          </div>
        </dl>
        <p className="receivable-caption">
          全部 {store.records.length} 筆案件・臺北日期 {today}・摘要不受篩選影響
        </p>

        <section className="receivable-storage" aria-label="資料保存與備份">
          <div>
            <label className="receivable-opt-in">
              <input
                type="checkbox"
                checked={store.enabled}
                disabled={store.blocked}
                onChange={togglePersistence}
              />
              在這個瀏覽器保存收款紀錄
            </label>
            <p>
              {store.enabled
                ? '本機儲存已開啟；只保留已儲存的案件與實收紀錄，未送出的欄位不會保留。'
                : store.blocked
                  ? '本機儲存暫停；目前變更只在記憶體，請先匯出備份。'
                  : '目前只在記憶體；切換工具仍保留，重新整理或關閉頁面後消失。'}
              資料不會上傳，也不會跨裝置同步。
            </p>
          </div>
          <div className="receivable-actions">
            <button
              className="button button-outline"
              onClick={() => {
                resetFeedback();
                try {
                  downloadBackup(
                    exportReceivables(store.records),
                    `收款紀錄-${getTaiwanDate()}.json`,
                  );
                  setMessage('已產生 JSON 備份下載；未儲存的表單內容不包含在備份內。');
                } catch (error) {
                  setError(errorMessage(error));
                }
              }}
            >
              <Download size={16} aria-hidden="true" />
              匯出備份
            </button>
            <button
              className="button button-outline"
              disabled={importing}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} aria-hidden="true" />
              {importing ? '讀取中…' : '匯入備份'}
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".json,application/json"
              aria-label="選取收款紀錄備份檔"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importBackup(file);
              }}
            />
          </div>
          {store.blocked && (
            <div className="receivable-recovery">
              <p className="field-error" role="alert">
                {store.error}
              </p>
              {store.raw !== null && (
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      const raw = window.localStorage.getItem(RECEIVABLE_STORAGE_KEY);
                      updateStore({ ...store, raw });
                      if (raw === null)
                        throw new Error('本機資料已由其他頁面移除，目前沒有可下載的資料。');
                      downloadBackup(raw, '收款紀錄-原始本機資料.json');
                      setMessage('已下載此刻的本機原始資料；目前記憶體紀錄未變更。');
                    } catch (error) {
                      setError(`無法下載本機原始資料。${errorMessage(error)}`);
                    }
                  }}
                >
                  下載原始本機資料
                </button>
              )}
              <button
                className="text-button"
                onClick={() => {
                  if (
                    !window.confirm(
                      '確定刪除此工具原有的本機儲存資料並解除暫停？目前畫面紀錄會保留。若原有資料尚未備份，請先取消。',
                    )
                  )
                    return;
                  try {
                    removeReceivableStorage(window.localStorage, store.raw);
                    updateStore({ ...store, enabled: false, blocked: false, raw: null, error: '' });
                    setMessage('已清除原有的本機儲存，目前畫面紀錄仍保留；可自行重新啟用儲存。');
                  } catch (error) {
                    if (error instanceof ReceivableStorageConflict)
                      updateStore({
                        ...store,
                        enabled: false,
                        blocked: true,
                        raw: error.currentRaw,
                        error: error.message,
                      });
                    setError(`仍無法存取本機儲存。${errorMessage(error)}`);
                  }
                }}
              >
                清除本機儲存並解除暫停
              </button>
            </div>
          )}
        </section>

        <div className="receivable-feedback" aria-live="polite">
          {message && <p role="status">{message}</p>}
          {uiError && (
            <p className="field-error" role="alert">
              {uiError}
            </p>
          )}
        </div>

        <div className="receivable-workspace">
          <section
            ref={editorPanel}
            className="receivable-editor"
            aria-labelledby="receivable-editor-title"
          >
            <div className="receivable-section-heading">
              <h2 id="receivable-editor-title">{selected ? '案件與收款' : '新增應收案件'}</h2>
              {selected && (
                <button className="text-button" onClick={() => openRecord()}>
                  新增另一筆
                </button>
              )}
            </div>
            <form onSubmit={saveRecord}>
              <label className="tool-field">
                <span>客戶名稱（付款方）</span>
                <input
                  required
                  maxLength={150}
                  value={editor.draft.customer}
                  onChange={(event) => changeField('customer', event.target.value)}
                />
              </label>
              <label className="tool-field">
                <span>收款方名稱</span>
                <input
                  required
                  maxLength={150}
                  value={editor.draft.issuer}
                  onChange={(event) => changeField('issuer', event.target.value)}
                />
              </label>
              <label className="tool-field">
                <span>案件名稱</span>
                <input
                  required
                  maxLength={200}
                  value={editor.draft.title}
                  onChange={(event) => changeField('title', event.target.value)}
                />
              </label>
              <label className="tool-field">
                <span>文件／參考編號（選填）</span>
                <input
                  maxLength={100}
                  value={editor.draft.reference}
                  onChange={(event) => changeField('reference', event.target.value)}
                />
              </label>
              <div className="tool-form-grid">
                <label className="tool-field">
                  <span>應收總額（新臺幣整元）</span>
                  <input
                    required
                    inputMode="numeric"
                    placeholder="例如 12000"
                    value={editor.draft.total}
                    onChange={(event) => changeField('total', event.target.value)}
                  />
                </label>
                <label className="tool-field">
                  <span>付款期限（選填）</span>
                  <input
                    type="date"
                    min="0001-01-01"
                    max="9999-12-31"
                    value={editor.draft.dueDate}
                    onChange={(event) => changeField('dueDate', event.target.value)}
                  />
                </label>
              </div>
              <p className="receivable-caption">
                單案上限 NT$ {formatMoney(MAX_AMOUNT)}；期限當天尚不算逾期。
              </p>
              <div className="receivable-actions">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={Boolean(selected) && !dirty}
                >
                  <Plus size={16} aria-hidden="true" />
                  {selected ? '儲存案件修改' : '新增案件'}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    openRecord(undefined, {
                      customer: '範例客戶',
                      issuer: '範例工作室',
                      title: '網站維護服務（範例）',
                      reference: 'DEMO-001',
                      total: '12000',
                      dueDate: today,
                    })
                  }
                >
                  帶入範例
                </button>
              </div>
            </form>

            {selected && selectedProgress && (
              <section className="receivable-payments" aria-labelledby="receivable-payment-title">
                <h3 id="receivable-payment-title">實際收到的款項</h3>
                <p className="receivable-balance">
                  尚待收款 <strong>NT$ {formatMoney(selectedProgress.balance)}</strong>
                </p>
                {selected.payments.length === 0 ? (
                  <p className="receivable-caption">目前沒有實收紀錄。</p>
                ) : (
                  <ol className="receivable-payment-list">
                    {selected.payments.map((payment, index) => (
                      <li key={payment.id}>
                        <div>
                          <strong>NT$ {formatMoney(payment.amount)}</strong>
                          <span>
                            {payment.date}・{payment.method}
                          </span>
                          {payment.note && <p>{payment.note}</p>}
                        </div>
                        <div className="receivable-actions">
                          {onCreateReceipt && (
                            <button
                              className="text-button"
                              onClick={() => {
                                if (
                                  (dirty || paymentDirty) &&
                                  !window.confirm(
                                    '將以前次儲存的案件資料建立此筆實收收據；目前未儲存內容仍留在收款工具。確定繼續？',
                                  )
                                )
                                  return;
                                onCreateReceipt(receiptFromPayment(selected, payment.id));
                              }}
                            >
                              建立第 {index + 1} 筆收據
                            </button>
                          )}
                          <button
                            className="text-button"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `移除 ${payment.date} 的 NT$ ${formatMoney(payment.amount)} 實收紀錄？餘額會重新計算。`,
                                )
                              )
                                return;
                              resetFeedback();
                              if (
                                commitRecords(
                                  store.records.map((record) =>
                                    record.id === selected.id
                                      ? {
                                          ...record,
                                          payments: record.payments.filter(
                                            (entry) => entry.id !== payment.id,
                                          ),
                                        }
                                      : record,
                                  ),
                                )
                              )
                                setMessage('已移除實收紀錄並重新計算餘額。');
                            }}
                          >
                            移除第 {index + 1} 筆
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {selectedProgress.balance > 0 && (
                  <form onSubmit={addPayment}>
                    <div className="tool-form-grid">
                      <label className="tool-field">
                        <span>本次實收金額（整元）</span>
                        <input
                          required
                          inputMode="numeric"
                          value={editor.payment.amount}
                          onChange={(event) => changePayment('amount', event.target.value)}
                        />
                      </label>
                      <label className="tool-field">
                        <span>實收日期</span>
                        <input
                          required
                          type="date"
                          min="0001-01-01"
                          max={today}
                          value={editor.payment.date}
                          onChange={(event) => changePayment('date', event.target.value)}
                        />
                      </label>
                    </div>
                    <label className="tool-field">
                      <span>收款方式</span>
                      <input
                        required
                        maxLength={80}
                        placeholder="銀行轉帳、現金等"
                        value={editor.payment.method}
                        onChange={(event) => changePayment('method', event.target.value)}
                      />
                    </label>
                    <label className="tool-field">
                      <span>收款備註（選填）</span>
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={editor.payment.note}
                        onChange={(event) => changePayment('note', event.target.value)}
                      />
                    </label>
                    <button type="submit" className="button button-primary" disabled={dirty}>
                      確認實收並登記
                    </button>
                    {dirty && (
                      <p className="receivable-caption">案件資料有修改，請先儲存後再登記款項。</p>
                    )}
                  </form>
                )}
                <details className="receivable-copy">
                  <summary>核對與提醒文字</summary>
                  <p className="receivable-caption">
                    文字使用已儲存的案件資料，複製後可自行調整並傳送。
                  </p>
                  <label className="tool-field">
                    <span>對帳明細</span>
                    <textarea readOnly rows={6} value={reconciliationText(selected, today)} />
                  </label>
                  <CopyAction text={reconciliationText(selected, today)} label="複製對帳明細" />
                  {selectedProgress.balance > 0 && (
                    <>
                      <label className="tool-field">
                        <span>付款提醒</span>
                        <textarea readOnly rows={6} value={receivableReminder(selected, today)} />
                      </label>
                      <CopyAction text={receivableReminder(selected, today)} label="複製付款提醒" />
                    </>
                  )}
                </details>
                <button
                  className="text-button receivable-delete"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `確定刪除「${selected.title}」與其 ${selected.payments.length} 筆實收紀錄？此案未儲存的編輯也會清除。`,
                      )
                    )
                      return;
                    if (
                      commitRecords(store.records.filter((record) => record.id !== selected.id))
                    ) {
                      const date = getTaiwanDate();
                      setEditor({
                        ...editor,
                        selectedId: null,
                        draft: emptyReceivableDraft(),
                        payment: emptyPaymentDraft(date),
                        paymentInitialDate: date,
                      });
                      setMessage('已刪除案件及其實收紀錄。');
                      setError('');
                    }
                  }}
                >
                  刪除此案件
                </button>
              </section>
            )}
          </section>

          <section className="receivable-records" aria-labelledby="receivable-list-title">
            <div className="receivable-section-heading">
              <h2 id="receivable-list-title">收款清單</h2>
              <span>
                {filtered.length} / {store.records.length} 筆
              </span>
            </div>
            <div className="receivable-filters">
              <label className="tool-field">
                <span>搜尋案件</span>
                <input
                  type="search"
                  placeholder="客戶、案件或編號"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="tool-field">
                <span>收款狀態</span>
                <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">全部</option>
                  <option value="overdue">已逾期</option>
                  <option value="unpaid">未收</option>
                  <option value="partial">部分收款</option>
                  <option value="paid">已收</option>
                </select>
              </label>
            </div>
            {filtered.length === 0 ? (
              <p className="receivable-empty">
                {store.records.length
                  ? '沒有符合的案件，試著調整搜尋或篩選條件。'
                  : '從一筆應收款開始。填入案件後，每次入帳都能分開記錄。'}
              </p>
            ) : (
              <ul className="receivable-list">
                {filtered.map((record) => {
                  const progress = receivableProgress(record, today);
                  return (
                    <li key={record.id} className={selected?.id === record.id ? 'is-selected' : ''}>
                      <div className="receivable-card-heading">
                        <p>{record.customer}</p>
                        <div className="receivable-badges">
                          {progress.overdue && <span className="is-overdue">已逾期</span>}
                          <span>{receivableStatusLabel[progress.status]}</span>
                        </div>
                      </div>
                      <h3>{record.title}</h3>
                      <p className="receivable-caption">
                        {record.reference || '未填文件編號'}・
                        {record.dueDate ? `期限 ${record.dueDate}` : '未設付款期限'}
                      </p>
                      <dl className="receivable-card-amounts">
                        <div>
                          <dt>應收</dt>
                          <dd>{formatMoney(record.total)}</dd>
                        </div>
                        <div>
                          <dt>實收</dt>
                          <dd>{formatMoney(progress.received)}</dd>
                        </div>
                        <div>
                          <dt>待收</dt>
                          <dd>{formatMoney(progress.balance)}</dd>
                        </div>
                      </dl>
                      <progress
                        max={record.total}
                        value={progress.received}
                        aria-label={`${record.title} 已收 ${formatMoney(progress.received)} 元，共 ${formatMoney(record.total)} 元`}
                      />
                      <button
                        className="button button-outline"
                        aria-label={`開啟 ${record.title}，查看與登記收款`}
                        aria-pressed={selected?.id === record.id}
                        onClick={() => openRecord(record)}
                      >
                        查看與登記收款
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="receivable-caption">
              每筆最多 100 次實收，最多 500 筆案件；備份檔上限 5 MB。
            </p>
            <button
              className="text-button receivable-delete"
              disabled={!store.records.length && !dirty && !paymentDirty}
              onClick={() => {
                if (
                  !window.confirm(
                    `確定清空全部 ${store.records.length} 筆案件、實收紀錄及未儲存表單？${store.enabled ? '本機儲存也會同步清空。' : ''}請先確認已有備份。`,
                  )
                )
                  return;
                if (commitRecords([])) {
                  const date = getTaiwanDate();
                  setEditor({
                    ...editor,
                    selectedId: null,
                    draft: emptyReceivableDraft(),
                    payment: emptyPaymentDraft(date),
                    paymentInitialDate: date,
                  });
                  setMessage('已清空全部案件與表單。');
                  setError('');
                }
              }}
            >
              清空全部紀錄
            </button>
          </section>
        </div>
      </div>
    </ToolPage>
  );
}
