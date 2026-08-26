import { api } from './api';

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  companyId?: number | null;
  userId?: number | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  billingAddress?: string | null;
  taxNumber?: string | null;
  country?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  vatRate: number;
  currency: string;
  status: 'draft' | 'issued' | 'paid' | 'void';
  pdfUrl?: string | null;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItem[];
  company?: {
    id: number;
    name: string;
  } | null;
  user?: {
    id: number;
    name?: string | null;
    email: string;
    companyName?: string | null;
  } | null;
  transactions?: Array<{
    id: number;
    transactionId: string;
    connectorName: string;
    startTime: string;
    endTime?: string | null;
    energyConsumed: number;
    totalCost?: number | null;
    charger?: {
      charger_id: number;
      name: string;
      chargingStation?: {
        id: number;
        station_name: string;
      };
    };
  }>;
}

export interface InvoiceStats {
  totalSubtotal: number;
  totalVat: number;
  totalAmount: number;
}

export interface InvoicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InvoiceFilters {
  status?: string;
  companyId?: number;
  userId?: number;
  year?: number;
  month?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getInvoices(filters?: InvoiceFilters): Promise<{
  invoices: Invoice[];
  pagination: InvoicePagination;
  stats: InvoiceStats;
}> {
  const response = await api.get('/invoices', { params: filters });
  
  // Handled with interceptor unwrap or raw payload
  const rawData = response.data;
  const invoices = Array.isArray(rawData) ? rawData : (rawData?.invoices || rawData?.data || []);
  const pagination = (response as any).pagination || rawData?.pagination || {
    page: 1,
    limit: 10,
    total: invoices.length,
    totalPages: 1,
  };
  const stats = (response as any).stats || rawData?.stats || {
    totalSubtotal: 0,
    totalVat: 0,
    totalAmount: 0,
  };

  return { invoices, pagination, stats };
}

export async function getInvoice(id: number): Promise<Invoice> {
  const response = await api.get(`/invoices/${id}`);
  return response.data;
}

export async function downloadInvoicePdf(id: number, invoiceNumber: string): Promise<void> {
  const response = await api.get(`/invoices/${id}/pdf`, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `${invoiceNumber}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function generateInvoices(params?: { year?: number; month?: number }): Promise<any> {
  const response = await api.post('/invoices/generate', params || {});
  return response.data;
}

export async function sendInvoiceEmail(id: number): Promise<{ success: boolean; message: string }> {
  const response = await api.post(`/invoices/${id}/send`);
  return response.data;
}

export async function updateInvoiceStatus(id: number, status: string, notes?: string): Promise<Invoice> {
  const response = await api.patch(`/invoices/${id}/status`, { status, notes });
  return response.data;
}
