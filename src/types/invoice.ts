export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  buyer: string;
  uniformNumber: string;
  date: string;
  totalAmount: string;
  subtotalAmount: string;
  amountType: 'total' | 'subtotal';
  taxType: 'regular' | 'zero-rate' | 'exempt';
  itemName: string;
  items: InvoiceItem[];
}

export interface InvoiceCalculation {
  subtotal: number;
  tax: number;
  amount: number;
}

export interface InvoiceFormProps extends Omit<InvoiceData, 'date'> {
  setBuyer: (value: string) => void;
  setUniformNumber: (value: string) => void;
  setTotalAmount: (value: string) => void;
  setSubtotalAmount: (value: string) => void;
  setAmountType: (value: 'total' | 'subtotal') => void;
  setTaxType: (value: 'regular' | 'zero-rate' | 'exempt') => void;
  setItemName: (value: string) => void;
  setDate: (value: string) => void;
  setItems: (value: InvoiceItem[]) => void;
  calculation: InvoiceCalculation;
}