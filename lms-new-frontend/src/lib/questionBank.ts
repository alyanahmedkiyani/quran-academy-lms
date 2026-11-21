/** Options can arrive as a real array, a JSON-encoded string, or a legacy
 * comma-separated string depending on how the row was written to the DB. */
export const normalizeOptions = (options: unknown): string[] => {
  if (Array.isArray(options)) return options;
  if (typeof options === "string" && options.trim()) {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return options.split(",").map((o) => o.trim()).filter(Boolean);
    }
  }
  return [];
};
