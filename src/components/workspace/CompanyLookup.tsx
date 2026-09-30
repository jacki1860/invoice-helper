import { useState } from 'react';
import { ArrowUpRight, Copy, FileText, LoaderCircle, Search } from 'lucide-react';
import { useCompanyLookup } from '../../hooks/useCompanyLookup';
import type { CompanyRecord } from '../../utils/companyUtils';

interface Props {
  onUseCompany: (company: CompanyRecord) => void;
}

export function CompanyLookup({ onUseCompany }: Props) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState('');
  const lookup = useCompanyLookup(query);
  const valid = /^\d{8}$/.test(input);
  const copy = async () => {
    if (!lookup.company) return;
    try {
      await navigator.clipboard.writeText(
        `${lookup.company.name}\n統一編號：${lookup.company.uniformNumber}\n地址：${lookup.company.address || '未提供'}`,
      );
      setNotice('已複製公司資料。');
    } catch {
      setNotice('瀏覽器未允許複製，請允許剪貼簿存取後重試。');
    }
  };

  return (
    <div className="workspace secondary-workspace">
      <div className="editor-panel">
        <div className="workspace-heading">
          <div>
            <h1>公司查詢</h1>
            <p className="lead">一組統編，找到需要的資料。</p>
          </div>
        </div>
        <section className="editor-section">
          <div className="section-heading">
            <h2>
              <span>01</span>輸入統一編號
            </h2>
          </div>
          <form
            className="company-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
              setNotice('');
              if (valid) {
                if (query === input) lookup.retry();
                else setQuery(input);
              }
            }}
          >
            <label className="field">
              <span>統一編號</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                autoComplete="off"
                placeholder="8 碼統一編號"
                value={input}
                aria-invalid={submitted && !valid}
                aria-describedby="company-search-help"
                onChange={(event) => {
                  setInput(event.target.value.replace(/\D/g, ''));
                  setQuery('');
                  setSubmitted(false);
                  setNotice('');
                }}
              />
            </label>
            <p
              id="company-search-help"
              className={submitted && !valid ? 'field-error' : 'field-hint'}
            >
              {submitted && !valid
                ? '請輸入完整的 8 位數統一編號。'
                : '查詢只會送出統編，不會傳送發票內容。'}
            </p>
            <button
              className="button button-primary"
              type="submit"
              disabled={lookup.status === 'loading'}
            >
              {lookup.status === 'loading' ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Search size={18} />
              )}
              {lookup.status === 'loading' ? '查詢中' : '查詢公司'}
            </button>
          </form>
        </section>
        <div className="source-note">
          <h2>資料有來源，使用更安心。</h2>
          <p>
            查詢使用第三方「台灣公司資料」服務。資料可能有更新時間差，重要資訊請至官方網站核對。
          </p>
          <a href="https://company.g0v.ronny.tw/" target="_blank" rel="noreferrer">
            台灣公司資料 <ArrowUpRight size={16} />
          </a>
          <a href="https://findbiz.nat.gov.tw/" target="_blank" rel="noreferrer">
            經濟部商工登記查詢 <ArrowUpRight size={16} />
          </a>
        </div>
        <footer className="workspace-footer">
          <p>查詢結果僅留在本次頁面，重新整理後不保留。</p>
        </footer>
      </div>
      <aside className="preview-stage company-stage">
        <h2 className="preview-heading">查詢結果</h2>
        <div className="lookup-paper" aria-live="polite">
          {lookup.status === 'success' && lookup.company ? (
            <>
              <span className="lookup-overline">公司資料</span>
              <h2>{lookup.company.name}</h2>
              <dl className="company-result">
                <div>
                  <dt>統一編號</dt>
                  <dd>{lookup.company.uniformNumber}</dd>
                </div>
                <div>
                  <dt>登記地址</dt>
                  <dd>{lookup.company.address || '資料來源未提供地址'}</dd>
                </div>
              </dl>
              <div className="lookup-actions">
                <button
                  className="button button-primary"
                  onClick={() => onUseCompany(lookup.company!)}
                >
                  <FileText size={18} />
                  帶入發票
                </button>
                <button className="button button-quiet" onClick={copy}>
                  <Copy size={18} />
                  複製資料
                </button>
              </div>
              <p className="action-status" role="status">
                {notice}
              </p>
            </>
          ) : (
            <div className="lookup-empty">
              {lookup.status === 'loading' ? (
                <LoaderCircle size={40} strokeWidth={1.1} className="spin" />
              ) : (
                <Search size={40} strokeWidth={1.1} />
              )}
              <h2>
                {lookup.status === 'loading'
                  ? '正在找尋公司資料'
                  : lookup.status === 'not-found'
                    ? '沒有找到這組統編'
                    : lookup.status === 'error'
                      ? '目前無法取得資料'
                      : '公司資料，放在手邊。'}
              </h2>
              <p>
                {lookup.status === 'loading'
                  ? '通常只需要幾秒鐘。'
                  : lookup.status === 'not-found'
                    ? '請核對統編，或至經濟部商工登記查詢。發票助手仍可手動填寫買受人。'
                    : lookup.status === 'error'
                      ? '資料服務暫時沒有回應。稍後可重試，也能使用官方查詢。'
                      : '輸入統一編號，查詢名稱與地址，接著就能直接帶入發票。'}
              </p>
              {lookup.status === 'error' && (
                <button className="button button-outline" onClick={lookup.retry}>
                  重新查詢
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
