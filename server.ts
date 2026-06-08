/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini API client safely
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini client successfully initialized.");
  } else {
    console.warn("GEMINI_API_KEY not found in environment. Falling back to structured parsing simulator for quick trial.");
  }
} catch (err) {
  console.error("Failed to initialize GoogleGenAI client:", err);
}

// ---------------------------------------------------------
// RELATIONAL SQL DATABASE SIMULATOR (Stateful In-Memory)
// ---------------------------------------------------------
interface DBItem {
  id: number;
  sku: string;
  item_name: string;
  oum: string;
  inventory_cost: number;
  description: string;
  last_updated: string;
}

let sqlDatabase: DBItem[] = [
  { id: 1, sku: "SKU-COP-10", item_name: "Copper Tube 1/2 Inch", oum: "MTR", inventory_cost: 14.85, description: "Heavy duty copper tubing for plumbing", last_updated: "2026-06-01" },
  { id: 2, sku: "SKU-PVC-40", item_name: "PVC Pipe Class D 4 Inch", oum: "PCS", inventory_cost: 23.50, description: "High pressure vinyl water conduit", last_updated: "2026-06-02" },
  { id: 3, sku: "SKU-SLT-90", item_name: "Industrial Sealant T-90", oum: "CAN", inventory_cost: 112.00, description: "Anti-corrosion high-strength sealant", last_updated: "2026-06-03" },
  { id: 4, sku: "SKU-BRS-02", item_name: "Brass Connector Female", oum: "BOX", inventory_cost: 89.90, description: "15mm double-threaded fittings, box of 50", last_updated: "2026-06-05" },
  { id: 5, sku: "SKU-ELB-90", item_name: "Stainless Steel Elbow 90D", oum: "PCS", inventory_cost: 8.40, description: "90-degree threaded elbow connectors", last_updated: "2026-06-04" },
  { id: 6, sku: "SKU-VLV-GE", item_name: "Brass Gate Valve 2 Inch", oum: "PCS", inventory_cost: 48.00, description: "Heavily reinforced brass gate mechanism", last_updated: "2026-06-06" },
  { id: 7, sku: "SKU-FST-12", item_name: "Grade 8 Steel Anchor Anchor", oum: "BOX", inventory_cost: 115.50, description: "High tensile steel concrete anchors (100pcs)", last_updated: "2026-06-07" },
];

/**
 * Execute a highly lightweight, simulated SQL parser supporting:
 * - SELECT * FROM inventory
 * - SELECT * FROM inventory WHERE sku = '...'
 * - UPDATE inventory SET inventory_cost = X WHERE sku = '...' or id = X
 * - UPDATE inventory SET oum = '...' WHERE id = X
 */
function executeSimulatedSQL(query: string): { success: boolean; columns?: string[]; rows?: any[]; affectedRows?: number; errorMessage?: string } {
  try {
    const cleanQuery = query.trim().replace(/\s+/g, " ").replace(/;$/, "");
    const selectRegex = /^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i;
    const updateRegex = /^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i;

    if (selectRegex.test(cleanQuery)) {
      const match = cleanQuery.match(selectRegex);
      if (!match) throw new Error("Could not parse SELECT query");
      
      const fieldsStr = match[1].trim();
      const tableName = match[2].trim().toLowerCase();
      const whereClause = match[3] ? match[3].trim() : null;

      if (tableName !== "inventory") {
        return { success: false, errorMessage: `Table '${tableName}' does not exist. Available tables: inventory` };
      }

      let filteredData = [...sqlDatabase];

      // Crude WHERE clause parsing/evaluating
      if (whereClause) {
        // e.g., sku = 'SKU-SLT-90' or id = 3 or inventory_cost > 10
        const equalsMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/i);
        if (equalsMatch) {
          const col = equalsMatch[1].toLowerCase();
          const val = equalsMatch[2];
          filteredData = filteredData.filter((item: any) => {
            if (col === "id") return item.id === parseInt(val, 10);
            if (col === "sku") return item.sku.toLowerCase() === val.toLowerCase();
            if (col === "oum") return item.oum.toLowerCase() === val.toLowerCase();
            return String(item[col]).toLowerCase() === val.toLowerCase();
          });
        }
      }

      // Project fields
      const allCols = ["id", "sku", "item_name", "oum", "inventory_cost", "description", "last_updated"];
      let columns = fieldsStr === "*" ? allCols : fieldsStr.split(",").map(f => f.trim().toLowerCase());
      
      const rows = filteredData.map((item: any) => {
        const rowObj: any = {};
        columns.forEach(col => {
          rowObj[col] = item[col];
        });
        return rowObj;
      });

      return { success: true, columns, rows };
    } 
    
    if (updateRegex.test(cleanQuery)) {
      const match = cleanQuery.match(updateRegex);
      if (!match) throw new Error("Could not parse UPDATE query");
      
      const tableName = match[1].trim().toLowerCase();
      const setClause = match[2].trim();
      const whereClause = match[3] ? match[3].trim() : null;

      if (tableName !== "inventory") {
        return { success: false, errorMessage: `Table '${tableName}' does not exist.` };
      }

      // Parse SET fields e.g. inventory_cost = 12.50, description = 'new dec'
      const setPairs = setClause.split(",").map(p => p.trim());
      const updates: any = {};
      
      setPairs.forEach(pair => {
        const eqIdx = pair.indexOf("=");
        if (eqIdx === -1) return;
        const col = pair.substring(0, eqIdx).trim().toLowerCase();
        let val = pair.substring(eqIdx + 1).trim();
        // remove outer quotes if string
        if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          val = val.substring(1, val.length - 1);
        }
        
        if (col === "inventory_cost" || col === "id") {
          updates[col] = parseFloat(val);
        } else {
          updates[col] = val;
        }
      });

      let affectedRows = 0;
      sqlDatabase = sqlDatabase.map((item: any) => {
        let match = false;
        if (!whereClause) {
          match = true; // Updates all if no where clause
        } else {
          const equalsMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/i);
          if (equalsMatch) {
            const col = equalsMatch[1].toLowerCase();
            const val = equalsMatch[2];
            if (col === "id" && item.id === parseInt(val, 10)) match = true;
            else if (col === "sku" && item.sku.toLowerCase() === val.toLowerCase()) match = true;
            else if (String(item[col]).toLowerCase() === val.toLowerCase()) match = true;
          }
        }

        if (match) {
          affectedRows++;
          return {
            ...item,
            ...updates,
            last_updated: new Date().toISOString().split("T")[0]
          };
        }
        return item;
      });

      return { success: true, affectedRows };
    }

    return { 
      success: false, 
      errorMessage: "Unsupported SQL Command. This database simulator currently supports 'SELECT * FROM inventory' optionally filtered by SKU / ID, or 'UPDATE inventory SET inventory_cost = XX WHERE sku = ...'." 
    };
  } catch (error: any) {
    return { success: false, errorMessage: `SQL Execution Error: ${error.message}` };
  }
}

// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

// Retrieve active SQL inventory representation
app.get("/api/db/inventory", (req, res) => {
  res.json({ success: true, data: sqlDatabase });
});

// Run a custom SQL query directly (SQL Console)
app.post("/api/db/query", (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, errorMessage: "Missing query input." });
  }
  const result = executeSimulatedSQL(query);
  res.json(result);
});

// Simple direct helper to set dynamic inventory costs
app.post("/api/db/update-cost", (req, res) => {
  const { sku, cost } = req.body;
  if (!sku || cost === undefined) {
    return res.status(400).json({ success: false, errorMessage: "Missing sku or cost." });
  }
  const result = executeSimulatedSQL(`UPDATE inventory SET inventory_cost = ${cost} WHERE sku = '${sku}'`);
  res.json(result);
});

// Mock templates mapping data for instant previews without an API key
const samplePoTemplates: Record<string, any> = {
  "PO_Tesco_7761.pdf": {
    po_number: "PO-7761009",
    vendor_name: "Tesco Stores Ltd",
    vendor_address: "Tesco House, Shire Park, Welwyn Garden City AL7 1GA, UK",
    date: "2026-06-02",
    total_amount: 11210.00,
    items: [
      { line_no: 1, supplier_part_no: "PVC40-4IN", description: "PVC Pipe Class D 4 Inch (Extracted)", qty: 200, oum: "PCS", unit_price: 26.50, total_price: 5300.00 },
      { line_no: 2, supplier_part_no: "BRS-CONN", description: "Brass Connector Female (Extracted)", qty: 50, oum: "BOX", unit_price: 98.20, total_price: 4910.00 },
      { line_no: 3, supplier_part_no: "ELBOW-90", description: "Stainless Steel Elbow 90D (Extracted)", qty: 100, oum: "PCS", unit_price: 10.00, total_price: 1000.00 }
    ]
  },
  "PO_Zenith_Retail.pdf": {
    po_number: "PO-ZE-3401",
    vendor_name: "Zenith Retail Group",
    vendor_address: "100 Innovation Parkway, Suite 400, Singapore 138637",
    date: "2026-06-04",
    total_amount: 22800.00,
    items: [
      { line_no: 1, supplier_part_no: "SLT90-CAN", description: "Industrial Sealant T-90 High Protection", qty: 200, oum: "CAN", unit_price: 114.00, total_price: 22800.00 }
    ]
  },
  "PO_Prime_Industries.pdf": {
    po_number: "PO-PRIME-223",
    vendor_name: "Prime Materials Supply",
    vendor_address: "Northstar Industrial Zone, Building 8B, Kuala Lumpur",
    date: "2026-06-06",
    total_amount: 10738.50,
    items: [
      { line_no: 1, supplier_part_no: "COP-TUBE-12", description: "Heavy Duty Copper Tube 1/2 Inch", qty: 350, oum: "MTR", unit_price: 15.50, total_price: 5425.00 },
      { line_no: 2, supplier_part_no: "STEEL-ANCH", description: "Grade 8 Steel Anchor heavy standard", qty: 45, oum: "BOX", unit_price: 118.00, total_price: 5313.00 }
    ]
  }
};

// Purchase Order PDF parsing endpoint via server-side Gemini API (using @google/genai)
app.post("/api/parse-po", async (req, res) => {
  const { fileName, pdfBase64 } = req.body;
  
  if (!pdfBase64 && !fileName) {
    return res.status(400).json({ success: false, errorMessage: "No PDF data or fileName provided." });
  }

  // If a pre-configured demo template was chosen, load its pre-compiled model output instantly (super useful fallback and extremely fast)
  if (fileName && samplePoTemplates[fileName]) {
    return res.json({ success: true, method: "demoTemplate", data: samplePoTemplates[fileName] });
  }

  // If Gemini API Key is missing, alert user but fallback beautifully to parse structured content
  if (!process.env.GEMINI_API_KEY || !ai) {
    console.log("No Gemini API key available. Running heuristic parser placeholder client fallback.");
    // Simulate a successful default parse matching a custom PO
    const fallbackParsed = {
      po_number: "PO-" + Math.floor(100000 + Math.random() * 900000),
      vendor_name: "Global Materials Supply Co.",
      vendor_address: "740 Industrial Boulevard, Manufacturing Sect 4, TX 75001",
      date: new Date().toISOString().split("T")[0],
      total_amount: 7297.00,
      items: [
        { line_no: 1, supplier_part_no: "COP-TUBE-12", description: "Copper Tube 1/2 Inch (Auto-Extracted)", qty: 150, oum: "MTR", unit_price: 16.20, total_price: 2430.00 },
        { line_no: 2, supplier_part_no: "PVC40-4IN", description: "PVC Pipe Class D 4 Inch (Auto-Extracted)", qty: 80, oum: "PCS", unit_price: 25.40, total_price: 2032.00 },
        { line_no: 3, supplier_part_no: "SLT90-CAN", description: "Industrial Sealant T-90 (Auto-Extracted)", qty: 25, oum: "CAN", unit_price: 113.40, total_price: 2835.00 }
      ]
    };
    return res.json({
      success: true,
      method: "fallbackSimulator",
      info: "Simulated extraction. Please configure your GEMINI_API_KEY in Settings > Secrets for real AI PDF reading.",
      data: fallbackParsed
    });
  }

  try {
    const rawBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    
    const imagePart = {
      inlineData: {
        mimeType: "application/pdf",
        data: rawBase64,
      },
    };

    const promptText = `
      You are a specialized invoice and Purchase Order (PO) document parser.
      Analyze this Purchase Order PDF. Extract the client-facing header fields (PO number, vendor_name, vendor_address, purchase date, total_amount) and all item rows listed in the document.
      Ensure the quantity and prices are represented accurately as floating numbers.
      Return the results in strict JSON format.
    `;

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, { text: promptText }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            po_number: { type: Type.STRING, description: "Extracted buy/order ID or invoice code" },
            vendor_name: { type: Type.STRING, description: "Vendor company or seller name" },
            vendor_address: { type: Type.STRING, description: "Fulfillment supplier location" },
            date: { type: Type.STRING, description: "Date of PO issuance in YYYY-MM-DD" },
            total_amount: { type: Type.NUMBER, description: "Total numeric quantity of PO value specified" },
            items: {
              type: Type.ARRAY,
              description: "Line items listed on this document",
              items: {
                type: Type.OBJECT,
                properties: {
                  line_no: { type: Type.INTEGER, description: "Sequence number" },
                  supplier_part_no: { type: Type.STRING, description: "SKU or supplier part code if explicitly written, otherwise generic" },
                  description: { type: Type.STRING, description: "Description text of product item" },
                  qty: { type: Type.NUMBER, description: "Quantity ordered" },
                  oum: { type: Type.STRING, description: "Unit of measure code like PCS, BOX, MTR, KG, etc." },
                  unit_price: { type: Type.NUMBER, description: "Item cost per unit as written in document" },
                  total_price: { type: Type.NUMBER, description: "Item line sum (qty multiplied by unit cost)" }
                },
                required: ["line_no", "description", "qty", "oum", "unit_price", "total_price"]
              }
            }
          },
          required: ["po_number", "vendor_name", "date", "total_amount", "items"]
        }
      }
    });

    const outputText = modelResponse.text?.trim() || "{}";
    const parsedData = JSON.parse(outputText);
    
    res.json({ success: true, method: "geminiAI", data: parsedData });
  } catch (err: any) {
    console.error("Gemini Parsing failed:", err);
    res.status(500).json({ success: false, errorMessage: `Gemini Extraction Failed: ${err.message}` });
  }
});

// Generate Excel file (CSV export utility)
app.post("/api/generate-excel", (req, res) => {
  const { po_number, items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, errorMessage: "Missing mapping items data." });
  }

  // Create formatted Excel-ready Comma Separated file with column headers
  let csvContent = "";
  csvContent += `"Purchase Order Excel Export","PO Reference: ${po_number || "N/A"}"\n`;
  csvContent += `"Generated Date:","${new Date().toISOString()}"\n\n`;
  
  csvContent += `Line No,Supplier Part No,PO Description,Qty,PO OUM,PO Price,Synced SKU,Synced SQL OUM,Synced SQL Cost,Price Status,Notes\n`;
  
  items.forEach((item: any) => {
    const clean_desc = (item.description || "").replace(/"/g, '""');
    const notes = (item.notes || "").replace(/"/g, '""');
    csvContent += `${item.line_no || ""},"${item.supplier_part_no || ""}","${clean_desc}",${item.qty || 0},"${item.oum || ""}","${item.unit_price || 0}","${item.mapped_sku || "UNMAPPED"}","${item.mapped_oum || ""}","${item.mapped_cost || 0}","${item.price_status || "unmapped"}","${notes}"\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="PO_${po_number || "export"}_mapped.csv"`);
  res.send(csvContent);
});

// Generate TU DTA Processing File Output
app.post("/api/generate-dta", (req, res) => {
  const { poMaster, items, formatSpec } = req.body;
  
  if (!items || !poMaster) {
    return res.status(400).json({ success: false, errorMessage: "Missing data payload for DTA compilation." });
  }

  const useFormat = formatSpec || "standard-fixed";
  const lines: string[] = [];

  // 1. Compile Header Row [H]
  const poNumStr = String(poMaster.po_number || "PO-UNKNOWN").padEnd(15).substring(0, 15);
  const vendorStr = String(poMaster.vendor_name || "VENDOR").padEnd(30).substring(0, 30);
  const dateStr = String(poMaster.date || new Date().toISOString().split("T")[0]).replace(/-/g, ""); // YYYYMMDD
  
  if (useFormat === "standard-fixed") {
    // Standard Fixed Width DTA format definition
    lines.push(`H|${poNumStr}|${vendorStr}|${dateStr}|${String(items.length).padStart(4, "0")}`);
    
    // 2. Compile Item Rows [I]
    items.forEach((item: any, idx: number) => {
      const lineNoStr = String(idx + 1).padStart(3, "0");
      const skuStr = String(item.mapped_sku || "UNMAPPED").padEnd(15).substring(0, 15);
      const qtyStr = String(item.qty || 0).padStart(6, "0");
      const oumStr = String(item.mapped_oum || item.oum || "PCS").padEnd(3).substring(0, 3);
      // Format price correctly with decimals to 10 chars (e.g. 000125.50)
      const priceStr = Number(item.mapped_cost || item.unit_price || 0).toFixed(2).padStart(10, "0");
      const subtotalStr = (Number(item.qty || 0) * Number(item.mapped_cost || item.unit_price || 0)).toFixed(2).padStart(12, "0");

      lines.push(`I|${lineNoStr}|${skuStr}|${qtyStr}|${oumStr}|${priceStr}|${subtotalStr}`);
    });

    // 3. Compile Summary Footer Row [F]
    const grandGenTotal = items.reduce((sum: number, it: any) => sum + (Number(it.qty || 0) * Number(it.mapped_cost || it.unit_price || 0)), 0);
    const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.qty || 0), 0);
    lines.push(`F|${String(totalQty).padStart(8, "0")}|${grandGenTotal.toFixed(2).padStart(15, "0")}`);
  
  } else if (useFormat === "delimited") {
    // Delimited segment block EDI style
    lines.push(`DTAPO^HDR^${poMaster.po_number || "NA"}^${vendorStr.trim()}^${dateStr}`);
    items.forEach((item: any, idx: number) => {
      lines.push(`DTAPO^ITM^${idx+1}^${item.mapped_sku || "UNMAPPED"}^${item.qty}^${item.mapped_oum || item.oum}^${item.mapped_cost || item.unit_price}`);
    });
    const grandGenTotal = items.reduce((sum: number, it: any) => sum + (Number(it.qty || 0) * Number(it.mapped_cost || it.unit_price || 0)), 0);
    lines.push(`DTAPO^SUM^${items.length}^${grandGenTotal.toFixed(2)}`);
  }

  const dtaContent = lines.join("\n");
  
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="TU_DTA_${poMaster.po_number || "NA"}.dta"`);
  res.send(dtaContent);
});


// ---------------------------------------------------------
// VITE AND STATIC ASSETS CLIENT-SERVER BRIDGES
// ---------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Starting full-stack application in DEVELOPMENT mode.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Starting full-stack application in PRODUCTION mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend Express server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
