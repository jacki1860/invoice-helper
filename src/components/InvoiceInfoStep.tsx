import { FormStep } from './ui/FormStep';
import { FormField } from './ui/FormField';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { AmountInput } from './AmountInput';
import { Select } from './ui/Select';
import React, { useState } from 'react';
import { InvoiceItem } from '../types/invoice';

interface InvoiceInfoStepProps {
  totalAmount: string; // Used as Unit Price input now if manual mode
  setTotalAmount: (value: string) => void;
  subtotalAmount: string; // Used as Unit Price input now if manual mode
  setSubtotalAmount: (value: string) => void;
  amountType: 'total' | 'subtotal';
  setAmountType: (value: 'total' | 'subtotal') => void;
  taxType: 'regular' | 'zero-rate' | 'exempt';
  setTaxType: (value: 'regular' | 'zero-rate' | 'exempt') => void;
  itemName: string;
  setItemName: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  items: InvoiceItem[];
  setItems: (value: InvoiceItem[]) => void;
  calculation: any;
  autoFocus?: boolean;
}

const taxTypeOptions = [
  { value: 'regular', label: '應稅 (5%)' },
  { value: 'zero-rate', label: '零稅率' },
  { value: 'exempt', label: '免稅' }
];

export const InvoiceInfoStep = React.memo(function InvoiceInfoStep({
  totalAmount,
  setTotalAmount,
  subtotalAmount,
  setSubtotalAmount,
  amountType,
  setAmountType,
  taxType,
  setTaxType,
  itemName,
  setItemName,
  date,
  setDate,
  items,
  setItems,
  autoFocus
}: InvoiceInfoStepProps) {
  const [quantity, setQuantity] = useState('1');

  const handleAddItem = () => {
    if (!itemName) return;

    const price = amountType === 'total' ? parseFloat(totalAmount) : parseFloat(subtotalAmount);
    if (isNaN(price)) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) return;

    // Calculate line amount (always based on subtotal for standard accounting, but here we honor the input mode)
    // Actually, we should store pure numbers.
    // If input is "Total" (with tax), we should probably fetch the subtotal part for storage if we want consistency,
    // OR we just store what the user gave and let the global calculator handle it.
    // However, the global calculator iterates items and sums .amount.
    // Let's assume .amount in InvoiceItem is the "Subtotal" (sales amount) of that line.

    let lineSubtotal = 0;
    if (amountType === 'total') {
      // Price is Tax Incl.
      // Subtotal = (Price / 1.05) * Qty
      // BUT wait, if we mix tax types?
      // Let's simplified: The Item stores quantity and unit price.
      // The amount on the line is usually "Amount" (Sales Amount).
      // If taxType is regular, Sales Amount = Price / 1.05 * Qty
    }

    // SIMPLIFICATION:
    // We will just store the calculated "Amount" (Subtotal) and "Unit Price" and "Quantity".
    // If the mode is "Total Amount" (Tax Inclusive), then the Unit Price entered is Tax Inclusive.
    // If the mode is "Subtotal" (Tax Exclusive), the Unit Price entered is Tax Exclusive.
    // We can rely on the `calculateInvoiceAmounts` to sum up these items.
    // Wait, `calculateInvoiceAmounts` sums `item.amount`. 
    // If `item.amount` is Tax Exclusive Subtotal, that works for the standard "Subtotal -> Tax -> Total" flow.

    // Let's do this:
    // 1. Calculate Unit Price (Tax Excl)
    let unitPriceExcl = 0;
    let lineAmount = 0;

    if (amountType === 'total' && taxType === 'regular') {
      // Reverse calculation from Total Line Amount (Tax Incl)
      // This ensures the final sum matches the expected Tax Incl Total
      const totalLineAmountIncl = price * qty;
      lineAmount = Math.round(totalLineAmountIncl / 1.05);
      // Derive unit price from the precise line amount (allow decimals)
      unitPriceExcl = lineAmount / qty;
    } else {
      unitPriceExcl = price;
      lineAmount = Math.round(unitPriceExcl * qty);
    }

    const newItem: InvoiceItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      name: itemName,
      quantity: qty,
      unitPrice: unitPriceExcl,
      amount: lineAmount
    };

    setItems([...items, newItem]);

    // Reset fields
    setItemName('');
    setTotalAmount('');
    setSubtotalAmount('');
    setQuantity('1');
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <FormStep number={1} title="發票資訊">
      <div className="space-y-4">
        {/* Date Selection */}
        <FormField label="日期">
          <input
            type="date"
            className="w-full px-3 py-2.5 border rounded-lg text-lg bg-white transition-all duration-200 focus:outline-none focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/10"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </FormField>

        {/* Global Settings */}
        <FormField label="課稅別">
          <Select
            value={taxType}
            onChange={(value) => setTaxType(value as 'regular' | 'zero-rate' | 'exempt')}
            options={taxTypeOptions}
          />
        </FormField>

        <FormField label="金額輸入方式">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`relative px-4 py-2.5 border rounded-lg text-center transition-all duration-200 group
                ${amountType === 'total'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                  : 'bg-white hover:bg-gray-50 hover:border-gray-300'
                }`}
              onClick={() => setAmountType('total')}
            >
              <div className="flex items-center justify-center gap-2">
                <Calculator className="w-4 h-4" />
                <span>含稅單價</span>
              </div>
            </button>
            <button
              type="button"
              className={`relative px-4 py-2.5 border rounded-lg text-center transition-all duration-200 group
                ${amountType === 'subtotal'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                  : 'bg-white hover:bg-gray-50 hover:border-gray-300'
                }`}
              onClick={() => setAmountType('subtotal')}
            >
              <div className="flex items-center justify-center gap-2">
                <Calculator className="w-4 h-4" />
                <span>未稅單價</span>
              </div>
            </button>
          </div>
        </FormField>

        {/* New Item Input Area */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
          <h3 className="font-medium text-gray-700">新增品項</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label="品名">
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border rounded-lg text-lg bg-white transition-all duration-200 focus:outline-none focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="請輸入品名"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="數量">
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2.5 border rounded-lg text-lg bg-white transition-all duration-200 focus:outline-none focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </FormField>

            {amountType === 'total' ? (
              <FormField label="單價 (含稅)">
                <AmountInput
                  value={totalAmount}
                  onChange={setTotalAmount}
                  placeholder="請輸入單價"
                  autoFocus={autoFocus}
                />
              </FormField>
            ) : (
              <FormField label="單價 (未稅)">
                <AmountInput
                  value={subtotalAmount}
                  onChange={setSubtotalAmount}
                  placeholder="請輸入單價"
                  autoFocus={autoFocus}
                />
              </FormField>
            )}
          </div>

          <button
            onClick={handleAddItem}
            disabled={!itemName || (!totalAmount && !subtotalAmount)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            加入品項
          </button>
        </div>

        {/* Item List */}
        {items.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                <tr>
                  <th className="px-3 py-2">品名</th>
                  <th className="px-3 py-2 text-right">數量</th>
                  <th className="px-3 py-2 text-right">單價(未稅)</th>
                  <th className="px-3 py-2 text-right">小計</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{item.unitPrice.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{item.amount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </FormStep>
  );
});