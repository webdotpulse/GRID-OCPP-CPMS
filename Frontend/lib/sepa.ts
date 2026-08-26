import { api } from './api';

export interface SepaMandate {
  id: number;
  userId: number;
  companyId?: number | null;
  debtorName: string;
  iban: string;
  bic?: string | null;
  mandateRef: string;
  signatureDate: string;
  mandateType: 'CORE' | 'B2B';
  sequenceType: 'FRST' | 'RCUR' | 'FNAL' | 'OOFF';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    name?: string | null;
    email: string;
  };
  company?: {
    id: number;
    name: string;
  };
}

export interface IbanValidationResult {
  ibanValid: boolean;
  ibanError?: string;
  bicValid: boolean;
  bicError?: string;
}

export async function getMandates(params?: {
  userId?: number;
  companyId?: number;
  mandateType?: string;
  isActive?: boolean;
  search?: string;
}): Promise<SepaMandate[]> {
  const response = await api.get('/sepa/mandates', { params });
  return response.data || [];
}

export async function createOrUpdateMandate(data: Partial<SepaMandate>): Promise<SepaMandate> {
  const response = await api.post('/sepa/mandates', data);
  return response.data;
}

export async function deleteMandate(id: number): Promise<{ success: boolean; message: string }> {
  const response = await api.delete(`/sepa/mandates/${id}`);
  return response.data;
}

export async function validateIbanBic(iban: string, bic?: string): Promise<IbanValidationResult> {
  const response = await api.post('/sepa/validate', { iban, bic });
  return response.data;
}

export async function exportDirectDebitXml(params: {
  invoiceIds?: number[];
  year?: number;
  month?: number;
  mandateType?: 'CORE' | 'B2B';
  sequenceType?: 'FRST' | 'RCUR';
  collectionDate?: string;
}): Promise<void> {
  const response = await api.post('/sepa/direct-debit/export', params, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/xml;charset=utf-8' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `SEPA-DirectDebit-pain008-${Date.now()}.xml`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
