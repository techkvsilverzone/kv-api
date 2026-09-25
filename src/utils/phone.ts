/** Reduce "+91 81908 58375", "918190858375" or "08190858375" to the bare 10-digit mobile "8190858375". */
export function toIndianMobile(input: unknown): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export const isIndianMobile = (mobile: string): boolean => /^[6-9]\d{9}$/.test(mobile);
