import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { HelpCard } from "./HelpCard";
import { NAV_SECTION_IDS, pickActiveSection, type NavSection } from "@/lib/nav-sections";

/* The same shortcut bar on every page, so he can always see where he is.

   On the home page the sections are in-page anchors and the highlight follows
   his scrolling. On the squad and chat pages those same shortcuts have to
   navigate home first, and the highlight simply names the page he is on. */

type Props = { variant: "home"; isLive: boolean } | { variant: "page"; current: "squad" | "chat" };

function sectionsFor(isLive: boolean) {
  return [
    // The first button used to always read "Во живо", promising a live match
    // that usually is not on.
    { id: "status", label: isLive ? "Во живо" : "Резултат" },
    { id: "schedule", label: "Распоред" },
    { id: "table", label: "Табела" },
    { id: "news", label: "Вести" },
  ];
}

/* Which section is he actually looking at. Only runs on the home page — the
   other pages have no sections to track. */
function useActiveSection(navListRef: React.RefObject<HTMLUListElement | null>, enabled: boolean) {
  const [active, setActive] = useState<string>(NAV_SECTION_IDS[0]);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const list = navListRef.current;
      // Measure the sticky nav rather than hardcoding its height, which changes
      // with the phone's font-size setting.
      const line = (list ? list.getBoundingClientRect().bottom : 0) + 12;
      const sections: NavSection[] = [];
      for (const id of NAV_SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) sections.push({ id, top: el.getBoundingClientRect().top });
      }
      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      setActive(pickActiveSection(sections, line, atBottom));
    };

    /* Measured straight from the scroll handler rather than coalesced through
       requestAnimationFrame. Four read-only getBoundingClientRect calls are
       cheap, React skips the render when the section has not changed, and rAF is
       paused whenever the page is not being rendered — which made this
       impossible to test and added a failure mode for no real gain. */
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Android can restore a backgrounded install at a scroll position we never
    // observed, so re-measure when the page comes back.
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [navListRef, enabled]);

  return active;
}

/* A black outline reads clearly against both the grey buttons and the red one,
   unlike a fill or a colour change. */
const BASE = "block rounded-xl px-4 py-3 text-base font-bold sm:text-lg";
const GREY = "bg-secondary text-secondary-foreground";
const RED = "bg-primary text-primary-foreground";

function ring(active: boolean) {
  return active ? "ring-[3px] ring-foreground" : "ring-0";
}

export function TopNav(props: Props) {
  const navListRef = useRef<HTMLUListElement | null>(null);
  const isHome = props.variant === "home";
  const activeSection = useActiveSection(navListRef, isHome);
  const active = isHome ? activeSection : props.current;

  /* Only about three of the buttons fit on a phone, so the highlight can end up
     off-screen. Nudge the nav's own scrollLeft — never the page — and only when
     the button is actually clipped.

     Deliberately not a smooth scroll: smooth scrolling is driven by the same
     animation clock that is paused while a page is not being rendered, and a nav
     that slides sideways under his finger mid-scroll is more distracting than
     one that simply already shows the right button. */
  useEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const link = list.querySelector<HTMLElement>(`[data-nav-id="${active}"]`);
    if (!link) return;
    const listBox = list.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.left < listBox.left + 8) {
      list.scrollBy({ left: linkBox.left - listBox.left - 12 });
    } else if (linkBox.right > listBox.right - 8) {
      list.scrollBy({ left: linkBox.right - listBox.right + 12 });
    }
  }, [active]);

  const sections = sectionsFor(isHome ? props.isLive : false);

  return (
    <nav aria-label="Брзи кратенки" className="border-b-4 border-primary bg-card/95 backdrop-blur">
      <ul
        ref={navListRef}
        className="flex gap-2 overflow-x-auto px-3 py-2.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
      >
        {sections.map((item) => {
          const current = item.id === active;
          const shared = {
            "data-nav-id": item.id,
            /* "location" is the ARIA value for the current spot within a page,
               as opposed to "page" for the current page in a set. On the Link
               branch TanStack sets aria-current itself, so this only applies to
               the home page's in-page anchors. */
            "aria-current": current ? ("location" as const) : undefined,
            className: `${BASE} ${GREY} ${ring(current)}`,
          };
          return (
            <li key={item.id} className="shrink-0">
              {isHome ? (
                // An in-page anchor, so it scrolls rather than re-navigating.
                <a href={`#${item.id}`} {...shared}>
                  {item.label}
                </a>
              ) : (
                <Link to="/" hash={item.id} {...shared}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
        <li className="shrink-0">
          <Link
            to="/sostav"
            data-nav-id="squad"
            className={`${BASE} ${GREY} ${ring(active === "squad")}`}
          >
            Играчи
          </Link>
        </li>
        <li className="shrink-0">
          <Link
            to="/chat"
            data-nav-id="chat"
            className={`${BASE} ${RED} ${ring(active === "chat")}`}
          >
            Прашај
          </Link>
        </li>
        <HelpCard />
      </ul>
    </nav>
  );
}
