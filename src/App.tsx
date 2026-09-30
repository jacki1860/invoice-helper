import { useCallback, useEffect, useState } from 'react';
import { InvoiceWorkspace } from './components/workspace/InvoiceWorkspace';
import { TaxCalculator } from './components/workspace/TaxCalculator';
import { CompanyLookup } from './components/workspace/CompanyLookup';
import { ArrowLeft, Coffee } from 'lucide-react';
import { ToolOverview } from './components/tools/ToolOverview';
import { PaymentSplit } from './components/tools/PaymentSplit';
import { HourlyCalculator } from './components/tools/HourlyCalculator';
import { AdminConverter } from './components/tools/AdminConverter';
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
  resolvePage,
  categoryForPage,
  type PageId,
} from './features/tools/catalog';
import { createInitialDraft, type InvoiceDraft } from './features/invoice/draft';
import type { CompanyRecord } from './utils/companyUtils';
import './components/tools/tools.css';

const currentTool = (): PageId => resolvePage(window.location.hash, window.location.search);

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
  const category = categoryForPage(tool);
  const activeTool = tools.find((entry) => entry.id === tool);

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

  const createReceipt = (data: ReceiptSeed) => {
    setReceiptHandoff({ id: crypto.randomUUID(), data });
    window.location.hash = 'receipt';
    setTool('receipt');
  };
  const createReceivable = (data: ReceivableSeed) => {
    setReceivableHandoff({ id: crypto.randomUUID(), data });
    window.location.hash = 'receivables';
    setTool('receivables');
  };

  const createAcceptance = (data: AcceptanceSeed) => {
    setAcceptanceHandoff({ id: crypto.randomUUID(), data });
    window.location.hash = 'acceptance';
    setTool('acceptance');
  };
  const createQuote = (data: QuoteSeed) => {
    setQuoteHandoff({ id: crypto.randomUUID(), data });
    window.location.hash = 'quote';
    setTool('quote');
  };
  const createPurchase = (data: PurchaseSeed) => {
    setPurchaseHandoff({ id: crypto.randomUUID(), data });
    window.location.hash = 'purchase';
    setTool('purchase');
  };
  const createCosts = (data: CostSeed) => {
    setCostHandoff({ id: crypto.randomUUID(), data });
    window.location.hash = 'profit';
    setTool('profit');
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
        <a className="brand" href="#tools" aria-label="小事務，工具總覽">
          <span className="brand-name">小事務</span>
          <span className="brand-caption">everyday admin</span>
        </a>
        <nav className="tool-nav" aria-label="行政工具">
          {categories.map(({ id, label }) => (
            <a
              key={id}
              href={`#category-${id}`}
              aria-current={category === id ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
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
            <a href={`#category-${activeTool.category}`}>
              <ArrowLeft size={16} aria-hidden="true" />
              {categories.find((entry) => entry.id === activeTool.category)?.label}
            </a>
            <span>/</span>
            <span>{activeTool.label}</span>
            <a className="all-tools-link" href="#tools">
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
        {(tool === 'tools' || tool.startsWith('category-')) && (
          <ToolOverview key={tool} category={category} />
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
        <section hidden={tool !== 'insurance'} aria-label="勞健保級距">
          <InsuranceLookup />
        </section>
        <section hidden={tool !== 'laws'} aria-label="法規查詢">
          <LawLookup />
        </section>
        <section hidden={tool !== 'calendar'} aria-label="假日行事曆">
          <CalendarTool />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
