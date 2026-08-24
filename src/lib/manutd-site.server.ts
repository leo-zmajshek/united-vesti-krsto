/* The club's own squad page — manutd.com/en/teams/mens-team.

   This is the best source for the three things the football data providers get
   wrong or omit: squad numbers (football-data returns null for every player),
   official photos (football-data has none, ESPN has 2 of 30, Wikipedia 26 of
   30), and the actual first-team list (football-data returns 38 including
   youth, the club lists 31).

   It is server-rendered HTML with stable `data-testid` attributes, so parsing
   anchors on those rather than the hashed CSS-module class names. This is still
   scraping a page rather than calling an API: it can break whenever the club
   restructures the page, so every caller must treat a zero-player result as
   normal and fall back to the data providers. */

import type { SquadDTO, SquadPlayerDTO, SquadPositionDTO } from "./manutd.types";

const SQUAD_URL = "https://www.manutd.com/en/teams/mens-team";

/* Section headings above each group of cards carry the position. */
function positionFromHeading(heading: string): SquadPositionDTO {
  const h = heading.toLowerCase();
  if (h.includes("goalkeep")) return "goalkeeper";
  if (h.includes("defend")) return "defender";
  if (h.includes("midfield")) return "midfielder";
  if (h.includes("forward") || h.includes("attack")) return "forward";
  return "unknown";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function textOf(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function fieldByTestId(card: string, testId: string): string {
  const match = card.match(
    new RegExp(`data-testid="profile-card__${testId}"[^>]*>([\\s\\S]*?)</span>`),
  );
  return match ? textOf(match[1]!) : "";
}

/* Their image CDN honours arbitrary width/height, so the 720x981 hero crop the
   page requests is rewritten to a small square: ~5 KB per player instead of
   ~126 KB. */
function squareThumb(url: string): string {
  const base = decodeEntities(url).split("?")[0]!;
  return `${base}?fmt=webp&f=center&w=144&h=144`;
}

/** Parse the club squad page. Exported separately from the fetch so it can be
    tested against a saved copy of the real page. */
export function parseOfficialSquad(pageHtml: string): SquadPlayerDTO[] {
  // Walk headings and cards in document order so each card inherits the
  // position of the group heading above it. Anchoring on <h2> text avoids
  // depending on the hashed class names entirely.
  const markers: { index: number; kind: "heading" | "card"; value: string }[] = [];

  for (const m of pageHtml.matchAll(/<h2[^>]*>([\s\S]{0,60}?)<\/h2>/g)) {
    markers.push({ index: m.index!, kind: "heading", value: textOf(m[1]!) });
  }
  for (const m of pageHtml.matchAll(/data-testid="profile-card"/g)) {
    markers.push({ index: m.index!, kind: "card", value: "" });
  }
  markers.sort((a, b) => a.index - b.index);

  const players: SquadPlayerDTO[] = [];
  let position: SquadPositionDTO = "unknown";

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!;
    if (marker.kind === "heading") {
      const parsed = positionFromHeading(marker.value);
      // Only adopt headings that actually name a position; the page also has
      // headings like "Squad List" and partner sections.
      if (parsed !== "unknown") position = parsed;
      continue;
    }

    // A card's markup runs until the next marker, or a bounded slice at the end.
    const next = markers[i + 1]?.index ?? marker.index + 2500;
    const card = pageHtml.slice(marker.index, Math.min(next, marker.index + 2500));

    const first = fieldByTestId(card, "first-name");
    const last = fieldByTestId(card, "last-name");
    const name = `${first} ${last}`.trim();
    if (!name) continue;

    const number = fieldByTestId(card, "squad-number");
    const shirt = /^\d+$/.test(number) ? Number(number) : null;
    const image = card.match(/<img[^>]+src="(https:\/\/[^"]*scoreplay\.io\/[^"]+)"/);

    players.push({
      name,
      position,
      shirt,
      age: null, // not on this page; filled from a data provider
      country: "",
      photo: image ? squareThumb(image[1]!) : null,
    });
  }

  // Guard against a page restructure silently yielding a couple of stray cards.
  return players.length >= 15 ? players : [];
}

/** Fetch and parse the club squad page. Returns an empty squad rather than
    throwing, so callers fall back to the data providers. */
export async function loadOfficialSquad(): Promise<SquadDTO> {
  try {
    const res = await fetch(SQUAD_URL, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-GB,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`manutd.com ${res.status}`);
    const players = parseOfficialSquad(await res.text());
    if (players.length === 0) console.error("[manutd] official squad page parsed 0 players");
    return { coach: "", players };
  } catch (error) {
    console.error("[manutd] official squad page unavailable", error);
    return { coach: "", players: [] };
  }
}
