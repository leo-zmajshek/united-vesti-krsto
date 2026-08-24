/* Which top-nav shortcut should be highlighted as he scrolls the home page.

   Kept out of the route file, and free of the DOM, so the decision can be
   tested directly against real measured geometry instead of only in a browser. */

export const NAV_SECTION_IDS = ["status", "schedule", "table", "news"] as const;

export type NavSection = { id: string; top: number };

/**
 * The active section is the last one whose top has scrolled up past the nav.
 *
 * @param sections  in document order, each with its viewport-relative top
 * @param navBottom the y coordinate just below the sticky nav
 * @param atPageBottom the page is scrolled to the end
 */
export function pickActiveSection(
  sections: NavSection[],
  navBottom: number,
  atPageBottom: boolean,
): string {
  const first = sections[0]?.id ?? "";
  // The last section is shorter than the viewport, so its top never crosses the
  // nav; reaching the bottom of the page is what counts as reaching it.
  if (atPageBottom) return sections[sections.length - 1]?.id ?? first;

  let current = first;
  for (const section of sections) {
    if (section.top <= navBottom) current = section.id;
  }
  return current;
}
