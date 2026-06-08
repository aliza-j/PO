/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { 
  Database, Play, Terminal, HelpCircle, 
  CheckCircle2, AlertTriangle, RefreshCw, Layers 
} from "lucide-react";
import { InventoryItem, SQLQueryResponse } from "../types";

interface SqlConsoleProps {
  onDatabaseModified: () => void;
}

export default function SqlConsole({ onDatabaseModified }: SqlConsoleProps) {
  const [dbRows, setDbRows] = useState<InventoryItem[]>([]);
  const [sqlCommand, setSqlCommand] = useState("SELECT * FROM inventory");
  const [queryResponse, setQueryResponse] = useState<SQLQueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const fetchActiveDatabase = async () => {
    try {
      const response = await fetch("/api/db/inventory");
      const result = await response.json();
      if (result.success) {
        setDbRows(result.data);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  };

  useEffect(() => {
    fetchActiveDatabase();
  }, []);

  const handleExecuteSQL = async (queryToRun: string) => {
    setIsLoading(true);
    setErrorLocal(null);
    setQueryResponse(null);

    const targetQuery = queryToRun || sqlCommand;

    try {
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: targetQuery }),
      });

      const result = await response.json();
      if (result.success) {
        setQueryResponse(result);
        await fetchActiveDatabase(); // Refresh physical view
        onDatabaseModified(); // Notify upper panels to realign if pricing changed
      } else {
        setErrorLocal(result.errorMessage || "Unknown SQL compilation error.");
      }
    } catch (err: any) {
      setErrorLocal(err.message || "Failed to trigger SQL pipeline.");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Query macros
  const handleQuickCommand = (query: string) => {
    setSqlCommand(query);
    handleExecuteSQL(query);
  };

  return (
    <div id="sql-console-card" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
      
      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" />
          Active SQL Inventory Inventory Master Database
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Simulated stateful Relational Database. Modify values here using SQL to inspect the automated price sync updates.
        </p>
      </div>

      {/* Database Inventory Table View */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
          <Layers className="w-4 h-4 text-indigo-500" />
          TABLE: inventory (Pre-seeded Master Inventory)
        </h3>
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse" id="db-visual-table">
            <thead>
              <tr className="bg-slate-50/70 text-slate-500 text-[10px] uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="py-2.5 px-4 text-center">ID</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Item Name & Details</th>
                <th className="py-2.5 px-3 text-center">OUM</th>
                <th className="py-2.5 px-4 text-right">Inventory Target Cost</th>
                <th className="py-2.5 px-4 text-center">Last Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] text-slate-600">
              {dbRows.map((row) => (
                <tr key={row.sku} className="hover:bg-slate-50/30 transition-colors">
                  <td className="py-2.5 px-4 text-center font-bold text-slate-400 font-mono">{row.id}</td>
                  <td className="py-2.5 px-3 font-semibold text-indigo-700 font-mono">{row.sku}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-medium text-slate-800">{row.item_name}</p>
                    <p className="text-[10px] text-slate-400">{row.description}</p>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded font-semibold text-[9px]">{row.oum}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">${row.inventory_cost.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-center text-slate-400 text-[10px]">{row.last_updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Console terminal component */}
      <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 text-slate-200">
        <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-bold font-mono text-emerald-400">
            <Terminal className="w-4 h-4" />
            Interactive SQL Command Center
          </span>
          <span className="text-[10px]">Relational simulation active</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              id="raw-sql-terminal-input"
              value={sqlCommand}
              onChange={(e) => setSqlCommand(e.target.value)}
              placeholder="e.g. SELECT * FROM inventory WHERE sku = 'SKU-SLT-90'"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
            />
          </div>
          <button
            id="run-sql-btn"
            onClick={() => handleExecuteSQL(sqlCommand)}
            disabled={isLoading}
            className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Execute SQL
          </button>
        </div>

        {/* Quick Query Shortcuts */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button
            id="macro-select-all"
            onClick={() => handleQuickCommand("SELECT * FROM inventory")}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 px-2 py-1 rounded font-mono transition"
          >
            SELECT ALL
          </button>
          <button
            id="macro-slt-update"
            onClick={() => handleQuickCommand("UPDATE inventory SET inventory_cost = 135.00 WHERE sku = 'SKU-SLT-90'")}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 px-2 py-1 rounded font-mono transition"
          >
            UPDATE Sealant cost to $135
          </button>
          <button
            id="macro-copper-update"
            onClick={() => handleQuickCommand("UPDATE inventory SET inventory_cost = 25.00 WHERE sku = 'SKU-COP-10'")}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 px-2 py-1 rounded font-mono transition"
          >
            UPDATE Copper cost to $25
          </button>
        </div>

        {/* Query output message panels */}
        {errorLocal && (
          <div id="sql-console-error" className="mt-4 p-3 bg-rose-950/40 border border-rose-900/40 rounded-lg flex items-start gap-2 text-rose-300 text-[11px] font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-rose-400">Syntax / Table Error:</span>
              {errorLocal}
            </div>
          </div>
        )}

        {queryResponse && (
          <div id="sql-console-success" className="mt-4 p-3 bg-emerald-950/40 border border-emerald-900/40 rounded-lg text-[11px] font-mono text-emerald-300">
            <p className="font-semibold mb-1 text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              SQL command executed successfully.
            </p>
            {queryResponse.affectedRows !== undefined && (
              <p>Rows Affected: {queryResponse.affectedRows}</p>
            )}

            {queryResponse.rows && queryResponse.rows.length > 0 && (
              <div className="mt-2 overflow-x-auto max-h-[140px]">
                <table className="w-full text-left font-mono text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-emerald-900 text-emerald-500">
                      {queryResponse.columns?.map(col => (
                        <th key={col} className="pb-1 px-2">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResponse.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-emerald-900/30 hover:bg-emerald-900/10">
                        {queryResponse.columns?.map(col => (
                          <td key={col} className="py-1 px-2 text-slate-300">{row[col] !== undefined ? String(row[col]) : "NULL"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
