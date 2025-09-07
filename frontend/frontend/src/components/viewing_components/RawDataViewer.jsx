import React, { useMemo, useState, useCallback } from "react";

/**
 * RawDataViewer
 * A lightweight, dependency-free table for viewing ALL rows with client-side pagination.
 *
 * Props:
 * - rows: Array<object> (required) — full dataset
 * - pageSize: number (optional, default 500)
 * - pageSizeOptions: number[] (optional, default [100, 250, 500, 1000])
 * - initialPage: number (optional, default 1)
 * - onPageChange?: (nextPage: number) => void (optional)
 *
 * Notes:
 * - Computes columns once from the first non-empty row; if rows are heterogenous,
 *   it expands the column set using up to the first 1000 rows (performance-safe).
 * - Sticky header and scrollable body; minimal inline styles to avoid CSS regressions.
 * - No global mutations. Purely presentational.
 */
export default function RawDataViewer({
  rows = [],
  pageSize: pageSizeProp = 500,
  pageSizeOptions = [100, 250, 500, 1000],
  initialPage = 1,
  onPageChange,
}) {
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [pageSize, setPageSize] = useState(pageSizeProp);

  const totalRows = Array.isArray(rows) ? rows.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  // Build stable column list (union of keys in the first non-empty row, expanding up to 1000 rows)
  const columns = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const SAMPLE_LIMIT = Math.min(1000, rows.length);
    const colSet = new Set();
    for (let i = 0; i < SAMPLE_LIMIT; i++) {
      const r = rows[i];
      if (r && typeof r === "object") {
        Object.keys(r).forEach((k) => colSet.add(k));
      }
    }
    // Convert to array with stable order. If desired, you can sort alphabetically:
    // return Array.from(colSet).sort((a, b) => a.localeCompare(b));
    return Array.from(colSet);
  }, [rows]);

  // Ensure current page is valid if pageSize changes or data shrinks
  if (page > totalPages) {
    // Adjust synchronously; safe because render is pure and the next render will use the updated page
    // (avoids an effect for the simple case)
    // eslint-disable-next-line no-console
    console.debug("[RawDataViewer] Adjusting page to last available.");
    setPage(totalPages);
  }

  const pageStart = (page - 1) * pageSize;
  const pageRows = useMemo(
    () => rows.slice(pageStart, pageStart + pageSize),
    [rows, pageStart, pageSize]
  );

  const goto = useCallback(
    (next) => {
      const bounded = Math.min(totalPages, Math.max(1, next));
      setPage(bounded);
      if (onPageChange) onPageChange(bounded);
    },
    [totalPages, onPageChange]
  );

  const handlePageSizeChange = (e) => {
    const nextSize = Number(e.target.value) || pageSize;
    // Re-calc totalPages with the new size and clamp page
    const nextTotalPages = Math.max(1, Math.ceil(totalRows / nextSize));
    const nextPage = Math.min(page, nextTotalPages);
    setPageSize(nextSize);
    setPage(nextPage);
    if (onPageChange) onPageChange(nextPage);
  };

  if (!totalRows) {
    return <div style={{ padding: 8 }}>No data available.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Controls (top) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => goto(1)} disabled={page === 1} aria-label="First page">
            First
          </button>
          <button onClick={() => goto(page - 1)} disabled={page === 1} aria-label="Previous page">
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => goto(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            Next
          </button>
          <button
            onClick={() => goto(totalPages)}
            disabled={page === totalPages}
            aria-label="Last page"
          >
            Last
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label htmlFor="rdv-page-size" style={{ fontSize: 12 }}>
            Rows per page
          </label>
          <select
            id="rdv-page-size"
            value={pageSize}
            onChange={handlePageSizeChange}
            style={{ padding: "2px 6px" }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <span style={{ marginLeft: "auto", fontSize: 12 }}>
          {totalRows.toLocaleString()} rows
        </span>
      </div>

      {/* Table */}
      <div
        style={{
          overflow: "auto",
          border: "1px solid #ddd",
          borderRadius: 6,
          maxWidth: "100%",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            tableLayout: "fixed",
            fontSize: 12,
          }}
        >
          <thead style={{ position: "sticky", top: 0, background: "#fafafa", zIndex: 1 }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                    padding: "6px 8px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={col}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {columns.map((col) => {
                  const val = row?.[col];
                  const text =
                    val == null
                      ? ""
                      : typeof val === "object"
                      ? JSON.stringify(val)
                      : String(val);
                  return (
                    <td
                      key={col}
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #f2f2f2",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={text}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Controls (bottom) — duplicate for convenience */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => goto(1)} disabled={page === 1} aria-label="First page">
            First
          </button>
          <button onClick={() => goto(page - 1)} disabled={page === 1} aria-label="Previous page">
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => goto(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            Next
          </button>
          <button
            onClick={() => goto(totalPages)}
            disabled={page === totalPages}
            aria-label="Last page"
          >
            Last
          </button>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>
          Showing {pageRows.length.toLocaleString()} of {totalRows.toLocaleString()} rows
        </span>
      </div>
    </div>
  );
}
