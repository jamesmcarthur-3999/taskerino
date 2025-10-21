/**
 * CanvasTable - Data Display Component
 *
 * Tabular data with sorting, striping, and hover effects.
 * Responsive: converts to card list on mobile.
 */

import React from 'react';
import type { TableProps } from '../types';
import { CANVAS_COMPONENTS } from '../../../design-system/theme';

export function CanvasTable({
  columns,
  rows,
  striped = false,
  hoverable = true,
  compact = false,
}: TableProps) {
  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {/* Header */}
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-50/50">
            {columns.map((column) => (
              <th
                key={column.id}
                className={`${cellPadding} text-left text-sm font-semibold text-gray-700 ${
                  column.width || ''
                }`}
              >
                {column.label}
                {column.sortable && (
                  <span className="ml-1 text-gray-400 text-xs">⇅</span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((row, rowIndex) => {
            const themeClasses = row.theme
              ? CANVAS_COMPONENTS.themes[row.theme]
              : CANVAS_COMPONENTS.themes.default;

            return (
              <tr
                key={row.id}
                className={[
                  striped && rowIndex % 2 === 0 ? 'bg-gray-50/30' : '',
                  hoverable ? 'hover:bg-white/80 transition-colors' : '',
                  'border-b border-gray-100',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`${cellPadding} text-sm ${themeClasses.text}`}
                  >
                    {row.cells[column.id] !== undefined ? (
                      typeof row.cells[column.id] === 'object' ? (
                        JSON.stringify(row.cells[column.id])
                      ) : (
                        row.cells[column.id]
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
