import { InvoiceItem } from '../types/invoice';

export const calculateInvoiceAmounts = (
  totalAmount: string,
  subtotalAmount: string,
  amountType: 'total' | 'subtotal',
  taxType: 'regular' | 'zero-rate' | 'exempt',
  items: InvoiceItem[] = []
) => {
  if (items.length > 0) {
    // If items exist, calculate from items
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = taxType === 'regular' ? Math.round(subtotal * 0.05) : 0;
    const amount = subtotal + tax;
    return { amount, tax, subtotal };
  }

  if (amountType === 'total') {
    const amount = parseFloat(totalAmount) || 0;
    // Standard approach: Calculate Sales Amount (Subtotal) first
    // Sales = Round(Total / 1.05)
    const subtotal = taxType === 'regular' ? Math.round(amount / 1.05) : amount;
    // Tax = Total - Sales
    const tax = amount - subtotal;
    return { amount, tax, subtotal };
  } else {
    const subtotal = parseFloat(subtotalAmount) || 0;
    const tax = taxType === 'regular' ? Math.round(subtotal * 0.05) : 0;
    const amount = subtotal + tax;
    return { amount, tax, subtotal };
  }
};