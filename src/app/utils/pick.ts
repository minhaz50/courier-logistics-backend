export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (
      obj &&
      Object.prototype.hasOwnProperty.call(obj, key) &&
      obj[key] !== undefined
    ) {
      result[key] = obj[key];
    }
  }
  return result;
}
