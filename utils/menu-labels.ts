/**
 * Display label for a menu slot by index. Menus are just an ordered,
 * numbered list — not tied to weeks or any other calendar cadence. Index 0
 * is the one you're actively cooking from (the only one eligible for the
 * Complete flow), everything after it is planned ahead.
 */
export function menuLabel(index: number): string {
  return `Menu ${index + 1}`;
}

/** A menu's custom name if it has one, otherwise its positional label. */
export function menuDisplayName(menu: { name?: string } | undefined, index: number): string {
  const trimmed = menu?.name?.trim();
  return trimmed || menuLabel(index);
}
