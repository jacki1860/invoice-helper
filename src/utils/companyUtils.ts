export interface CompanyRecord {
  uniformNumber: string;
  name: string;
  address: string;
}

export type CompanyLookupResult =
  | { status: 'success'; company: CompanyRecord }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

const LOOKUP_TIMEOUT_MS = 8_000;
const INVALID_RESPONSE_MESSAGE = '公司查詢服務回傳的資料格式異常，請稍後重試。';
const TIMEOUT_MESSAGE = '公司查詢逾時，請稍後重試，或直接填寫公司名稱。';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalText(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function abortError(): DOMException {
  return new DOMException('Company lookup was cancelled.', 'AbortError');
}

export function isCompanyLookupAbort(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

function parseCompany(payload: unknown, uniformNumber: string): CompanyLookupResult {
  const malformed: CompanyLookupResult = { status: 'error', message: INVALID_RESPONSE_MESSAGE };
  if (!isRecord(payload)) return malformed;

  const explicitNotFound = [payload.error, payload.message].some((value) =>
    /^(?:not found|company not found|查無資料|查無此統編|找不到公司(?:資料)?)[。.!]?$/i.test(
      text(value),
    ),
  );
  if (explicitNotFound) return { status: 'not-found' };
  if (
    (payload.error !== undefined &&
      payload.error !== null &&
      payload.error !== false &&
      payload.error !== '') ||
    payload.success === false
  )
    return malformed;

  if (payload.data === null) return { status: 'not-found' };
  if (!isRecord(payload.data)) return malformed;
  const data = payload.data;
  const finance = data['財政部'];
  if (finance !== undefined && finance !== null && !isRecord(finance)) return malformed;

  const knownFields = ['財政部', '公司名稱', '公司所在地', '分公司名稱', '分公司所在地'];
  if (Object.keys(data).length > 0 && !knownFields.some((field) => field in data)) return malformed;

  const names = [
    isRecord(finance) ? finance['營業人名稱'] : undefined,
    data['公司名稱'],
    data['分公司名稱'],
  ];
  const addresses = [
    isRecord(finance) ? finance['營業地址'] : undefined,
    data['公司所在地'],
    data['分公司所在地'],
  ];
  if (![...names, ...addresses].every(isOptionalText)) return malformed;

  const name = names.map(text).find(Boolean);
  if (!name) {
    // Empty registry data is a normal miss. A populated object in an unknown
    // shape, or an address without a company name, is not evidence of a miss.
    if (addresses.some((value) => text(value) !== '')) return malformed;
    if (isRecord(finance) && Object.keys(finance).length > 0 && !('營業人名稱' in finance)) {
      return malformed;
    }
    return { status: 'not-found' };
  }

  return {
    status: 'success',
    company: { uniformNumber, name, address: addresses.map(text).find(Boolean) ?? '' },
  };
}

/** Looks up public company registration data; cancellation rejects with AbortError. */
export async function lookupCompany(
  uniformNumber: string,
  signal?: AbortSignal,
): Promise<CompanyLookupResult> {
  if (signal?.aborted) throw abortError();
  if (!/^\d{8}$/.test(uniformNumber)) {
    return { status: 'error', message: '請輸入 8 位數字的統一編號。' };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const cancellation = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new DOMException('Company lookup timed out.', 'TimeoutError'));
    }, LOOKUP_TIMEOUT_MS);
    onAbort = () => {
      controller.abort();
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

  const request = async (): Promise<CompanyLookupResult> => {
    const response = await fetch(`https://company.g0v.ronny.tw/api/show/${uniformNumber}`, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) {
      return { status: 'error', message: '公司查詢服務暫時無法使用，請稍後重試。' };
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (isCompanyLookupAbort(error)) throw error;
      return { status: 'error', message: INVALID_RESPONSE_MESSAGE };
    }
    return parseCompany(payload, uniformNumber);
  };

  try {
    return await Promise.race([request(), cancellation]);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timedOut) return { status: 'error', message: TIMEOUT_MESSAGE };
    if (isCompanyLookupAbort(error)) throw error;
    return { status: 'error', message: '無法連線至公司查詢服務，請檢查網路或稍後重試。' };
  } finally {
    clearTimeout(timeout);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}

/** Compatibility wrapper for the former name-only lookup. */
export async function fetchCompanyInfo(uniformNumber: string): Promise<string | null> {
  try {
    const result = await lookupCompany(uniformNumber);
    return result.status === 'success' ? result.company.name : null;
  } catch {
    return null;
  }
}
