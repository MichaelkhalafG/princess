import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names with Tailwind conflict resolution (DESIGN_RULES §15). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
