/** BB-sized chip stacks from "Chip Stacks for blind size". */

import type { ChipBucket } from "../types/poker";

export type { ChipBucket };

export function amountToBb(amount: number, bigBlind: number): number {
  if (!(bigBlind > 0)) return 0;
  return amount / bigBlind;
}

/** Bucket from BB. 0.5 and 1 are exact rungs; then (1,5], (5,10], …, 50+. */
export function chipBucketForBb(bb: number): ChipBucket {
  const rounded = Math.round(bb * 10) / 10;
  if (rounded <= 0.5) return "bb-0.5";
  if (rounded <= 1) return "bb-1";
  if (rounded <= 5) return "bb-1-5";
  if (rounded <= 10) return "bb-5-10";
  if (rounded <= 20) return "bb-10-20";
  if (rounded <= 30) return "bb-20-30";
  if (rounded <= 50) return "bb-30-50";
  return "bb-50";
}

export function chipBucketForAmount(
  amount: number,
  bigBlind: number,
): ChipBucket {
  return chipBucketForBb(amountToBb(amount, bigBlind));
}

export function chipStackUrl(bucket: ChipBucket): string {
  return `/assets/chips/${bucket}.png`;
}
