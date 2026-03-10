import { InvoiceItem } from '../../../types/invoice';

interface ItemRowsProps {
  subtotal: number;
  itemName?: string;
  items?: InvoiceItem[];
}

export function ItemRows({ subtotal, itemName, items }: ItemRowsProps) {
  // If we have items (array with length > 0), use them
  // Otherwise fallback to single item display

  if (items && items.length > 0) {
    // Fill remaining empty rows to maintain minimum height (e.g. at least 4 rows total)
    // Or just 4 rows standard?
    // Let's stick to a standard minimum of 4 rows for the table look.
    const MIN_ROWS = 4;
    const emptyRowsCount = Math.max(0, MIN_ROWS - items.length);

    return (
      <>
        {items.map((item, index) => (
          <tr key={index}>
            <td className="border border-gray-300 p-2 text-blue-600" colSpan={2}>
              {item.name}
            </td>
            <td className="border border-gray-300 p-2 text-right text-blue-600 font-mono tabular-nums">
              {item.quantity}
            </td>
            <td className="border border-gray-300 p-2 text-right text-blue-600 font-mono tabular-nums">
              {item.unitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </td>
            <td className="border border-gray-300 p-2 text-right text-blue-600 font-mono tabular-nums">
              {item.amount.toLocaleString()}
            </td>
            <td className="border border-gray-300 p-2"></td>
          </tr>
        ))}
        {[...Array(emptyRowsCount)].map((_, i) => (
          <tr key={`empty-${i}`} className="h-[2.5rem]">
            <td className="border border-gray-300" colSpan={2}></td>
            <td className="border border-gray-300"></td>
            <td className="border border-gray-300"></td>
            <td className="border border-gray-300"></td>
            <td className="border border-gray-300"></td>
          </tr>
        ))}
      </>
    );
  }

  // Fallback for empty list (manual mode)
  return (
    <>
      <tr>
        <td className="border border-gray-300 p-2 text-blue-600" colSpan={2}>
          {itemName || '請填寫品名'}
        </td>
        <td className="border border-gray-300 p-2 text-right text-blue-600 font-mono tabular-nums">
          1
        </td>
        <td className="border border-gray-300 p-2 text-right text-blue-600 font-mono tabular-nums">
          {subtotal.toLocaleString()}
        </td>
        <td className="border border-gray-300 p-2 text-right text-blue-600 font-mono tabular-nums">
          {subtotal.toLocaleString()}
        </td>
        <td className="border border-gray-300 p-2"></td>
      </tr>
      {[...Array(3)].map((_, i) => (
        <tr key={i} className="h-[2.5rem]">
          <td className="border border-gray-300" colSpan={2}></td>
          <td className="border border-gray-300"></td>
          <td className="border border-gray-300"></td>
          <td className="border border-gray-300"></td>
          <td className="border border-gray-300"></td>
        </tr>
      ))}
    </>
  );
}
