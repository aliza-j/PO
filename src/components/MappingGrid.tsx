/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { 
  FileSpreadsheet, Database, RefreshCw, AlertTriangle, 
  CheckCircle2, Info, Edit3, HelpCircle, ArrowRightLeft, Sparkles 
} from "lucide-react";
import { PurchaseOrder, POItem, InventoryItem } from "../types";

interface MappingGridProps {
  po: PurchaseOrder | null;
  onItemsMapped: (mappedItems: POItem[]) => void;
  databaseRefreshKey?: number;
}

export default function MappingGrid({ po, onItemsMapped, databaseRefreshKey }: MappingGridProps) {
  const [dbItems, setDbItems] = useState<InventoryItem[]>([]);
  const [mappedItems, setMappedItems] = useState<POItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [tempSku, setTempSku] = useState("");
  const [tempCost, setTempCost] = useState<number>(0);
  const [tempOum, setTempOum] = useState("");

  // Fetch current database items
  const fetchInventory = async () => {
    try {
      const response = await fetch("/api/db/inventory");
      const result = await response.json();
      if (result.success) {
        setDbItems(result.data);
        return result.data as InventoryItem[];
      }
    } catch (err) {
      console.error("Failed to sync database inventory list:", err);
    }
    return [];
  };

  // Perform relational SQL matching
  const executeDataMapping = async (invoiceData: PurchaseOrder, freshDb: InventoryItem[]) => {
    const logs: string[] = [];
    logs.push(`Initializing automated database sync for order ${invoiceData.po_number || "A/N"}`);

    const mapped = invoiceData.items.map((item) => {
      // 1. Attempt heuristics matching (e.g., match partial SKU or supplier_part_no)
      let matchedDb = freshDb.find(db => {
        const itemCode = (item.supplier_part_no || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const dbSku = db.sku.toLowerCase().replace(/[^a-z0-9]/g, "");
        const dbName = db.item_name.toLowerCase().replace(/[^a-z0-9]/g, "");
        
        return dbSku.includes(itemCode) || 
               itemCode.includes(dbSku) || 
               (item.description && dbName.includes(item.description.toLowerCase())) ||
               (item.description && item.description.toLowerCase().includes(db.sku.toLowerCase()));
      });

      // Default fallback match if supplier_part_no matches id/last digits
      if (!matchedDb && item.line_no <= freshDb.length) {
        matchedDb = freshDb[item.line_no - 1];
        logs.push(`Line ${item.line_no}: Heuristics fallback matched to ${matchedDb.sku} based on document position.`);
      }

      const initialMappedItem: POItem = {
        ...item,
        mapped_sku: matchedDb ? matchedDb.sku : "SKU-COP-10", // Default fallback if still unmapped
        mapped_oum: matchedDb ? matchedDb.oum : item.oum,
        mapped_cost: matchedDb ? matchedDb.inventory_cost : item.unit_price,
        notes: item.notes || ""
      };

      // Ensure pricing is automatically updated to match current inventory costs!
      if (matchedDb) {
        if (matchedDb.inventory_cost !== item.unit_price) {
          initialMappedItem.price_status = "mismatch";
          initialMappedItem.mapped_cost = matchedDb.inventory_cost; // Override with current inventory cost
          initialMappedItem.total_price = Number((item.qty * matchedDb.inventory_cost).toFixed(2));
          initialMappedItem.notes = `Price reconciled. PO cost $${item.unit_price.toFixed(2)} -> Synced SQL Inventory cost: $${matchedDb.inventory_cost.toFixed(2)}`;
          logs.push(`Line ${item.line_no}: Price mismatch found ($${item.unit_price} vs SQL Cost $${matchedDb.inventory_cost}). Automatically matched & synced to match current inventory costs.`);
        } else {
          initialMappedItem.price_status = "match";
          initialMappedItem.notes = `Successfully mapped & synced with SQL database.`;
          logs.push(`Line ${item.line_no}: Matched ${matchedDb.sku} perfectly with SQL database values.`);
        }
      } else {
        initialMappedItem.price_status = "unmapped";
        logs.push(`Line ${item.line_no}: SKU ${item.supplier_part_no || "N/A"} was not found in SQL database. Assigned default SKU for mapping correction.`);
      }

      return initialMappedItem;
    });

    setMappedItems(mapped);
    onItemsMapped(mapped);
    setSyncLogs(logs);
  };

  // Run on mount or when PO changes
  useEffect(() => {
    const initialize = async () => {
      const dbList = await fetchInventory();
      if (po) {
        await executeDataMapping(po, dbList);
      }
    };
    initialize();
  }, [po, databaseRefreshKey]);

  // Handle SKU mapping manual override
  const handleSkuChange = (idx: number, newSku: string) => {
    const match = dbItems.find(db => db.sku === newSku);
    const updated = [...mappedItems];
    if (match) {
      updated[idx] = {
        ...updated[idx],
        mapped_sku: match.sku,
        mapped_oum: match.oum,
        mapped_cost: match.inventory_cost,
        price_status: match.inventory_cost !== updated[idx].unit_price ? "mismatch" : "match",
        total_price: Number((updated[idx].qty * match.inventory_cost).toFixed(2)),
        notes: `Overridden to SQL item: ${match.item_name}. Base cost synchronized.`
      };
      setSyncLogs(prev => [...prev, `Manual override (Line ${idx + 1}): Set SKU to ${newSku}. Cost synced to Current inventory cost $${match.inventory_cost}.`]);
    } else {
      updated[idx] = {
        ...updated[idx],
        mapped_sku: newSku,
        price_status: "unmapped"
      };
    }
    setMappedItems(updated);
    onItemsMapped(updated);
  };

  const startEditing = (idx: number, item: POItem) => {
    setEditingIndex(idx);
    setTempSku(item.mapped_sku || "");
    setTempOum(item.mapped_oum || "");
    setTempCost(item.mapped_cost || item.unit_price || 0);
    setTempNotes(item.notes || "");
  };

  const saveInlineEdits = (idx: number) => {
    const updated = [...mappedItems];
    updated[idx] = {
      ...updated[idx],
      mapped_sku: tempSku,
      mapped_oum: tempOum,
      mapped_cost: tempCost,
      total_price: Number((updated[idx].qty * tempCost).toFixed(2)),
      price_status: (tempCost !== updated[idx].unit_price) ? "mismatch" : "match",
      notes: tempNotes || "Manually updated variables."
    };
    setMappedItems(updated);
    onItemsMapped(updated);
    setEditingIndex(null);
    setSyncLogs(prev => [...prev, `Line ${idx + 1}: Applied manual cell adjustment: SKU=${tempSku}, Cost=$${tempCost}, OUM=${tempOum}.`]);
  };

  const triggerTotalReSync = async () => {
    setSyncLogs(prev => [...prev, "Manually refreshing SQL database references..."]);
    const refreshedDb = await fetchInventory();
    if (po) {
      await executeDataMapping(po, refreshedDb);
    }
  };

  if (!po) {
    return (
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center text-slate-400">
        <div className="max-w-xs mx-auto">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Metadata Sync Ready</p>
          <p className="text-xs text-slate-400 mt-1">
            Upload or specify a purchase order document in step 1 to automatically view, translate, and sync mapping attributes.
          </p>
        </div>
      </div>
    );
  }

  // Calculate savings metrics from the auto-price cost mapping
  const activeVariance = mappedItems.reduce((acc, item) => {
    const originalLineSum = item.qty * item.unit_price;
    const syncedLineSum = item.qty * (item.mapped_cost || item.unit_price);
    return acc + (originalLineSum - syncedLineSum);
  }, 0);

  return (
    <div id="mapping-center-card" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6 animate-fade-in">
      
      {/* Master details header panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            2. Database Relational Cost Alignment
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Prices are automatically synced to match actual real-time inventory costs from the SQL Server tables.
          </p>
        </div>
        <button
          id="manual-resync-btn"
          onClick={triggerTotalReSync}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-600 font-medium bg-indigo-50 hover:bg-indigo-100 rounded-lg transition active:scale-95 shrink-0 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Re-Sync SQL Db
        </button>
      </div>

      {/* PO Metadata Summary Block */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-100">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">PO Number</span>
          <span id="po-meta-num" className="text-sm font-semibold text-slate-800 font-mono">{po.po_number || "Draft"}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Vendor Name</span>
          <span id="po-meta-vendor" className="text-sm font-semibold text-slate-800 truncate block">{po.vendor_name || "N/A"}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Issue Date</span>
          <span id="po-meta-date" className="text-sm font-semibold text-slate-800">{po.date || "N/A"}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider block">Original PO Value</span>
          <span id="po-meta-total" className="text-sm font-semibold text-slate-800">${po.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</span>
        </div>
      </div>

      {/* Real-time price update banner */}
      {Math.abs(activeVariance) > 0.01 && (
        <div id="cost-aligned-banner" className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3 text-indigo-800 text-xs animate-pulse">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Cost Optimization Shield Active:</strong> Price mismatch aligned with inventory master cost definitions.
            </span>
          </div>
          <div className="font-bold text-indigo-900 bg-white/80 px-2 py-0.5 rounded border border-indigo-100">
            {activeVariance > 0 ? "Supplier Saving" : "Adjustment"}: ${Math.abs(activeVariance).toFixed(2)}
          </div>
        </div>
      )}

      {/* Mapping Data Grid Table */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left border-collapse" id="mapping-data-table">
          <thead>
            <tr className="bg-slate-50/70 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-100">
              <th className="py-3 px-4 text-center">L#</th>
              <th className="py-3 px-3">PO Raw item</th>
              <th className="py-3 px-3 text-center">Qty / OUM</th>
              <th className="py-3 px-3 text-right">PO Price</th>
              <th className="py-3 px-4 bg-indigo-50/20 text-indigo-800">Mapped SKU (SQL Link)</th>
              <th className="py-3 px-3 bg-indigo-50/20 text-indigo-800 text-center">OUM</th>
              <th className="py-3 px-4 bg-indigo-50/20 text-indigo-800 text-right">Inventory Cost (SQL)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {mappedItems.map((item, idx) => {
              const isEditing = editingIndex === idx;

              return (
                <tr key={idx} className={`hover:bg-slate-50/40 transition-colors ${item.price_status === "mismatch" ? "bg-amber-50/10" : ""}`}>
                  {/* Line Number */}
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-400 font-mono">
                    {item.line_no}
                  </td>

                  {/* PO Raw Data */}
                  <td className="py-3.5 px-3 max-w-[180px]">
                    <p className="font-medium text-slate-900 truncate" title={item.description}>{item.description}</p>
                    <span className="text-[10px] text-slate-400 font-mono block">Supplier PN: {item.supplier_part_no || "N/A"}</span>
                  </td>

                  {/* Qty / OUM */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="font-semibold text-slate-800">{item.qty}</span>
                    <span className="text-[10px] text-slate-400 ml-1">({item.oum})</span>
                  </td>

                  {/* PO Unit Price */}
                  <td className="py-3.5 px-3 text-right font-medium text-slate-600">
                    ${item.unit_price.toFixed(2)}
                  </td>

                  {/* MAPPED SKU (EDITABLE/SYNCED) */}
                  <td className="py-3.5 px-4 bg-indigo-50/10 font-medium">
                    {isEditing ? (
                      <select
                        value={tempSku}
                        onChange={(e) => {
                          setTempSku(e.target.value);
                          const matched = dbItems.find(x => x.sku === e.target.value);
                          if (matched) {
                            setTempCost(matched.inventory_cost);
                            setTempOum(matched.oum);
                          }
                        }}
                        className="w-full text-xs border border-slate-300 rounded px-1.5 py-1 bg-white"
                        style={{ maxWidth: "140px" }}
                        id={`edit-sku-select-${idx}`}
                      >
                        {dbItems.map(db => (
                          <option key={db.id} value={db.sku}>{db.sku} ({db.item_name.substring(0, 15)}...)</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-indigo-700 font-mono">{item.mapped_sku}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                          - {dbItems.find(x => x.sku === item.mapped_sku)?.item_name || "Assigned"}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Mapped OUM */}
                  <td className="py-3.5 px-3 bg-indigo-50/10 text-center font-mono">
                    {isEditing ? (
                      <input
                        type="text"
                        value={tempOum}
                        onChange={(e) => setTempOum(e.target.value)}
                        className="w-12 text-center text-xs border border-slate-300 rounded px-1.5 py-1 bg-white uppercase"
                        id={`edit-oum-input-${idx}`}
                      />
                    ) : (
                      <span className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-bold text-[10px]">{item.mapped_oum || item.oum}</span>
                    )}
                  </td>

                  {/* CURRENT SQL INVENTORY COST (Price auto-syncing column) */}
                  <td className="py-3.5 px-4 bg-indigo-50/15 text-right font-semibold text-indigo-900 font-mono">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempCost}
                        onChange={(e) => setTempCost(parseFloat(e.target.value) || 0)}
                        className="w-20 text-right text-xs border border-slate-300 rounded px-1.5 py-1 bg-white"
                        id={`edit-cost-input-${idx}`}
                      />
                    ) : (
                      <span>${Number(item.mapped_cost || item.unit_price).toFixed(2)}</span>
                    )}
                  </td>

                  {/* STATUS */}
                  <td className="py-3.5 px-4">
                    {item.price_status === "match" ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        SQL Matched
                      </span>
                    ) : item.price_status === "mismatch" ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded-full border border-amber-100 self-start">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Cost Re-aligned
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5">PO was ${item.unit_price.toFixed(2)}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-full border border-slate-200">
                        <Info className="w-3 h-3" />
                        Adjusted
                      </span>
                    )}
                  </td>

                  {/* ACTIONS */}
                  <td className="py-3.5 px-3 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          id={`save-btn-${idx}`}
                          onClick={() => saveInlineEdits(idx)}
                          className="bg-indigo-600 text-white font-bold px-2 py-1 text-[10px] rounded hover:bg-indigo-700 active:scale-95 transition"
                        >
                          Save
                        </button>
                        <button
                          id={`cancel-btn-${idx}`}
                          onClick={() => setEditingIndex(null)}
                          className="text-slate-500 hover:text-slate-800 text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        id={`edit-btn-${idx}`}
                        onClick={() => startEditing(idx, item)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                        title="Edit mapping parameters"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Relational Alignment Logs Drawer */}
      <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-4">
        <h3 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
          SQL Dynamic Matching Console Logs
        </h3>
        <div className="font-mono text-[10px] text-slate-500 bg-white border border-slate-100 rounded-lg p-3 max-h-[110px] overflow-y-auto space-y-1">
          {syncLogs.length === 0 ? (
            <p className="italic text-slate-400">Loading sync pipeline status...</p>
          ) : (
            syncLogs.map((log, lIdx) => (
              <p key={lIdx} className="break-all">
                <span className="text-indigo-500 font-bold mr-1">[{new Date().toLocaleTimeString()}]</span>
                {log}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
