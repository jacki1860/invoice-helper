import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { InvoiceWorkspace } from './components/workspace/InvoiceWorkspace';
import { TaxCalculator } from './components/workspace/TaxCalculator';
import { CompanyLookup } from './components/workspace/CompanyLookup';
import { ArrowLeft, Coffee } from 'lucide-react';
import { ToolOverview } from './components/tools/ToolOverview';
import { FavoriteButton } from './components/tools/FavoriteButton';
import { useToolFavorites } from './hooks/useToolFavorites';
import { PaymentSplit } from './components/tools/PaymentSplit';
import { HourlyCalculator } from './components/tools/HourlyCalculator';
import { AdminConverter } from './components/tools/AdminConverter';
import { ListCleanupTool } from './components/tools/ListCleanupTool';
import { MeetingAgendaTool } from './components/tools/MeetingAgendaTool';
import { DocumentBuilder } from './components/tools/DocumentBuilder';
import {
  ReceiptTool,
  PurchaseOrderTool,
  DeliveryNoteTool,
} from './components/tools/TradeDocuments';
import { ExpenseClaimTool } from './components/tools/ExpenseClaimTool';
import { EquipmentLoanTool } from './components/tools/EquipmentLoanTool';
import { AcceptanceTool } from './components/tools/AcceptanceTool';
import { ProfitCalculator } from './components/tools/ProfitCalculator';
import { SupplierComparison } from './components/tools/SupplierComparison';
import type {
  AcceptanceSeed,
  QuoteSeed,
  PurchaseSeed,
  CostSeed,
} from './features/tools/workflowHandoff';
import { Receivables } from './components/tools/Receivables';
import { WorkdayCalculator } from './components/tools/WorkdayCalculator';
import type { ReceiptSeed, ReceivableSeed, ToolHandoff } from './features/tools/handoff';
import InsuranceLookup from './components/tools/InsuranceLookup';
import { LawLookup } from './components/tools/LawLookup';
import { CalendarTool } from './components/tools/CalendarTool';
import { SiteFooter } from './components/tools/SiteFooter';
import {
  categories,
  tools,
  resolveLocation,
  pagePath,
  pageFromPath,
  isPageId,
  isOverviewPage,
  type PageId,
} from './features/tools/catalog';
import { createInitialDraft, type InvoiceDraft } from './features/invoice/draft';
import type { CompanyRecord } from './utils/companyUtils';
import { renderPageGuide } from './features/seo/pages';
import { updatePageMetadata } from './features/seo/browser';
import './components/tools/tools.css';

const base = import.meta.env.BASE_URL;
const currentTool = (): PageId => resolveLocation(window.location, base);

export default function App() {
  const [tool, setTool] = useState<PageId>(currentTool);
  const [initial] = useState(createInitialDraft);
  const [draft, setDraft] = useState(initial.draft);
  const [linkNotice, setLinkNotice] = useState(initial.notice);
  const [receiptHandoff, setReceiptHandoff] = useState<ToolHandoff<ReceiptSeed>>();
  const [receivableHandoff, setReceivableHandoff] = useState<ToolHandoff<ReceivableSeed>>();
  const [acceptanceHandoff, setAcceptanceHandoff] = useState<ToolHandoff<AcceptanceSeed>>();
  const [quoteHandoff, setQuoteHandoff] = useState<ToolHandoff<QuoteSeed>>();
  const [purchaseHandoff, setPurchaseHandoff] = useState<ToolHandoff<PurchaseSeed>>();
  const [costHandoff, setCostHandoff] = useState<ToolHandoff<CostSeed>>();
  const activeTool = tools.find((entry) => entry.id === tool);
  const { favorites, toggleFavorite, notice: favoritesNotice } = useToolFavorites();

  useEffect(() => {
    const onLocationChange = () => {
      const page = currentTool();
      // Upgrade existing bookmarks without a reload or losing URL prefill data.
      // An explicit #tools overrides legacy invoice prefill on the home URL.
      if (
        isPageId(window.location.hash.slice(1)) &&
        !(page === 'tools' && window.location.search)
      ) {
        window.history.replaceState(null, '', pagePath(page, base) + window.location.search);
      }
      setTool(page);
    };
    onLocationChange();
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  useEffect(() => updatePageMetadata(tool), [tool]);

  const navigate = (page: PageId) => {
    const path = pagePath(page, base);
    if (window.location.pathname + window.location.search + window.location.hash !== path) {
      window.history.pushState(null, '', path);
    }
    setTool(page);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const followInternalLink = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self'))
      return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin || url.search || url.hash) return;
    const page = pageFromPath(url.pathname, base);
    if (!page) return;
    event.preventDefault();
    navigate(page);
  };

  const patchDraft = useCallback((patch: Partial<InvoiceDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
  }, []);

  const useCompany = (company: CompanyRecord) => {
    patchDraft({ uniformNumber: company.uniformNumber, buyer: company.name });
    navigate('invoice');
    setLinkNotice(`已帶入 ${company.name}，原有品項保留。`);
  };

  const createReceipt = (data: ReceiptSeed) => {
    setReceiptHandoff({ id: crypto.randomUUID(), data });
    navigate('receipt');
  };
  const createReceivable = (data: ReceivableSeed) => {
    setReceivableHandoff({ id: crypto.randomUUID(), data });
    navigate('receivables');
  };

  const createAcceptance = (data: AcceptanceSeed) => {
    setAcceptanceHandoff({ id: crypto.randomUUID(), data });
    navigate('acceptance');
  };
  const createQuote = (data: QuoteSeed) => {
    setQuoteHandoff({ id: crypto.randomUUID(), data });
    navigate('quote');
  };
  const createPurchase = (data: PurchaseSeed) => {
    setPurchaseHandoff({ id: crypto.randomUUID(), data });
    navigate('purchase');
  };
  const createCosts = (data: CostSeed) => {
    setCostHandoff({ id: crypto.randomUUID(), data });
    navigate('profit');
  };

  return (
    <div onClick={followInternalLink}>
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
        <a className="brand" href={pagePath('tools', base)} aria-label="小事務，工具總覽">
          <span className="brand-name">小事務</span>
          <span className="brand-caption">everyday admin</span>
        </a>
        <nav className="tool-nav" aria-label="行政工具">
          <a href={pagePath('tools', base)} aria-current={tool === 'tools' ? 'page' : undefined}>
            依事情找工具
          </a>
          <a
            href={pagePath('directory', base)}
            aria-current={tool === 'directory' || tool.startsWith('category-') ? 'page' : undefined}
          >
            全部工具
          </a>
        </nav>
        <a
          className="coffee-link"
          href="https://www.buymeacoffee.com/jacki1860"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buy me a coffee，支持小事務（另開分頁）"
        >
          <Coffee size={18} aria-hidden="true" />
          <span>Buy me a coffee</span>
        </a>
      </header>
      <main id="main-content" tabIndex={-1}>
        {activeTool && (
          <div className="tool-breadcrumb">
            <a href={pagePath(`category-${activeTool.category}`, base)}>
              <ArrowLeft size={16} aria-hidden="true" />
              {categories.find((entry) => entry.id === activeTool.category)?.label}
            </a>
            <span>/</span>
            <span>{activeTool.label}</span>
            <FavoriteButton
              tool={activeTool}
              selected={favorites.includes(activeTool.id)}
              onToggle={toggleFavorite}
            />
            <a className="all-tools-link" href={pagePath('directory', base)}>
              全部工具
            </a>
          </div>
        )}
        {linkNotice && (
          <div className="link-notice" role="status">
            <span>{linkNotice}</span>
            <button className="text-button" onClick={() => setLinkNotice('')}>
              關閉
            </button>
          </div>
        )}
        {favoritesNotice && (
          <p className="favorites-notice" role="status">
            {favoritesNotice}
          </p>
        )}
        {isOverviewPage(tool) && (
          <ToolOverview
            key={tool}
            page={tool}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
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
        <section hidden={tool !== 'quote'} aria-label="報價與請款單">
          <DocumentBuilder
            incoming={quoteHandoff}
            onCreateAcceptance={createAcceptance}
            onCreateReceipt={createReceipt}
            onCreateReceivable={createReceivable}
          />
        </section>
        <section hidden={tool !== 'receipt'} aria-label="收據產生器">
          <ReceiptTool incoming={receiptHandoff} />
        </section>
        <section hidden={tool !== 'purchase'} aria-label="採購單">
          <PurchaseOrderTool incoming={purchaseHandoff} />
        </section>
        <section hidden={tool !== 'delivery'} aria-label="送貨與簽收單">
          <DeliveryNoteTool onCreateAcceptance={createAcceptance} />
        </section>
        <section hidden={tool !== 'expense'} aria-label="費用報支單">
          <ExpenseClaimTool />
        </section>
        <section hidden={tool !== 'profit'} aria-label="成本與利潤試算">
          <ProfitCalculator incoming={costHandoff} onCreateQuote={createQuote} />
        </section>
        <section hidden={tool !== 'acceptance'} aria-label="驗收與結案確認">
          <AcceptanceTool incoming={acceptanceHandoff} onCreatePayment={createQuote} />
        </section>
        <section hidden={tool !== 'compare'} aria-label="多家報價比較">
          <SupplierComparison onCreatePurchase={createPurchase} />
        </section>
        <section hidden={tool !== 'equipment'} aria-label="器材借還單">
          <EquipmentLoanTool />
        </section>
        <section hidden={tool !== 'receivables'} aria-label="收款進度">
          <Receivables incoming={receivableHandoff} onCreateReceipt={createReceipt} />
        </section>
        <section hidden={tool !== 'workdays'} aria-label="工作天與交期">
          <WorkdayCalculator />
        </section>
        <section hidden={tool !== 'split'} aria-label="款項分攤">
          <PaymentSplit />
        </section>
        <section hidden={tool !== 'hourly'} aria-label="工時費用">
          <HourlyCalculator onCreateCosts={createCosts} />
        </section>
        <section hidden={tool !== 'convert'} aria-label="金額與日期轉換">
          <AdminConverter />
        </section>
        <section hidden={tool !== 'list-cleanup'} aria-label="清單整理與去重">
          <ListCleanupTool />
        </section>
        <section hidden={tool !== 'meeting-agenda'} aria-label="會議議程時間表">
          <MeetingAgendaTool />
        </section>
        <section hidden={tool !== 'insurance'} aria-label="勞健保級距">
          <InsuranceLookup />
        </section>
        <section hidden={tool !== 'laws'} aria-label="法規查詢">
          <LawLookup />
        </section>
        <section hidden={tool !== 'calendar'} aria-label="假日行事曆">
          <CalendarTool />
        </section>
        <div dangerouslySetInnerHTML={{ __html: renderPageGuide(tool, base) }} />
      </main>
      <SiteFooter />
    </div>
  );
}
