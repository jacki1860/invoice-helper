export type Category = 'documents' | 'calculations' | 'conversions' | 'reference';
export type ToolId =
  | 'invoice'
  | 'quote'
  | 'expense'
  | 'profit'
  | 'acceptance'
  | 'compare'
  | 'equipment'
  | 'attendance-sheet'
  | 'receipt'
  | 'purchase'
  | 'delivery'
  | 'receivables'
  | 'workdays'
  | 'tax'
  | 'split'
  | 'hourly'
  | 'convert'
  | 'list-cleanup'
  | 'list-compare'
  | 'text-diff'
  | 'filename-plan'
  | 'meeting-agenda'
  | 'company'
  | 'insurance'
  | 'laws'
  | 'calendar';
export type TaskId = 'quoting' | 'payments' | 'purchasing' | 'expenses' | 'reference';
export type PageId = ToolId | 'tools' | 'directory' | `category-${Category}` | `task-${TaskId}`;

export const categories: { id: Category; label: string; description: string }[] = [
  { id: 'documents', label: '文件產生', description: '把資料填好，讓文件整齊出門。' },
  { id: 'calculations', label: '金額計算', description: '從一筆金額，到每一筆分配。' },
  { id: 'conversions', label: '行政轉換', description: '少查一次，少改一次。' },
  { id: 'reference', label: '公開查詢', description: '查有來源、找得到日期的資料。' },
];

export const taskCollections: {
  id: TaskId;
  label: string;
  description: string;
  toolIds: ToolId[];
}[] = [
  {
    id: 'quoting',
    label: '報價與接案',
    description: '估算成本與工時，整理報價、稅額及交期。',
    toolIds: ['quote', 'profit', 'hourly', 'tax', 'workdays', 'company', 'meeting-agenda'],
  },
  {
    id: 'payments',
    label: '請款與收款',
    description: '整理請款文件、訂金尾款與實際收款紀錄。',
    toolIds: ['quote', 'invoice', 'receivables', 'receipt', 'split', 'acceptance'],
  },
  {
    id: 'purchasing',
    label: '採購與交付',
    description: '比較供應商報價，處理採購、送貨與器材點交。',
    toolIds: [
      'compare',
      'purchase',
      'delivery',
      'acceptance',
      'equipment',
      'workdays',
      'list-cleanup',
      'list-compare',
      'text-diff',
      'filename-plan',
    ],
  },
  {
    id: 'expenses',
    label: '費用與報帳',
    description: '彙整代墊支出，計算分攤、工時與文件金額。',
    toolIds: ['expense', 'split', 'hourly', 'tax', 'convert'],
  },
  {
    id: 'reference',
    label: '日期與資料查詢',
    description:
      '換算日期、安排工作天與會議時間、準備活動簽到表、整理清單與比對文字，查公司及公開資料。',
    toolIds: [
      'workdays',
      'calendar',
      'convert',
      'list-cleanup',
      'list-compare',
      'text-diff',
      'meeting-agenda',
      'attendance-sheet',
      'company',
      'insurance',
      'laws',
    ],
  },
];

export interface Tool {
  id: ToolId;
  category: Category;
  label: string;
  description: string;
  keywords: string;
}

export const tools: Tool[] = [
  {
    id: 'invoice',
    category: 'documents',
    label: '發票助手',
    description: '多品項填寫、稅額拆分與三聯式預覽。',
    keywords: '發票 PNG 統編',
  },
  {
    id: 'quote',
    category: 'documents',
    label: '報價與請款單',
    description: '整理客戶、品項與付款資訊，列印或另存 PDF。',
    keywords: '報價單 請款單 文件 PDF',
  },
  {
    id: 'receipt',
    category: 'documents',
    label: '收據產生器',
    description: '記錄這次收到的款項，整理成一份清楚的收據。',
    keywords: '收據 收款 證明 訂金 尾款 PDF PNG',
  },
  {
    id: 'purchase',
    category: 'documents',
    label: '採購單',
    description: '把訂購品項、金額與交貨約定交給供應商。',
    keywords: '採購 訂購 供應商 訂單 材料 PDF PNG',
  },
  {
    id: 'delivery',
    category: 'documents',
    label: '送貨與簽收單',
    description: '列清楚交付的物品，留下一份點交紀錄。',
    keywords: '送貨 出貨 交付 簽收 點交 設備 PDF PNG',
  },
  {
    id: 'expense',
    category: 'documents',
    label: '費用報支單',
    description: '彙整代墊支出與預支款，列清楚應補或應繳回的金額。',
    keywords: '費用 報支 報帳 代墊 交通 憑證 預支 PDF PNG 備份',
  },
  {
    id: 'acceptance',
    category: 'documents',
    label: '驗收與結案確認',
    description: '逐項確認交付成果，記錄通過與待改善事項。',
    keywords: '驗收 結案 交付 完成 簽章 請款 PDF PNG',
  },
  {
    id: 'equipment',
    category: 'documents',
    label: '器材借還單',
    description: '記下借出的器材、配件與狀況，核對歸還進度。',
    keywords: '器材 借用 借還 設備 歸還 逾期 配件 PDF PNG 備份',
  },
  {
    id: 'attendance-sheet',
    category: 'documents',
    label: '活動簽到表',
    description: '填寫活動資訊與名單，產生可列印的紙本簽到表。',
    keywords: '活動 會議 課程 研習 簽到 簽名 名單 紙本 列印 PDF PNG',
  },
  {
    id: 'profit',
    category: 'calculations',
    label: '成本與利潤試算',
    description: '整理專案成本，依售價或目標毛利率試算獲利。',
    keywords: '成本 利潤 毛利 報價 售價 材料 工時 外包',
  },
  {
    id: 'compare',
    category: 'calculations',
    label: '多家報價比較',
    description: '用相同品項比較價格、運費與交期，再整理採購。',
    keywords: '比較 比價 供應商 採購 報價 運費 保固 付款',
  },
  {
    id: 'receivables',
    category: 'calculations',
    label: '收款進度',
    description: '分次記錄入帳，掌握每一筆尚待收齊的款項。',
    keywords: '收款 應收 訂金 尾款 逾期 對帳 備份',
  },
  {
    id: 'tax',
    category: 'calculations',
    label: '稅額試算',
    description: '含稅、未稅與總額，一次算明白。',
    keywords: '營業稅 5% 免稅',
  },
  {
    id: 'split',
    category: 'calculations',
    label: '款項分攤',
    description: '分期、訂金尾款、多人均分，尾差也算進去。',
    keywords: '訂金 尾款 分期 分帳 百分比',
  },
  {
    id: 'hourly',
    category: 'calculations',
    label: '工時費用',
    description: '用時薪與工作時間，整理每一項服務費用。',
    keywords: '時薪 工時 費用 人力',
  },
  {
    id: 'workdays',
    category: 'conversions',
    label: '工作天與交期',
    description: '依選定的工作規則，計算區間天數或交件日期。',
    keywords: '工作天 交期 到期 日期 假日 排程 回推',
  },
  {
    id: 'convert',
    category: 'conversions',
    label: '金額與日期轉換',
    description: '中文大寫金額、民國與西元日期，隨手複製。',
    keywords: '大寫 數字 民國 西元 日期',
  },
  {
    id: 'list-cleanup',
    category: 'conversions',
    label: '清單整理與去重',
    description: '整理多行名單、品項或代碼，去除空行與重複項目。',
    keywords: '清單 名單 去重 重複 空白 空行 文字 品項 代碼 TXT',
  },
  {
    id: 'list-compare',
    category: 'conversions',
    label: '雙清單比對',
    description: '核對預定與實際清單，列出只在 A、雙方都有與只在 B 的項目。',
    keywords: '清單 名單 比對 比較 集合 預定 實際 缺漏 共有 額外 品項 代碼 TXT',
  },
  {
    id: 'text-diff',
    category: 'conversions',
    label: '文字版本差異',
    description: '逐行比對兩版通知或流程文字，列出相同、新增與刪除內容。',
    keywords: '文字 版本 差異 比對 比較 通知 流程 原文 修改 TXT',
  },
  {
    id: 'filename-plan',
    category: 'conversions',
    label: '批次檔名規劃器',
    description: '貼上檔名，安排前綴、流水號與副檔名，帶走完整對照表。',
    keywords: '批次 檔名 重新命名 改名 前綴 流水號 補零 副檔名 對照表 TXT',
  },
  {
    id: 'meeting-agenda',
    category: 'conversions',
    label: '會議議程時間表',
    description: '填入開始時間與議題分鐘數，排出每項起訖時間及完整議程。',
    keywords: '會議 議程 時間表 開會 分鐘 排程 討論 TXT',
  },
  {
    id: 'company',
    category: 'reference',
    label: '公司查詢',
    description: '以統一編號查詢公司名稱與登記地址。',
    keywords: '統編 公司 商工 登記',
  },
  {
    id: 'insurance',
    category: 'reference',
    label: '勞健保級距',
    description: '分開查閱勞保、健保的投保級距與適用日期。',
    keywords: '勞保 健保 投保 薪資 級距',
  },
  {
    id: 'laws',
    category: 'reference',
    label: '法規查詢',
    description: '勞動、保險、稅務與公司行政的官方法規入口。',
    keywords: '最新 法律 法規 勞基法 公司法 稅',
  },
  {
    id: 'calendar',
    category: 'reference',
    label: '假日行事曆',
    description: '查看官方年度日曆、假日與調整放假資訊。',
    keywords: '國定假日 行事曆 連假 補班 補假',
  },
];

export function isPageId(value: string): value is PageId {
  return (
    value === 'tools' ||
    value === 'directory' ||
    tools.some((tool) => tool.id === value) ||
    categories.some((category) => `category-${category.id}` === value) ||
    taskCollections.some((task) => `task-${task.id}` === value)
  );
}

export function pagePath(page: PageId, base: string): string {
  const root = `${base.replace(/\/$/, '')}/`;
  if (page === 'tools') return root;
  if (page.startsWith('category-')) return `${root}category/${page.slice(9)}/`;
  if (page.startsWith('task-')) return `${root}task/${page.slice(5)}/`;
  return `${root}${page}/`;
}

export function pageFromPath(pathname: string, base: string): PageId | undefined {
  const root = `${base.replace(/\/$/, '')}/`;
  if (!pathname.startsWith(root)) return undefined;
  const relative = pathname.slice(root.length).replace(/(?:\/index\.html|\/|^index\.html)$/, '');
  if (!relative) return 'tools';
  const page = relative.startsWith('category/')
    ? `category-${relative.slice(9)}`
    : relative.startsWith('task/')
      ? `task-${relative.slice(5)}`
      : relative;
  return isPageId(page) && page !== 'tools' ? page : undefined;
}

export function resolveLocation(
  location: { pathname: string; hash: string; search: string },
  base: string,
): PageId {
  const legacy = location.hash.slice(1);
  if (isPageId(legacy)) return legacy;
  const page = pageFromPath(location.pathname, base);
  return page && page !== 'tools' ? page : resolvePage('', location.search);
}

export function resolvePage(hash: string, search = ''): PageId {
  const page = hash.replace(/^#/, '');
  if (isPageId(page)) return page;
  if (
    ['uniformNumber', 'amount', 'itemName', 'date'].some((key) =>
      new URLSearchParams(search).has(key),
    )
  )
    return 'invoice';
  return 'tools';
}

export function categoryForPage(page: PageId): Category | undefined {
  return page.startsWith('category-')
    ? (page.slice(9) as Category)
    : tools.find((tool) => tool.id === page)?.category;
}

export function taskForPage(page: PageId) {
  return taskCollections.find((task) => `task-${task.id}` === page);
}

export function isOverviewPage(page: PageId): boolean {
  return (
    page === 'tools' ||
    page === 'directory' ||
    page.startsWith('category-') ||
    page.startsWith('task-')
  );
}

export function toolsForPage(page: PageId): Tool[] {
  if (page === 'tools' || page === 'directory') return tools;
  const task = taskForPage(page);
  if (task) {
    return task.toolIds.flatMap((id) => tools.filter((tool) => tool.id === id));
  }
  const category = categoryForPage(page);
  return tools.filter((tool) => tool.category === category);
}
