import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import type { InvoiceDraft } from '../../features/invoice/draft';
import { useCompanyLookup } from '../../hooks/useCompanyLookup';
import { isValidInvoiceDate } from '../../utils/dateUtils';

interface Props {
  draft: InvoiceDraft;
  onPatch: (patch: Partial<InvoiceDraft>) => void;
}

export function CompanyFields({ draft, onPatch }: Props) {
  const lookup = useCompanyLookup(draft.uniformNumber);
  const protectedNameFor = useRef<string | null>(draft.buyer ? draft.uniformNumber : null);

  useEffect(() => {
    if (
      lookup.status === 'success' &&
      lookup.company?.uniformNumber === draft.uniformNumber &&
      protectedNameFor.current !== draft.uniformNumber
    ) {
      protectedNameFor.current = draft.uniformNumber;
      onPatch({ buyer: lookup.company.name });
    }
  }, [lookup.status, lookup.company, draft.uniformNumber, onPatch]);

  const validDate = isValidInvoiceDate(draft.date);
  const uniformError = draft.uniformNumber !== '' && !/^\d{8}$/.test(draft.uniformNumber);

  return (
    <>
      <div className="company-fields">
        <label className="field">
          <span>統一編號</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            placeholder="8 碼統一編號"
            value={draft.uniformNumber}
            aria-invalid={uniformError}
            aria-describedby="company-field-status"
            onChange={(event) => {
              protectedNameFor.current = null;
              onPatch({ uniformNumber: event.target.value.replace(/\D/g, ''), buyer: '' });
            }}
          />
        </label>
        <label className="field buyer-field">
          <span>買受人</span>
          <input
            type="text"
            autoComplete="organization"
            maxLength={100}
            placeholder="公司或買受人名稱"
            value={draft.buyer}
            onChange={(event) => {
              protectedNameFor.current = draft.uniformNumber;
              onPatch({ buyer: event.target.value });
            }}
          />
        </label>
        <label className="field date-field">
          <span>日期</span>
          <input
            type="date"
            value={draft.date}
            min="0001-01-01"
            max="9999-12-31"
            aria-invalid={!validDate}
            aria-describedby={!validDate ? 'date-error' : undefined}
            onInput={(event) => onPatch({ date: event.currentTarget.value })}
            onChange={(event) => onPatch({ date: event.target.value })}
          />
        </label>
      </div>
      <div className="field-help-row">
        <div
          id="company-field-status"
          className={lookup.status === 'error' || uniformError ? 'field-error' : 'field-hint'}
          aria-live="polite"
        >
          {uniformError
            ? '統一編號需要 8 位數字。'
            : lookup.status === 'loading'
              ? '正在查詢公司資料…'
              : lookup.status === 'success'
                ? '已找到公司資料，買受人仍可自行修改。'
                : lookup.status === 'not-found'
                  ? '查無資料，可直接填寫買受人。'
                  : lookup.status === 'error'
                    ? '暫時無法查詢，可直接填寫買受人。'
                    : '填入統編可查公司名稱，也可直接填寫買受人。'}
          {lookup.status === 'error' && (
            <button className="text-button" onClick={lookup.retry}>
              <RefreshCw size={13} />
              重試
            </button>
          )}
        </div>
        {!validDate && (
          <p id="date-error" className="field-error">
            請填寫有效日期。
          </p>
        )}
      </div>
    </>
  );
}
