import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats an integer minor-unit monetary amount (e.g. 1499 -> "$14.99").
 * Never uses floating-point math for money storage; division happens strictly at presentation.
 */
export function formatMinorCurrency(
  amountMinor: number,
  currency: string,
  locale = "en-US",
): string {
  const safeMinor = Number.isFinite(amountMinor) ? Math.round(amountMinor) : 0;
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(safeMinor / 100);
  } catch {
    return `${currency.toUpperCase()} ${(safeMinor / 100).toFixed(2)}`;
  }
}

export function formatDateTimeInZone(isoString: string, timeZone: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatShortDate(isoString: string, timeZone: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
