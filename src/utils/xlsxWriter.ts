/**
 * xlsxWriter.ts
 * Lightweight, zero-vulnerability .xlsx writer built on JSZip.
 * Replaces the vulnerable `xlsx` (SheetJS) package.
 *
 * Supports:
 *  - Multiple sheets
 *  - JSON rows  (jsonToSheet)
 *  - Array-of-arrays  (aoaToSheet)
 *  - writeFile  (triggers browser download)
 */

import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────────────────

type CellValue = string | number | boolean | null | undefined;
type AoaData = CellValue[][];
type JsonRow = Record<string, CellValue>;

interface Sheet {
  name: string;
  xml: string;
}

export interface Workbook {
  sheets: Sheet[];
}

// ─── XML helpers ─────────────────────────────────────────────────────────────

function escapeXml(value: CellValue): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Convert a 0-based column index to an Excel column letter (A, B, … Z, AA …) */
function colLetter(idx: number): string {
  let letter = '';
  let n = idx;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/** Build a worksheet XML string from a 2-D array */
function buildSheetXml(rows: AoaData): string {
  const rowsXml = rows
    .map((row, ri) => {
      const cellsXml = row
        .map((cell, ci) => {
          const ref = `${colLetter(ci)}${ri + 1}`;
          if (typeof cell === 'number') {
            return `<c r="${ref}" t="n"><v>${cell}</v></c>`;
          }
          const escaped = escapeXml(cell);
          return `<c r="${ref}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cellsXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create a blank workbook */
export function bookNew(): Workbook {
  return { sheets: [] };
}

/** Convert an array-of-arrays to a sheet and append it to a workbook */
export function aoaToSheet(wb: Workbook, data: AoaData, sheetName: string): void {
  wb.sheets.push({ name: sheetName, xml: buildSheetXml(data) });
}

/**
 * Convert an array of plain objects to a sheet.
 * The first object's keys become the header row.
 */
export function jsonToSheet(wb: Workbook, rows: JsonRow[], sheetName: string): void {
  if (rows.length === 0) {
    wb.sheets.push({ name: sheetName, xml: buildSheetXml([]) });
    return;
  }
  const headers = Object.keys(rows[0]);
  const aoa: AoaData = [
    headers,
    ...rows.map(r => headers.map(h => r[h] ?? '')),
  ];
  wb.sheets.push({ name: sheetName, xml: buildSheetXml(aoa) });
}

/**
 * Trigger a browser download of the workbook as a .xlsx file.
 */
export async function writeFile(wb: Workbook, filename: string): Promise<void> {
  const zip = new JSZip();

  // ── Static parts of the Open XML package ──────────────────────────────────

  zip.file('[Content_Types].xml', buildContentTypes(wb.sheets.length));
  zip.file('_rels/.rels', ROOT_RELS);

  const workbookXml = buildWorkbookXml(wb.sheets);
  zip.folder('xl')!.file('workbook.xml', workbookXml);
  zip.folder('xl')!.file('_rels/workbook.xml.rels', buildWorkbookRels(wb.sheets.length));
  zip.folder('xl')!.file('styles.xml', STYLES_XML);

  wb.sheets.forEach((sheet, i) => {
    zip.folder('xl/worksheets')!.file(`sheet${i + 1}.xml`, sheet.xml);
  });

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Open XML boilerplate ─────────────────────────────────────────────────────

function buildContentTypes(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

function buildWorkbookXml(sheets: Sheet[]): string {
  const sheetsXml = sheets
    .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetsXml}</sheets>
</workbook>`;
}

function buildWorkbookRels(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
</Relationships>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;
