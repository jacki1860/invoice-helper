import { useLayoutEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';

export function CopyAction({
  text,
  disabled = false,
  label = '複製結果',
}: {
  text: string;
  disabled?: boolean;
  label?: string;
}) {
  const [status, setStatus] = useState('');
  const requestVersion = useRef(0);
  useLayoutEffect(() => {
    requestVersion.current += 1;
    setStatus('');
    return () => {
      requestVersion.current += 1;
    };
  }, [text, disabled]);
  return (
    <div className="copy-action">
      <button
        type="button"
        className="button button-primary"
        disabled={disabled || !text}
        onClick={async () => {
          const version = ++requestVersion.current;
          setStatus('');
          try {
            await navigator.clipboard.writeText(text);
            if (requestVersion.current === version) setStatus('已複製。');
          } catch {
            if (requestVersion.current === version)
              setStatus('無法存取剪貼簿，請直接選取結果複製。');
          }
        }}
      >
        <Copy size={17} aria-hidden="true" />
        {label}
      </button>
      <p role="status" className="action-status">
        {status}
      </p>
    </div>
  );
}
