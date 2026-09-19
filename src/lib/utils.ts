import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Gallery URL filtered by city. Shared so the sidebar and the map popup cannot
 * drift into two different query shapes for the same destination.
 */
export function cityFilterHref(city: string): string {
  return `/?city=${encodeURIComponent(city)}`
}
