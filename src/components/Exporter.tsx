/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Download, FileSpreadsheet, Code2, Sparkles, CheckCircle2, RefreshCw } from "lucide-react";
import { PurchaseOrder, POItem } from "../types";

interface ExporterProps {
  po: PurchaseOrder | null;
  mappedItems: POItem[];
}

export default function Exporter({ po, mappedItems }: ExporterProps) {
  const [formatSpec, setFormatSpec] = useState<"standard-fixed" | "delimited">("standard-fixed");
  const [dtaPreview, setDtaPreview] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Re-generate TU DTA preview whenever configurations change
  useEffect(() => {
    if (!po || mappedItems.length === 0) return;

    const lines: string[] = [];
    const poNumStr = String(po.po_number || "PO-UNKNOWN").padEnd(15).substring(0, 15);
    const vendorStr = String(po.vendor_name || "VENDOR").padEnd(30).substring(0, 30);
    const dateStr = String(po.date || new Date().toISOString().split("T")[0]).replace(/-/g, "");

    if (formatSpec === "standard-fixed") {
      lines.push(`H|${poNumStr}|${vendorStr}|${dateStr}|${String(mappedItems.length).padStart(4, "0")}`);
      mappedItems.forEach((item, idx) => {
        const lineNoStr = String(idx + 1).padStart(3, "0");
        const skuStr = String(item.mapped_sku || "UNMAPPED").padEnd(15).substring(0, 15);
        const qtyStr = String(item.qty || 0).padStart(6, "0");
        const oumStr = String(item.mapped_oum || item.oum || "PCS").padEnd(3).substring(0, 3);
        const priceStr = Number(item.mapped_cost || item.unit_price || 0).toFixed(2).padStart(10, "0");
        const subtotalStr = (Number(item.qty || 0) * Number(item.mapped_cost || item.unit_price || 0)).toFixed(2).padStart(12, "0");

        lines.push(`I|${lineNoStr}|${skuStr}|${qtyStr}|${oumStr}|${priceStr}|${subtotalStr}`);
      });
      const grandGenTotal = mappedItems.reduce((sum, it) => sum + (Number(it.qty) * Number(it.mapped_cost || it.unit_price)), 0);
      const totalQty = mappedItems.reduce((sum, it) => sum + Number(it.qty), 0);
      lines.push(`F|${String(totalQty).padStart(8, "0")}|${grandGenTotal.toFixed(2).padStart(15, "0")}`);
    } else {
      lines.push(`DTAPO^HDR^${po.po_number || "NA"}^${vendorStr.trim()}^${dateStr}`);
      mappedItems.forEach((item, idx) => {
        lines.push(`DTAPO^ITM^${idx+1}^${item.mapped_sku || "UNMAPPED"}^${item.qty}^${item.mapped_oum || item.oum}^${item.mapped_cost || item.unit_price}`);
      });
      const grandGenTotal = mappedItems.reduce((sum, it) => sum + (Number(it.qty) * Number(it.mapped_cost || it.unit_price)), 0);
      lines.push(`DTAPO^SUM^${mappedItems.length}^${grandGenTotal.toFixed(2)}`);
    }

    setDtaPreview(lines.join("\n"));
  }, [po, mappedItems, formatSpec]);

  const triggerExcelDownload = async () => {
    if (!po) return;
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_number: po.po_number,
          items: mappedItems
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PO_${po.po_number || "mapped"}_converted.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to generate Excel download link:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerDtaDownload = async () => {
    if (!po) return;
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-dta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poMaster: po,
          items: mappedItems,
          formatSpec: formatSpec
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TU_DTA_${po.po_number || "export"}.dta`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download DTA:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!po) return null;

  return (
    <div id="export-processing-card" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6 animate-fade-in">
      
      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-600" />
          3. Generate Export Deliverables
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Generate the final Excel converted spreadsheets for billing analysis, and compile raw TU DTA transaction tables.
        </p>
      </div>

      {/* Button Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Excel Button */}
        <button
          id="download-excel-btn"
          onClick={triggerExcelDownload}
          disabled={isGenerating}
          className="flex items-center justify-between p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 rounded-xl text-left text-emerald-900 font-semibold text-sm transition active:scale-95 disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-lg shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900">Compile & Export Excel</p>
              <p className="text-emerald-700/80 font-normal text-xs mt-0.5">Custom comma-separated excel spreadsheet with matched inventory headers.</p>
            </div>
          </div>
          <Download className="w-5 h-5 text-emerald-600 shrink-0 ml-4 animate-bounce" />
        </button>

        {/* TU DTA Button */}
        <button
          id="download-dta-btn"
          onClick={triggerDtaDownload}
          disabled={isGenerating}
          className="flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 rounded-xl text-left text-indigo-900 font-semibold text-sm transition active:scale-95 disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-lg shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-indigo-900">Download TU DTA File</p>
              <p className="text-indigo-700/80 font-normal text-xs mt-0.5">Generate highly parsed .dta EDI processing block segment sequences.</p>
            </div>
          </div>
          <Download className="w-5 h-5 text-indigo-600 shrink-0 ml-4 animate-bounce" />
        </button>
      </div>

      {/* DTA Format customization options */}
      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            TU DTA Structure Format Configuration
          </label>
          <div className="flex bg-white p-1 rounded-lg border border-slate-200">
            <button
              id="spec-fixed-btn"
              onClick={() => setFormatSpec("standard-fixed")}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition ${
                formatSpec === "standard-fixed"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Standard Fixed Width
            </button>
            <button
              id="spec-delim-btn"
              onClick={() => setFormatSpec("delimited")}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition ${
                formatSpec === "delimited"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Delimited Caret Segment
            </button>
          </div>
        </div>

        {/* Text Area Preview showing exact formatting content */}
        <div className="relative">
          <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 bg-slate-800 text-[9px] text-indigo-300 font-bold font-mono rounded select-none uppercase">
            {formatSpec} preview
          </span>
          <pre 
            id="dta-rendered-preview"
            className="font-mono text-[10.5px] leading-relaxed text-slate-300 bg-slate-900 border border-slate-800 rounded-lg p-4 max-h-[180px] overflow-y-auto block whitespace-pre"
          >
            {dtaPreview}
          </pre>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 italic">
          * TU DTA outputs are prepared precisely to run invoice match validation, alignment processes, and financial ledgers.
        </p>
      </div>
    </div>
  );
}
