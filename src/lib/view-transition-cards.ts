/**
 * Keeps a view-mode transition from snapshotting cards nobody can see.
 *
 * A view transition snapshots **every** element that has a `view-transition-name`,
 * whether or not it is on screen — the value that would opt an element out when it
 * is not intersecting is still only a proposal (CSSWG issue #8282, comment by the
 * spec author, 2023-10-23: `visible` is "current behavior", `auto` is the proposal).
 * With infinite scroll the gallery keeps every card it has ever loaded, so naming
 * all of them means snapshotting all of them, forever.
 *
 * Measured on the live site with 77 cards loaded: 78 named elements, 386
 * animations, two long tasks (79 ms and 96 ms), and visible stutter. With 20 cards
 * loaded there were no long tasks at all — the cost scales with what is mounted.
 *
 * The card frames carry `data-vt-id`; `data-vt-far` is what the `!important` rule
 * in globals.css uses to strip the name (an author `!important` beats the inline
 * `view-transition-name` the card renders). This is deliberately DOM-only: no
 * React state, no re-render, nothing to keep in sync with the two galleries.
 */

const FRAME_SELECTOR = "[data-vt-id]";
const FAR_ATTRIBUTE = "data-vt-far";

/**
 * Photo ids whose card is within one viewport of the visible area.
 *
 * The margin is for safety, not for pre-triggering: everything the user can
 * actually see must be in the set, or its morph would vanish. One viewport of
 * slack means the set is decided by geometry rather than by a scroll listener
 * that could be a frame stale.
 */
export function nearCardIds(): Set<string> {
  const ids = new Set<string>();
  const margin = window.innerHeight;
  const top = -margin;
  const bottom = window.innerHeight + margin;

  for (const el of document.querySelectorAll<HTMLElement>(FRAME_SELECTOR)) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= top || rect.top >= bottom) continue;
    const id = el.dataset.vtId;
    if (id) ids.add(id);
  }

  return ids;
}

/**
 * Strips the name from every card not in `near`.
 *
 * Call it once before `startViewTransition` (so the "before" snapshot is limited)
 * and again inside the update callback after the render — the incoming cards are
 * new DOM nodes, so they need marking before the "after" snapshot is taken.
 *
 * The two calls want different sets, and using the same one is wrong in a way
 * that is easy to miss. The set taken from the layout being left is what makes a
 * card morph (a name has to exist on both sides to pair); the set taken from the
 * incoming layout is what keeps a card from appearing with no animation at all.
 * The two layouts here differ about ninefold in height, so a mid-scroll switch
 * lands the viewport on completely different photos — measured: of the cards
 * visible afterwards, none were in the outgoing set. Pass the union.
 */
export function markFarCards(near: Set<string>): void {
  for (const el of document.querySelectorAll<HTMLElement>(FRAME_SELECTOR)) {
    const id = el.dataset.vtId;
    if (id && near.has(id)) el.removeAttribute(FAR_ATTRIBUTE);
    else el.setAttribute(FAR_ATTRIBUTE, "");
  }
}

/** Drops the restriction, so the next transition can decide afresh. */
export function clearFarCards(): void {
  for (const el of document.querySelectorAll<HTMLElement>(`[${FAR_ATTRIBUTE}]`)) {
    el.removeAttribute(FAR_ATTRIBUTE);
  }
}
