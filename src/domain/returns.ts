import { IOrder } from './order';

export type ReturnFaultType = 'kv_fault' | 'customer_preference';
export type ReturnVideoStatus = 'not_required' | 'awaiting' | 'received';

export interface IReturnItem {
  /** References `order_items.id`; null when the original line can no longer be resolved. */
  orderItemId: string | null;
  productName: string;
  quantity: number;
  reason?: string | null;
}

/** Present when the query joined the customer, standing in for the old `populate`. */
export interface IReturnUserRef {
  _id: string;
  name: string;
  email: string;
}

export interface IReturn {
  _id: string;
  orderId: string | IOrder;
  userId: string | IReturnUserRef;
  reason: string;
  description?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  refundAmount: number;
  items: IReturnItem[];
  /**
   * Whether this is a KV-fault claim (refund/replacement eligible) or a
   * customer-preference request (exchange/store-credit only — never a cash
   * refund, since metal value fluctuates).
   */
  faultType: ReturnFaultType;
  /** 'awaiting' for kv_fault claims until the unboxing video is matched; 'not_required' otherwise. */
  videoStatus: ReturnVideoStatus;
  /** Short code (e.g. "RET-A1B2C3") the customer includes in their WhatsApp video caption. */
  videoReferenceCode?: string | null;
  videoFilePath?: string | null;
  videoMimeType?: string | null;
  videoReceivedAt?: Date | null;
  videoSenderPhone?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IUnmatchedReturnVideo {
  _id: string;
  senderPhone: string;
  filePath: string;
  mimeType: string;
  caption?: string | null;
  linkedReturnId?: string | null;
  receivedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
