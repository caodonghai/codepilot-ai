export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface TableOptions {
  columns: TableColumn[];
  data: Record<string, unknown>[];
  border?: boolean;
  padding?: number;
}

export function formatTable(options: TableOptions): string {
  const { columns, data, border = true, padding = 2 } = options;

  const calculateWidth = (column: TableColumn, data: Record<string, unknown>[]): number => {
    const maxContentWidth = Math.max(
      ...data.map((row) => String(row[column.key] ?? '').length),
      column.label.length,
    );
    return column.width ?? Math.min(maxContentWidth + padding * 2, 40);
  };

  const widths = columns.map((col) => calculateWidth(col, data));

  const pad = (text: string, width: number, align: 'left' | 'center' | 'right' = 'left') => {
    if (align === 'center') {
      const totalPadding = width - text.length;
      const leftPadding = Math.floor(totalPadding / 2);
      const rightPadding = totalPadding - leftPadding;
      return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
    }
    if (align === 'right') {
      return text.padStart(width, ' ');
    }
    return text.padEnd(width, ' ');
  };

  const lines: string[] = [];

  if (border) {
    lines.push('+' + widths.map((w) => '-'.repeat(w)).join('+') + '+');
  }

  lines.push('|' + columns.map((col, i) => pad(col.label, widths[i], col.align)).join('|') + '|');

  if (border) {
    lines.push('+' + widths.map((w) => '-'.repeat(w)).join('+') + '+');
  }

  for (const row of data) {
    lines.push(
      '|' +
        columns.map((col, i) => pad(String(row[col.key] ?? ''), widths[i], col.align)).join('|') +
        '|',
    );
  }

  if (border) {
    lines.push('+' + widths.map((w) => '-'.repeat(w)).join('+') + '+');
  }

  return lines.join('\n');
}

export function formatSimpleTable(headers: string[], rows: string[][]): string {
  const columns: TableColumn[] = headers.map((header) => ({
    key: header,
    label: header,
    align: 'left',
  }));

  const data = rows.map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      record[header] = row[i];
    });
    return record;
  });

  return formatTable({ columns, data });
}

export function formatList(items: string[], title?: string): string {
  const lines: string[] = [];
  if (title) {
    lines.push(title);
    lines.push('-'.repeat(title.length));
  }
  for (const item of items) {
    lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

export function formatKeyValue(data: Record<string, unknown>, title?: string): string {
  const lines: string[] = [];
  if (title) {
    lines.push(title);
    lines.push('-'.repeat(title.length));
  }
  const maxKeyLength = Math.max(...Object.keys(data).map((k) => k.length));
  for (const [key, value] of Object.entries(data)) {
    const paddedKey = key.padEnd(maxKeyLength, ' ');
    lines.push(`${paddedKey}: ${String(value)}`);
  }
  return lines.join('\n');
}
