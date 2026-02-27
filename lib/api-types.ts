// Shared types for receipts

export type Receipt = {
  userId: string;
  receiptId: string;
  customerId?: string;
  createdAt: string;
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