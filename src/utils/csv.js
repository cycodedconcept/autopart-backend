function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);

  return values.map((value) => value.trim());
}

function parseCsvText(csvText) {
  const normalizedText = String(csvText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);

    if (values.length !== headers.length) {
      const error = new Error(
        `CSV row ${index + 2} has ${values.length} columns, expected ${headers.length}.`
      );

      error.name = 'CsvParseError';
      throw error;
    }

    return headers.reduce((row, header, headerIndex) => ({
      ...row,
      [header]: values[headerIndex]
    }), {});
  });
}

function escapeCsvValue(value) {
  const normalizedValue = value === null || value === undefined
    ? ''
    : String(value);

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

function serializeCsvRows(headers = [], rows = []) {
  const headerRow = headers.map((header) => escapeCsvValue(header.label)).join(',');
  const bodyRows = rows.map((row) => headers
    .map((header) => escapeCsvValue(row[header.key]))
    .join(','));

  return [headerRow, ...bodyRows].join('\n');
}

module.exports = {
  parseCsvText,
  serializeCsvRows
};
