import { useCallback, useEffect, useState } from 'react';
import { InvoiceWorkspace } from './components/workspace/InvoiceWorkspace';
import { TaxCalculator } from './components/workspace/TaxCalculator';
import { CompanyLookup } from './components/workspace/CompanyLookup';
import { createInitialDraft, type InvoiceDraft } from './features/invoice/draft';
import type { CompanyRecord } from './utils/companyUtils';

type Tool = 'invoice' | 'tax' | 'company';
const tools: { id: Tool; label: string }[] = [
  { id: 'invoice', label: '發票助手' },
  { id: 'tax', label: '稅額試算' },
  { id: 'company', label: '公司查詢' },
];

function currentTool(): Tool {
  const hash = window.location.hash.slice(1);
  return hash === 'tax' || hash === 'company' ? hash : 'invoice';
}

export default function App() {
  const [tool, setTool] = useState<Tool>(currentTool);
  const [initial] = useState(createInitialDraft);
  const [draft, setDraft] = useState(initial.draft);
  const [linkNotice, setLinkNotice] = useState(initial.notice);

  useEffect(() => {
    const onHashChange = () => setTool(currentTool());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const patchDraft = useCallback((patch: Partial<InvoiceDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
  }, []);

  const useCompany = (company: CompanyRecord) => {
    patchDraft({ uniformNumber: company.uniformNumber, buyer: company.name });
    window.location.hash = 'invoice';
    setTool('invoice');
    setLinkNotice(`已帶入 ${company.name}，原有品項保留。`);
  };

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        跳至主要內容
      </a>
      <header className="site-header">
        <a className="brand" href="#invoice" aria-label="小事務，發票助手">
          <span className="brand-name">小事務</span>
          <span className="brand-caption">everyday admin</span>
        </a>
        <nav className="tool-nav" aria-label="行政工具">
          {tools.map(({ id, label }) => (
            <a key={id} href={`#${id}`} aria-current={tool === id ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <p className="header-note">免登入，開了就用。</p>
      </header>
      <main id="main-content" tabIndex={-1}>
        {linkNotice && (
          <div className="link-notice" role="status">
            <span>{linkNotice}</span>
            <button className="text-button" onClick={() => setLinkNotice('')}>
              關閉
            </button>
          </div>
        )}
        <section hidden={tool !== 'invoice'} aria-label="發票助手">
          <InvoiceWorkspace draft={draft} onChange={setDraft} onPatch={patchDraft} />
        </section>
        <section hidden={tool !== 'tax'} aria-label="稅額試算">
          <TaxCalculator />
        </section>
        <section hidden={tool !== 'company'} aria-label="公司查詢">
          <CompanyLookup onUseCompany={useCompany} />
        </section>
      </main>
    </>
  );
}
