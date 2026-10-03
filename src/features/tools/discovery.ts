import { tools, type Tool, type ToolId } from './catalog.ts';

const searchAliases: Partial<Record<ToolId, string[]>> = {
  invoice: ['發票計算', '三聯式', '買受人', '抬頭'],
  quote: ['接案', '估價', '報價書', '請款書', '付款通知', 'logo'],
  expense: ['報帳', '報銷', '核銷', '差旅', '墊付'],
  profit: ['接案', '定價', '賺多少', '利潤率', '加成率'],
  acceptance: ['驗收單', '結案單', '成果確認', '交付確認'],
  compare: ['比價', '詢價', '廠商比較', '供應商比較'],
  equipment: ['借用單', '借據', '設備借用', '器材歸還'],
  receipt: ['收款證明', '收據單'],
  purchase: ['訂購單', '訂貨單', '進貨'],
  delivery: ['出貨單', '簽收單', '點交單'],
  receivables: ['催款', '催收', '收款追蹤', '應收帳款', '帳款管理'],
  workdays: ['營業日', '工作日', '交件日', '日期加減'],
  tax: ['含稅', '未稅', '稅金', '加稅', '拆稅'],
  split: ['分帳', '分攤', '均攤', '均分', '分錢'],
  hourly: ['接案', '鐘點費', '鐘點', '人工費', '計時費用'],
  convert: ['國字金額', '大寫金額', '中文數字', '民國換算', '日期換算'],
  'list-cleanup': ['清除重複', '刪除重複', '移除重複', '清理名單', '刪除空行', '清單去重'],
  company: ['統一編號', '公司名稱', '公司地址', '公司登記'],
  insurance: ['投保級距', '投保金額', '勞工保險', '全民健康保險'],
  laws: ['法條', '法律條文', '法規資料庫'],
  calendar: ['放假', '休假日', '月曆', '日曆', 'ics'],
};

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-TW');
}

export function searchTools(query: string): Tool[] {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return tools.filter((tool) => {
    const content = normalizeSearch(
      [tool.label, tool.description, tool.keywords, ...(searchAliases[tool.id] || [])].join(' '),
    );
    return terms.every((term) => content.includes(term));
  });
}
