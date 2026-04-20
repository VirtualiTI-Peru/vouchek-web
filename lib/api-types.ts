// Shared types for receipts

export type Receipt = {
  userId: string;
  receiptId: string;
  customerId?: string;
  createdAt: string;
  updatedAt?: string;
  isDownloaded: boolean;
  transactionSource?: string;
  transactionAmount?: number;
  transactionCurrency?: string;
  transactionOperationNumber?: string;
  transactionDateTimeUtc?: string;
  blobUrl?: string;
  ocrText?: string;
  userName?: string;
};

export type ReceiptSummary = {
  customerId: string;
  lastUpdatedAt: string | null;
};

export type ReceiptPage = {
  customerId: string;
  page: number;
  pageSize: number;
  hasMore: boolean;
  lastUpdatedAt: string | null;
  receipts: Receipt[];
};

export type ReceiptsList = {
  receipts: Receipt[];
};

export type Customer = {
  customerId: string;
  customerName?: string;
  maxUsersAllowed?: number;
  maxImagesPerMonth?: number;
};

export type CustomerList = {
  customers: Customer[];
};