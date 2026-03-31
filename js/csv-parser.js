/**
 * csv-parser.js
 *
 * Fetches vintage_movies.csv and parses it into an array of plain objects.
 * Handles quoted fields, embedded commas, and Windows line endings.
 *
 * Exports:
 *   loadCSV(path) → Promise<Object[]>
 */

/**
 * Parse a single CSV line, respecting double-quoted fields that may
 * contain commas or embedded quotes ("" → ").
 *
//  @ param {string} line
//  @ returns {string[]}
 */
function parseCSVLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (inQuotes) {
            if (ch === '"') {
                // Peek ahead: "" inside quotes is an escaped quote
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ",") {
                fields.push(current);
                current = "";
            } else {
                current += ch;
            }
        }
    }

    fields.push(current); // last field
    return fields;
}

/**
 * Fetch and parse a CSV file.
 *
 * @ param {string} path  URL or relative path to the CSV file
 * @ returns {Promise<Object[]>}  Array of row objects keyed by header names
 */
async function loadCSV(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch CSV: ${response.status} ${response.statusText}`,
        );
    }

    const text = await response.text();

    // Normalise Windows line endings
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((header, idx) => {
            row[header.trim()] = (values[idx] || "").trim();
        });
        rows.push(row);
    }

    return rows;
}
