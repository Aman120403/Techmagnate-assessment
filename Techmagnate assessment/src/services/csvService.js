const { parse } = require('csv-parse/sync');
const ApiError = require('../utils/ApiError');
const { validateTaskPayload } = require('../validators/taskValidator');
const { env } = require('../config/env');

const REQUIRED_HEADERS = ['keyword', 'language', 'location', 'priority'];

/**
 * Tech Magnate Assessment — CSV parse + per-row validation for bulk upload.
 * Expected headers: keyword, language, location, priority
 */
function parseAndValidateCsv(buffer) {
  if (!buffer || !buffer.length) {
    throw new ApiError(400, 'Empty CSV file');
  }

  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (!text.trim()) {
    throw new ApiError(400, 'Empty CSV file');
  }

  // Excel (locale) sometimes uses `;` — sniff first line
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  //convert csv into javaScript objects
  let records;
  try {
    records = parse(text, {
      columns: (header) =>
        header.map((h) =>
          String(h || '')
            .replace(/^\uFEFF/, '')
            .trim()
            .toLowerCase()
        ),
      skip_empty_lines: true,  //Ignore blank rows
      trim: true,               // remove spaces
      relax_column_count: true,  // Allows rows with diffrent numbers of columns
      bom: true,
      delimiter,
      relax_quotes: true,
    });
  } catch (err) {
    throw new ApiError(400, `CSV parse error: ${err.message}`);
  }
//Check if only headers exist.
  if (!records.length) {
    throw new ApiError(400, 'CSV has headers but no data rows');
  }
//Get headers
  const keys = Object.keys(records[0] || {});
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !keys.includes(h));
  if (missingHeaders.length) {
    throw new ApiError(
      400,
      `CSV headers must be exactly: keyword,language,location,priority. Missing: ${missingHeaders.join(
        ', '
      )}. Found: ${keys.join(', ') || '(none)'}`
    );
  }

  if (records.length > env.maxCsvRows) {
    throw new ApiError(
      400,
      `CSV has ${records.length} rows — max allowed is ${env.maxCsvRows}`
    );
  }

  const valid = [];
  const invalid = [];

  records.forEach((raw, index) => {
    const candidate = {
      keyword: pick(raw, ['keyword']),
      language: pick(raw, ['language', 'language_code']),
      location: pick(raw, ['location', 'location_code']),
      priority: pick(raw, ['priority']),
    };

    const result = validateTaskPayload(candidate);
    const rowNumber = index + 2; // +1 header, +1 zero-index

    if (result.ok) {
      valid.push({ ...result.value, row: rowNumber });
    } else {
      invalid.push({
        row: rowNumber,
        data: candidate,
        errors: result.errors,
      });
    }
  });

  return { valid, invalid, totalRows: records.length };
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return String(row[name]).trim();
    }
  }
  return '';
}

module.exports = { parseAndValidateCsv };
