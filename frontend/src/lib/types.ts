export type Role = 'EMPLOYEE' | 'DEPT_MANAGER' | 'BRANCH_MANAGER' | 'WAREHOUSE_KEEPER' | 'ADMIN';

export type RequestStatus =
  | 'PENDING_MANAGER' | 'NEEDS_EDIT' | 'REJECTED' | 'PENDING_WAREHOUSE'
  | 'AWAITING_PURCHASE' | 'PARTIALLY_ISSUED' | 'ISSUED' | 'CANCELLED';

export interface Profile {
  id: string; email: string; username: string | null; fullName: string; role: Role;
  department: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
}

export interface Item {
  id: string; sku: string; name: string; unit: string; minStock: number; active: boolean;
  description?: string | null; barcode?: string | null;
  category: { id: string; name: string };
}

export interface RequestRow {
  id: string; number: number; status: RequestStatus; createdAt: string;
  requester: { fullName: string }; department: { name: string }; branch: { name: string }; section?: { name: string } | null;
  lines: { quantity: number }[];
}

export interface RequestDetail extends Omit<RequestRow, 'lines'> {
  justification: string | null;
  section?: { id: string; name: string } | null;
  requester: { id: string; fullName: string };
  lines: {
    id: string; quantity: number; approvedQty: number | null; issuedQty: number;
    item: { id: string; name: string; sku: string; unit: string; category: { name: string } };
  }[];
  events: { id: string; action: string; note: string | null; createdAt: string; actor: { fullName: string; role: Role } }[];
  purchaseRequests: { id: string; number: number; status: string }[];
}

export interface StockRow {
  id: string; sku: string; name: string; unit: string; category: string; categoryId: string;
  minStock: number; reorderQty: number; onHand: number; value: number; low: boolean;
  batches: { id: string; invoiceNumber: string; receivedAt: string; qtyReceived: number; qtyRemaining: number; unitCost: number }[];
}

export interface Dashboard {
  role: Role;
  total: number;
  cancelled: number;
  weekly: { day: string; requests: number }[];
  pipeline: { pendingManager: number; needsEdit: number; pendingWarehouse: number; awaitingPurchase: number; issued: number; rejected: number };
  trend: { month: string; requests: number }[];
  byCategory: { category: string; units: number }[];
  inventory?: { value: number; units: number; lowCount: number; openPurchaseRequests: number };
  lowItems?: { id: string; name: string; sku: string; minStock: number; onHand: number }[];
  lastInvoices?: { id: string; number: string; supplier: string; total: number; date: string }[];
}

export interface Reports {
  topRequesters: { name: string; department: string; requests: number; units: number }[];
  topItems: { name: string; category: string; requested: number; issued: number }[];
  departmentApprovals: { department: string; branch: string; approved: number; rejected: number; returned: number }[];
  branchPurchases: { branch: string; invoices: number; total: number }[];
  monthlyPurchases: { month: string; total: number }[];
}

export interface PurchaseRequestRow {
  id: string; number: number; status: 'OPEN' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'; createdAt: string;
  /** REORDER: أُنشئ تلقائياً عند بلوغ الحد الأدنى · SHORTAGE: ناتج عن عجز في طلب */
  kind: 'REORDER' | 'SHORTAGE' | 'CONSOLIDATED';
  mergedFrom?: { number: number; request: { number: number } | null }[];
  request: { id: string; number: number; department: { name: string }; branch: { name: string } } | null;
  lines: { id: string; quantity: number; item: { name: string; sku: string; unit: string } }[];
}

export interface InvoiceDetail {
  id: string; number: string; invoiceDate: string; subtotal: string; vatRate: number; total: string; notes: string | null;
  supplier: { name: string; phone: string | null; vatNumber: string | null }; branch: { name: string }; createdBy: { fullName: string };
  purchaseRequest: { number: number } | null;
  lines: { id: string; quantity: number; unitCost: string; item: { name: string; sku: string; unit: string } }[];
}

export interface InvoiceRow {
  id: string; number: string; invoiceDate: string; subtotal: string; vatRate: number; total: string;
  supplier: { name: string }; branch: { name: string }; createdBy: { fullName: string }; _count: { lines: number };
}
