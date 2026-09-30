export type Category = 'documents' | 'calculations' | 'conversions' | 'reference';
export type ToolId =
  | 'invoice'
  | 'quote'
  | 'receipt'
  | 'purchase'
  | 'delivery'
  | 'receivables'
  | 'workdays'
  | 'tax'
  | 'split'
  | 'hourly'
  | 'convert'
  | 'company'
  | 'insurance'
  | 'laws'
  | 'calendar';
export type PageId = ToolId | 'tools' | `category-${Category}`;

export const categories: { id: Category; label: string; description: string }[] = [
  { id: 'documents', label: '文件產生', description: '把資料填好，讓文件整齊出門。' },
  { id: 'calculations', label: '金額計算', description: '從一筆金額，到每一筆分配。' },
  { id: 'conversions', label: '行政轉換', description: '少查一次，少改一次。' },
  { id: 'reference', label: '公開查詢', description: '查有來源、找得到日期的資料。' },
];

export const tools: {
  id: ToolId;
  category: Category;
  label: string;
  description: string;
  keywords: string;
}[] = [
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

export function resolvePage(hash: string, search = ''): PageId {
  const page = hash.replace(/^#/, '');
  if (
    page === 'tools' ||
    tools.some((tool) => tool.id === page) ||
    categories.some((category) => `category-${category.id}` === page)
  )
    return page as PageId;
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
