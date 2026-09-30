import { useCallback, useEffect, useState } from 'react';
import { isCompanyLookupAbort, lookupCompany } from '../utils/companyUtils';
import type { CompanyRecord } from '../utils/companyUtils';

type LookupStatus = 'idle' | 'loading' | 'success' | 'not-found' | 'error';

interface LookupState {
  status: LookupStatus;
  company: CompanyRecord | null;
  message: string;
}

interface RequestState extends LookupState {
  key: string;
}

const IDLE: LookupState = { status: 'idle', company: null, message: '' };
const LOADING: LookupState = { status: 'loading', company: null, message: '' };

export function useCompanyLookup(
  uniformNumber: string,
  options: { enabled?: boolean } = {},
): LookupState & { retry: () => void } {
  const enabled = options.enabled ?? true;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RequestState>({ key: '', ...IDLE });
  const valid = /^\d{8}$/.test(uniformNumber);
  const key = `${uniformNumber}:${attempt}`;

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !valid) return;
    const controller = new AbortController();
    let active = true;

    const timer = setTimeout(() => {
      setState({ key, ...LOADING });
      void lookupCompany(uniformNumber, controller.signal)
        .then((result) => {
          if (!active) return;
          if (result.status === 'success') {
            setState({ key, status: 'success', company: result.company, message: '' });
          } else if (result.status === 'not-found') {
            setState({
              key,
              status: 'not-found',
              company: null,
              message: '查無公司資料，可直接填寫公司名稱。',
            });
          } else {
            setState({ key, status: 'error', company: null, message: result.message });
          }
        })
        .catch((error: unknown) => {
          if (!active) return;
          setState(
            isCompanyLookupAbort(error)
              ? { key, ...IDLE }
              : { key, status: 'error', company: null, message: '公司查詢失敗，請稍後重試。' },
          );
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, valid, uniformNumber, key]);

  // Derive the visible state from the current input before effects run, so a
  // completed result from the preceding input can never flash in the new field.
  const current = !enabled || !valid ? IDLE : state.key === key ? state : LOADING;
  return { status: current.status, company: current.company, message: current.message, retry };
}
