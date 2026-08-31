/**
 * Safely parses an integer from a value, with a default and optional range constraints.
 */
export const parseInteger = (
  value: any,
  defaultValue: number,
  min?: number,
  max?: number
): number => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = parseInt(value as string, 10);

  if (isNaN(parsed)) {
    return defaultValue;
  }

  if (min !== undefined && parsed < min) {
    return min;
  }

  if (max !== undefined && parsed > max) {
    return max;
  }

  return parsed;
};

/**
 * Specifically for parsing pagination parameters.
 */
export const parsePagination = (queryPage: any, queryLimit: any) => {
  const page = parseInteger(queryPage, 1, 1);
  const limit = parseInteger(queryLimit, 50, 1, 100);
  return { page, limit };
};

/**
 * Specifically for parsing ID parameters.
 * Returns null if the ID is not a valid positive integer.
 */
export const parseId = (id: any): number | null => {
  const parsed = parseInt(id as string, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

/**
 * Sanitizes a string cell to prevent CSV Formula Injection (DDE injection).
 * If a value begins with =, +, -, @, \t, or \r, prepend a single quote so spreadsheets treat it as literal text.
 */
export const sanitizeCsvField = (value: any): string => {
  if (value === null || value === undefined) return "";
  const rawStr = String(value);
  const trimmed = rawStr.replace(/^[ ]+/, "");
  const sanitized = /^[=+\-@\t\r]/.test(trimmed) ? `'${trimmed}` : trimmed;
  // If the cell contains commas or double quotes or newlines, escape quotes and wrap in double quotes
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
};

