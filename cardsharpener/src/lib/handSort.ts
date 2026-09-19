export const HAND_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "won", label: "Most to least won" },
  { value: "lost", label: "Most to least lost" },
] as const;

export type HandSort = (typeof HAND_SORTS)[number]["value"];

export function handSortLabel(sort: string): string {
  return HAND_SORTS.find((option) => option.value === sort)?.label ?? "Newest first";
}
