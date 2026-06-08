/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InventoryItem {
  id: number;
  sku: string;
  item_name: string;
  oum: string; // Unit of Measure
  inventory_cost: number; // Current actual inventory cost to match
  description: string;
  last_updated: string;
}

export interface POItem {
  line_no: number;
  supplier_part_no: string;
  description: string;
  qty: number;
  oum: string;
  unit_price: number;
  total_price: number;
  // Mapping columns
  mapped_sku?: string;
  mapped_oum?: string;
  mapped_cost?: number;
  price_status?: "match" | "mismatch" | "unmapped";
  notes?: string;
}

export interface PurchaseOrder {
  po_number: string;
  vendor_name: string;
  vendor_address: string;
  date: string;
  total_amount: number;
  items: POItem[];
}

export interface SQLQueryResponse {
  success: boolean;
  columns?: string[];
  rows?: any[];
  affectedRows?: number;
  errorMessage?: string;
}

export interface SyncResult {
  mappedItems: POItem[];
  changesAppliedCount: number;
}
