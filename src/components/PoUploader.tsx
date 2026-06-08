/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, FileUp, Sparkles, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { PurchaseOrder } from "../types";

interface PoUploaderProps {
  onPoParsed: (po: PurchaseOrder) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (err: string | null) => void;
}

export default function PoUploader({ onPoParsed, isLoading, setIsLoading, error, setError }: PoUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read file as Base64 helper
  const processFile = (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported for Purchase Order extraction.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        
        const response = await fetch("/api/parse-po", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            pdfBase64: base64String,
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          onPoParsed(result.data);
          let successTxt = "Purchase Order successfully loaded! ";
          if (result.method === "fallbackSimulator") {
            successTxt += "(Simulation Mode - setup active Gemini key for real AI reading)";
          } else {
            successTxt += "(Extracted via Gemini AI)";
          }
          setSuccessMessage(successTxt);
        } else {
          setError(result.errorMessage || "Failed to parse Purchase Order.");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected network error occurred.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read local PDF file.");
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Instant pre-configured high-fidelity templates (Tesco, Zenith, Prime Material)
  const handleLoadTemplate = async (templateName: string) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSelectedFileName(templateName);

    try {
      const response = await fetch("/api/parse-po", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName: templateName }),
      });

      const result = await response.json();
      if (result.success) {
        onPoParsed(result.data);
        setSuccessMessage(`Successfully loaded premium prefilled template: ${templateName}`);
      } else {
        setError(result.errorMessage || "Failed to load template.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact database parser.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="po-uploader-card" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileUp className="w-5 h-5 text-indigo-600" />
            1. Upload Purchase Order Document
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Provide a physical Purchase Order PDF to automatically extract headings and line items.
          </p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragOver
            ? "border-indigo-500 bg-indigo-50/40"
            : "border-slate-200 hover:border-indigo-400 bg-slate-50/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ cursor: "pointer" }}
        id="drag-and-drop-zone"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf"
          className="hidden"
          id="hidden-pdf-input"
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="font-semibold text-slate-800 mt-3">Synthesizing & Parsing PDF with Gemini AI...</p>
            <p className="text-slate-500 text-xs mt-1 max-w-sm">
              Model gemini-3.5-flash is identifying table outlines, calculating numbers, and aligning purchase details.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="font-medium text-slate-800">
              Drag & Drop your Purchase Order PDF here, or{" "}
              <span className="text-indigo-600 underline hover:text-indigo-700">browse local files</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Accepts raw standard PDF documents</p>
          </div>
        )}
      </div>

      {/* Quick Demo Templates */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          No PO PDF ready? Load Instant Preset Scenarios
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            id="template-tesco-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleLoadTemplate("PO_Tesco_7761.pdf");
            }}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 text-xs text-left text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition active:scale-95 disabled:opacity-50"
          >
            <div>
              <p className="font-medium text-slate-900">PO_Tesco_7761.pdf</p>
              <p className="text-slate-500 text-[10px]">Tesco PO (3 items)</p>
            </div>
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded text-[9px]">LOAD</span>
          </button>

          <button
            id="template-zenith-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleLoadTemplate("PO_Zenith_Retail.pdf");
            }}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 text-xs text-left text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition active:scale-95 disabled:opacity-50"
          >
            <div>
              <p className="font-medium text-slate-900">PO_Zenith_Retail.pdf</p>
              <p className="text-slate-500 text-[10px]">Zenith Supply (1 item)</p>
            </div>
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded text-[9px]">LOAD</span>
          </button>

          <button
            id="template-prime-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleLoadTemplate("PO_Prime_Industries.pdf");
            }}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 text-xs text-left text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition active:scale-95 disabled:opacity-50"
          >
            <div>
              <p className="font-medium text-slate-900">PO_Prime_Industries.pdf</p>
              <p className="text-slate-500 text-[10px]">Prime supplier (2 items)</p>
            </div>
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded text-[9px]">LOAD</span>
          </button>
        </div>
      </div>

      {/* Notifications bar */}
      {error && (
        <div id="uploader-error" className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Failed to load Purchase Order:</span>
            {error}
          </div>
        </div>
      )}

      {successMessage && !error && (
        <div id="uploader-success" className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Fulfillment details structured:</span>
            {successMessage}
            {selectedFileName && <span className="block mt-1 text-emerald-600 font-mono">Doc: {selectedFileName}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
