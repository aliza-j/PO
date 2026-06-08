/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  FileSpreadsheet, Database, Play, Sparkles, RefreshCw, 
  HelpCircle, ArrowRightLeft, Cpu, ShieldCheck, CheckSquare, Layers 
} from "lucide-react";
import PoUploader from "./components/PoUploader";
import MappingGrid from "./components/MappingGrid";
import SqlConsole from "./components/SqlConsole";
import Exporter from "./components/Exporter";
import { PurchaseOrder, POItem } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"workspace" | "database">("workspace");
  const [poData, setPoData] = useState<PurchaseOrder | null>(null);
  const [mappedItems, setMappedItems] = useState<POItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploaderError, setUploaderError] = useState<string | null>(null);
  const [databaseRefreshKey, setDatabaseRefreshKey] = useState(0);

  // Triggered when mapping grid completes automatic/manual mappings
  const handleItemsMapped = (items: POItem[]) => {
    setMappedItems(items);
  };

  // Called when raw SQL affects pricing rows, requiring the grid to reload costs
  const handleDatabaseModified = () => {
    setDatabaseRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans flex flex-col antialiased">
      
      {/* Visual Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Main Titles */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950 font-sans tracking-tight">
                PO to Excel & DTA Sync System
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Automated purchase order parsing, SQL database alignment, pricing cost optimization, and final TU DTA processing file compilation.
              </p>
            </div>
          </div>

          {/* Tab Selector & Sandbox Indicator */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              <button
                id="tab-workspace-btn"
                onClick={() => setActiveTab("workspace")}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === "workspace"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                DTA Mapping Hub
              </button>
              <button
                id="tab-database-btn"
                onClick={() => setActiveTab("database")}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === "database"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                SQL Inventory Database
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100/50 rounded-xl text-[11px] font-semibold text-indigo-700 font-sans shadow-sm shadow-indigo-50/50">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              Secure Sandbox
            </div>
          </div>

        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab === "workspace" ? (
          
          /* Full extraction mapping sequence workflow */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="mapping-hub-workspace">
            
            {/* Left side actions control and guidelines */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Uploader Box */}
              <PoUploader 
                onPoParsed={(parsed) => setPoData(parsed)}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                error={uploaderError}
                setError={setUploaderError}
              />

              {/* System Overview Instruction Guidelines */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  Operator Task Instruction List
                </h3>
                <ul className="text-xs text-slate-600 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <span>
                      Upload a Purchase Order PDF in the uploader box, or select an instant demo template to load state files.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <span>
                      The system automatically maps the items, lookups SKU details, and highlights price variances against the SQL Master definitions.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <span>
                      Prices are automatically synchronized and updated to current inventory costs. Check line status on the table.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] shrink-0 mt-0.5">4</span>
                    <span>
                      Verify the aligned data and download your compiled Excel file, or generate the TU DTA transmission file for final accounting processing tasks.
                    </span>
                  </li>
                </ul>
              </div>

            </div>

            {/* Right side data mapping dashboard and exporter controls */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Step 2 mapping grid */}
              <MappingGrid 
                po={poData}
                onItemsMapped={handleItemsMapped}
                databaseRefreshKey={databaseRefreshKey}
              />

              {/* Step 3 exports */}
              <Exporter 
                po={poData} 
                mappedItems={mappedItems} 
              />

            </div>

          </div>
        ) : (
          
          /* Relational Database Editor and interactive SQL Terminal */
          <div className="flex flex-col gap-6 max-w-4xl mx-auto" id="sql-database-workspace">
            <SqlConsole 
              onDatabaseModified={handleDatabaseModified}
            />
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 mt-12 flex justify-between px-6">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">
          <p>
            PO to Excel & DTA Sync System &copy; 2026. Designed with professional visual alignment.
          </p>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded">Express Node v22</span>
            <span>&bull;</span>
            <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded">Gemini-3.5-flash</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
