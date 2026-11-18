const PAY_WORDS = /\b(pay|salary|salaries|ctc|compensation|payslips?|payroll|increment|appraisal|bonus|stipend|offer letter|take[- ]home|in[- ]hand|gross (pay|salary)|net pay|basic pay|deductions?)\b/i;
const AMOUNT = /(?:₹|\bINR\b|\bRs\.?)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:k|l|lakhs?|lpa|crores?|cr)\b)?|\b\d+(?:\.\d+)?\s*(?:k|l|lakhs?|lpa|crores?|cr)\b|(?<!\d:\d\d(?::\d\d)?\s?[+-])\b(?!(?:19|20)\d\d\b)\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b|(?<!\d:\d\d(?::\d\d)?\s?[+-])\b(?!(?:19|20)\d\d\b)\d{4,}(?:\.\d+)?\b/gi;

export const AMOUNT_WITHHELD = "[amount withheld]";

/** GL lines booking the whole month's payroll: company totals, which A002 allows. */
const COMPANY_PAYROLL_TOTAL = /Vendor \/ Payee: Salaries \(payroll\)/;

export const mentionsPay = (text: string) => PAY_WORDS.test(text) && !COMPANY_PAYROLL_TOTAL.test(text);

export const maskAmounts = (text: string) => text.replace(AMOUNT, AMOUNT_WITHHELD);

/** Individual pay can sit in emails and documents, not only in restricted payroll tables (A002). */
export function withholdPay(text: string): string {
  return mentionsPay(text) ? maskAmounts(text) : text;
}

export function withoutPayFields(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !mentionsPay(key.replace(/[_-]+/g, " "))));
}
