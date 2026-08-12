import {
	ROUTINE_CATEGORIES,
	ROUTINES,
	type Routine,
	type RoutineCategory,
} from "./routines";

/* ============================================================
   Exercise browser — all client interactivity.
   Vanilla TS, no framework. Hydrates the island in
   ExerciseBrowser.astro. All DOM built via createElement +
   textContent (no innerHTML sinks); the only fetch targets a
   static, allowlisted asset.
   ============================================================ */

export type SideType = "unilateral" | "bilateral" | "either";

export interface Exercise {
	id: string;
	name: string;
	category: string;
	body_part: string;
	equipment: string;
	target: string;
	muscle_group: string;
	secondary_muscles: string[];
	image: string;
	gif_url: string;
	instructions: string;
	steps: string[];
	side: SideType;
}

export const SIDE_LABEL: Record<SideType, string> = {
	unilateral: "Each side",
	bilateral: "Both sides",
	either: "Either way",
};

export const SIDE_SHORT: Record<SideType, string> = {
	unilateral: "each side",
	bilateral: "both sides",
	either: "either way",
};

/** Why each mode matters — the coaching rationale for this feature. */
export const SIDE_RATIONALE: Record<
	SideType,
	{ title: string; points: string[]; tag: string }
> = {
	unilateral: {
		title: "Performed one side at a time",
		points: [
			"A lighter load per side means you can slow the lowering (eccentric) phase and control it far better — the classic way to add eccentric overload.",
			"Because each side works alone, both sides must be trained in balance: match sets × reps on left and right so one side never outpaces the other.",
			"Great for fixing strength or size asymmetries and building single-leg / single-arm stability.",
		],
		tag: "balance required",
	},
	bilateral: {
		title: "Performed with both sides together",
		points: [
			"Both limbs share the bar, so the total load can be heaviest — the most efficient way to build maximal strength.",
			"Both sides work simultaneously, so side-to-side balance is less of a concern mid-set.",
			"The trade-off: a strong side can help carry a weaker one, which can mask an imbalance over time.",
		],
		tag: "biggest load",
	},
	either: {
		title: "Can be done either way",
		points: [
			"The movement works with one side at a time or both sides together — your choice depending on the goal.",
			"Go each side when you want eccentric overload, extra time under tension, or to correct imbalances.",
			"Go both sides when you want the biggest possible load for the movement.",
		],
		tag: "pick the goal",
	},
};

const PAGE_SIZE = 60;

/** Static assets the browser is allowed to fetch — nothing else. */
const ALLOWED_FETCH = new Set(["data/exercises.json"]);

interface State {
	side: SideType | "all";
	q: string;
	cat: string; // "" = all
	eq: string; // "" = all
	target: string; // "" = all
	sort: "name" | "name-desc";
	visible: number;
	order: Exercise[]; // filtered + sorted
	all: Exercise[];
	selected: number; // index into order
	picked: Set<string>; // workout selection (exercise ids), shared via URL ?w=
	activeCat: RoutineCategory; // routine category shown in the quick-routines strip
	view: "workout" | "all"; // workout = grid shows the selection; all = full library
}

const state: State = {
	side: "all",
	q: "",
	cat: "",
	eq: "",
	target: "",
	sort: "name",
	visible: PAGE_SIZE,
	order: [],
	all: [],
	selected: -1,
	picked: new Set<string>(),
	activeCat: "full-body",
	view: "all",
};

let rootEl: HTMLElement | null = null;
let gridEl: HTMLElement | null = null;
let sentinelEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;
let loadMoreEl: HTMLButtonElement | null = null;
let observer: IntersectionObserver | null = null;
let lastFocused: HTMLElement | null = null;

const BASE = import.meta.env.BASE_URL;

function asset(path: string): string {
	return BASE.replace(/\/$/, "") + "/" + path.replace(/^\/+/, "");
}

const prefersReducedMotion =
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- tiny DOM helpers ---------- */

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	cls?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (cls) node.className = cls;
	return node;
}

function textEl<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	cls: string,
	text: string,
): HTMLElementTagNameMap[K] {
	const node = el(tag, cls);
	node.textContent = text;
	return node;
}

function chip(text: string, target = false): HTMLElement {
	const c = el("span", target ? "chip chip--target" : "chip");
	c.textContent = text;
	return c;
}

/** Clone a static icon from a <template> defined in the component markup. */
function icon(name: string): DocumentFragment {
	const tpl = document.getElementById(
		`icon-${name}`,
	) as HTMLTemplateElement | null;
	if (!tpl) return document.createDocumentFragment();
	return tpl.content.cloneNode(true) as DocumentFragment;
}

function $<T extends HTMLElement = HTMLElement>(
	sel: string,
	elm: ParentNode = document,
): T | null {
	return elm.querySelector<T>(sel);
}

/** Like $ but throws when the element is missing (markup contract). */
function req$<T extends HTMLElement = HTMLElement>(
	sel: string,
	elm: ParentNode = document,
): T {
	const node = elm.querySelector<T>(sel);
	if (!node) throw new Error(`missing expected element: ${sel}`);
	return node;
}

/** Fetch a static asset from the allowlist only. */
async function fetchAsset(path: string): Promise<Response> {
	if (!ALLOWED_FETCH.has(path)) {
		throw new Error(`fetch of non-allowlisted asset blocked: ${path}`);
	}
	return fetch(new URL(asset(path), document.baseURI).href);
}

/* ---------- URL sync ---------- */

function readParams(): void {
	const p = new URLSearchParams(location.search);
	const side = p.get("side");
	if (side === "unilateral" || side === "bilateral" || side === "either") {
		state.side = side;
	}
	state.q = p.get("q") ?? "";
	state.cat = p.get("cat") ?? "";
	state.eq = p.get("eq") ?? "";
	state.target = p.get("target") ?? "";
	if (p.get("sort") === "name-desc") state.sort = "name-desc";

	// workout selection: comma-separated exercise ids, e.g. ?w=0001,0032,0043
	state.picked.clear();
	const w = p.get("w");
	if (w) {
		for (const id of w.split(",")) {
			const t = id.trim();
			if (t) state.picked.add(t);
		}
	}
	// a shared workout link opens directly in workout view
	state.view = state.picked.size > 0 ? "workout" : "all";
}

function writeParams(): void {
	const p = new URLSearchParams();
	if (state.side !== "all") p.set("side", state.side);
	if (state.q) p.set("q", state.q);
	if (state.cat) p.set("cat", state.cat);
	if (state.eq) p.set("eq", state.eq);
	if (state.target) p.set("target", state.target);
	if (state.sort !== "name") p.set("sort", state.sort);
	// keep raw commas in ?w= (URLSearchParams would percent-encode them);
	// insertion order is preserved so routine order survives the round-trip
	const w = [...state.picked].join(",");
	let qs = p.toString();
	if (w) qs = qs ? `${qs}&w=${w}` : `w=${w}`;
	const qsOut = qs;
	history.replaceState(null, "", qsOut ? `?${qsOut}` : location.pathname);
}

/* ---------- filtering ---------- */

/** The selected exercises, in workout order (Set insertion order). */
function pickedExercises(): Exercise[] {
	const out: Exercise[] = [];
	for (const id of state.picked) {
		const e = state.all.find((x) => x.id === id);
		if (e) out.push(e);
	}
	return out;
}

function applyFilters(): void {
	const q = state.q.trim().toLowerCase();
	const source = state.view === "workout" ? pickedExercises() : state.all;
	state.order = source.filter((e) => {
		if (state.side !== "all" && e.side !== state.side) return false;
		if (state.cat && e.category !== state.cat) return false;
		if (state.eq && e.equipment !== state.eq) return false;
		if (state.target && e.target !== state.target) return false;
		if (q) {
			const hay =
				e.name.toLowerCase() +
				" " +
				e.equipment.toLowerCase() +
				" " +
				e.target.toLowerCase() +
				" " +
				e.muscle_group.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		return true;
	});
	if (state.view !== "workout") {
		state.order.sort((a, b) =>
			state.sort === "name-desc"
				? b.name.localeCompare(a.name)
				: a.name.localeCompare(b.name),
		);
	}
	state.visible = PAGE_SIZE;
}

/* ---------- rendering ---------- */

function buildCard(e: Exercise): HTMLButtonElement {
	const card = el("button", "card") as HTMLButtonElement;
	card.dataset.id = e.id;
	card.dataset.side = e.side;
	card.setAttribute(
		"aria-label",
		`${e.name} — ${SIDE_LABEL[e.side]} — ${e.equipment}`,
	);

	const media = el("span", "card__media");
	const img = el("img");
	img.src = asset(e.image);
	img.alt = "";
	img.loading = "lazy";
	img.decoding = "async";
	img.width = 180;
	img.height = 180;

	const sideBadge = el("span", "card__side");
	sideBadge.dataset.side = e.side;
	sideBadge.append(icon(e.side), textEl("span", "", SIDE_LABEL[e.side]));
	media.append(img, sideBadge);

	const body = el("span", "card__body");
	const name = textEl("span", "card__name", e.name);
	const meta = el("span", "card__meta");
	meta.append(chip(e.target, true), chip(e.equipment));
	body.append(name, meta);

	card.append(media, body);

	if (!prefersReducedMotion) {
		const gifUrl = asset(e.gif_url);
		const thumbUrl = asset(e.image);
		const toGif = () => {
			img.src = gifUrl;
		};
		const toThumb = () => {
			img.src = thumbUrl;
		};
		card.addEventListener("mouseenter", toGif);
		card.addEventListener("mouseleave", toThumb);
		card.addEventListener("focus", toGif);
		card.addEventListener("blur", toThumb);
	}

	card.addEventListener("click", () => openDetail(e.id));
	return card;
}

/** Grid cell: the card plus a workout pick toggle (siblings, not nested). */
function buildCell(e: Exercise): HTMLDivElement {
	const cell = el("div", "cell");
	const card = buildCard(e);
	if (state.picked.has(e.id)) card.classList.add("is-picked");

	const pickBtn = el("button", "card__pick") as HTMLButtonElement;
	pickBtn.type = "button";
	pickBtn.dataset.id = e.id;
	const picked = state.picked.has(e.id);
	pickBtn.setAttribute("aria-pressed", picked ? "true" : "false");
	pickBtn.setAttribute(
		"aria-label",
		picked ? `Remove ${e.name} from workout` : `Add ${e.name} to workout`,
	);
	pickBtn.textContent = picked ? "✓" : "＋";
	pickBtn.addEventListener("click", (ev) => {
		ev.stopPropagation();
		togglePick(e.id);
	});

	cell.append(card, pickBtn);
	return cell;
}

function renderGrid(append = false): void {
	if (!gridEl) return;
	const slice = state.order.slice(0, state.visible);

	if (!append) gridEl.textContent = "";

	if (state.order.length === 0) {
		const empty = el("div", "empty");
		empty.append(
			textEl("strong", "", "No exercises match your filters"),
			textEl(
				"span",
				"",
				"Try widening the side-mode, category or search terms.",
			),
		);
		const reset = el("button", "btn-clear");
		reset.textContent = "Reset all filters";
		reset.addEventListener("click", () => {
			state.side = "all";
			state.q = "";
			state.cat = "";
			state.eq = "";
			state.target = "";
			state.sort = "name";
			syncControls();
			onFilterChange();
		});
		empty.appendChild(reset);
		gridEl.appendChild(empty);
		updateCount();
		updateLoadMore();
		return;
	}

	const frag = document.createDocumentFragment();
	for (const e of slice) frag.appendChild(buildCell(e));
	gridEl.appendChild(frag);
	updateCount();
	updateLoadMore();
}

function updateLoadMore(): void {
	if (!loadMoreEl) return;
	const more = state.visible < state.order.length;
	loadMoreEl.hidden = !more;
}

function updateCount(): void {
	const elm = $(".result-count", rootEl!);
	if (!elm) return;
	elm.textContent = "";
	const total = state.order.length;
	const shown = Math.min(state.visible, total);
	if (state.view === "workout") {
		const strong = el("strong");
		strong.textContent = total.toLocaleString();
		elm.appendChild(strong);
		const unit =
			state.picked.size === 1 ? "workout exercise" : "workout exercises";
		elm.append(
			document.createTextNode(
				total === state.picked.size
					? ` ${unit}`
					: ` of ${state.picked.size} ${unit}` +
							(state.side !== "all" ? ` · ${SIDE_LABEL[state.side]}` : ""),
			),
		);
	} else {
		const strong = el("strong");
		strong.textContent = total.toLocaleString();
		elm.appendChild(strong);
		if (state.side !== "all") {
			elm.append(document.createTextNode(` match · ${SIDE_LABEL[state.side]}`));
		} else if (total !== state.all.length) {
			elm.append(document.createTextNode(" match"));
		} else {
			elm.append(document.createTextNode(" exercises"));
		}
	}
	if (shown < total) {
		elm.append(document.createTextNode(` · showing ${shown}`));
	}
}

function renderStats(): void {
	const elm = $(".stats-line", rootEl!);
	if (!elm) return;
	const c = { unilateral: 0, bilateral: 0, either: 0 };
	for (const e of state.all) c[e.side]++;

	elm.textContent = "";
	const strong = el("strong");
	strong.textContent = state.all.length.toLocaleString();
	elm.append(strong, document.createTextNode(" exercises · "));
	const segs: Array<[number, string, string]> = [
		[c.unilateral, "stats-uni", "each-side"],
		[c.bilateral, "stats-bi", "both-sides"],
		[c.either, "stats-ei", "either-way"],
	];
	segs.forEach(([n, cls, label], i) => {
		const span = el("span", cls);
		span.textContent = `${n}`;
		elm.append(span, document.createTextNode(` ${label}`));
		if (i < segs.length - 1) elm.append(document.createTextNode(" · "));
	});
}

function populateSelects(): void {
	const cats = [...new Set(state.all.map((e) => e.category))].sort();
	const eqs = [...new Set(state.all.map((e) => e.equipment))].sort();
	const targets = [...new Set(state.all.map((e) => e.target))].sort();

	const fill = (sel: HTMLSelectElement, values: string[]) => {
		sel.textContent = "";
		const all = new Option(sel.dataset.placeholder ?? "All", "");
		sel.appendChild(all);
		for (const v of values) sel.appendChild(new Option(v, v));
	};
	fill(req$<HTMLSelectElement>('select[data-kind="cat"]', rootEl!), cats);
	fill(req$<HTMLSelectElement>('select[data-kind="eq"]', rootEl!), eqs);
	fill(req$<HTMLSelectElement>('select[data-kind="target"]', rootEl!), targets);
}

/* ---------- workout selection (shared via URL ?w=) ---------- */

function isRoutineActive(r: Routine): boolean {
	return (
		r.ids.length === state.picked.size &&
		r.ids.every((id) => state.picked.has(id))
	);
}

function currentRoutine(): Routine | null {
	if (state.picked.size === 0) return null;
	for (const r of ROUTINES) {
		if (isRoutineActive(r)) return r;
	}
	return null;
}

function categoryLabel(cat: RoutineCategory): string {
	return ROUTINE_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
}

function applyRoutine(r: Routine): void {
	state.picked.clear();
	for (const id of r.ids) state.picked.add(id);
	// safety net: drop any id that is not in the loaded dataset
	for (const id of [...state.picked]) {
		if (!state.all.some((e) => e.id === id)) state.picked.delete(id);
	}
	state.activeCat = r.category;
	state.view = "workout"; // show the routine itself, not the whole library
	updatePickedUI();
	renderRoutines();
	onFilterChange();
}

/** Render the quick-routines strip (category chips + this category's routines). */
function renderRoutines(): void {
	const wrap = $(".routines", rootEl!);
	if (!wrap) return;
	const catRow = $(".routines__cats", wrap);
	const varRow = $(".routines__vars", wrap);
	if (!catRow || !varRow) return;

	catRow.textContent = "";
	for (const c of ROUTINE_CATEGORIES) {
		const b = el("button", "routines__cat") as HTMLButtonElement;
		b.type = "button";
		b.dataset.cat = c.id;
		b.textContent = c.label;
		b.setAttribute("aria-pressed", state.activeCat === c.id ? "true" : "false");
		catRow.appendChild(b);
	}

	varRow.textContent = "";
	for (const r of ROUTINES) {
		if (r.category !== state.activeCat) continue;
		const b = el("button", "routines__var") as HTMLButtonElement;
		b.type = "button";
		b.dataset.routine = r.id;
		b.title = r.hint;
		const active = isRoutineActive(r);
		b.setAttribute("aria-pressed", active ? "true" : "false");
		b.append(
			textEl("span", "routines__var-code", r.code),
			textEl("span", "routines__var-label", r.label),
			textEl("span", "routines__var-count", String(r.ids.length)),
		);
		varRow.appendChild(b);
	}
}

function togglePick(id: string): void {
	if (state.picked.has(id)) {
		state.picked.delete(id);
	} else {
		state.picked.add(id);
	}
	// an emptied workout view falls back to the full library
	if (state.view === "workout" && state.picked.size === 0) {
		state.view = "all";
	}
	updatePickedUI();
	writeParams();
	onFilterChange();
}

function clearPicked(): void {
	state.picked.clear();
	state.view = "all";
	updatePickedUI();
	writeParams();
	onFilterChange();
}

/** Keep the tray, visible cards and overlay button in sync with the selection. */
function updatePickedUI(): void {
	const tray = $(".workout-tray", rootEl!);
	if (tray) {
		const n = state.picked.size;
		tray.hidden = n === 0;
		document.body.classList.toggle("workout-active", n > 0);
		const countEl = $(".workout-tray__count strong", tray);
		if (countEl) countEl.textContent = String(n);
		const hint = $(".workout-tray__hint", tray);
		if (hint) {
			const r = currentRoutine();
			hint.textContent = r
				? `${categoryLabel(r.category)} · ${r.code} ${r.label} — tap exercises to tweak`
				: "Saved in the URL — share the link, no login needed.";
		}
	}

	for (const cell of rootEl!.querySelectorAll<HTMLElement>(".cell")) {
		const card = $<HTMLButtonElement>(".card", cell);
		if (!card) continue;
		const id = card.dataset.id ?? "";
		const picked = state.picked.has(id);
		card.classList.toggle("is-picked", picked);
		const btn = $<HTMLButtonElement>(".card__pick", cell);
		if (btn) {
			btn.setAttribute("aria-pressed", picked ? "true" : "false");
			btn.textContent = picked ? "✓" : "＋";
			btn.setAttribute(
				"aria-label",
				picked ? `Remove ${id} from workout` : `Add ${id} to workout`,
			);
		}
	}

	const ov = $<HTMLButtonElement>(".overlay__pick", rootEl!);
	if (ov && state.selected >= 0 && state.order[state.selected]) {
		const picked = state.picked.has(state.order[state.selected].id);
		ov.setAttribute("aria-pressed", picked ? "true" : "false");
		ov.classList.toggle("is-picked", picked);
		const label = $(".overlay__pick-label", ov);
		if (label)
			label.textContent = picked ? "In workout ✓" : "＋ Add to workout";
	}

	// routine chips: a routine is only "active" while the selection matches it exactly
	for (const b of rootEl!.querySelectorAll<HTMLButtonElement>(
		".routines__var",
	)) {
		const r = ROUTINES.find((x) => x.id === b.dataset.routine);
		b.setAttribute("aria-pressed", r && isRoutineActive(r) ? "true" : "false");
	}

	// view toggle (workout vs all exercises)
	const viewbar = $(".viewbar", rootEl!);
	if (viewbar) {
		viewbar.hidden = state.picked.size === 0;
		const count = $(".viewbar__count", viewbar);
		if (count) count.textContent = String(state.picked.size);
		for (const b of viewbar.querySelectorAll<HTMLButtonElement>(
			".seg__btn[data-view]",
		)) {
			b.setAttribute(
				"aria-pressed",
				b.dataset.view === state.view ? "true" : "false",
			);
		}
	}
}

function legacyCopy(text: string): boolean {
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.style.position = "fixed";
	ta.style.opacity = "0";
	ta.style.pointerEvents = "none";
	document.body.appendChild(ta);
	ta.select();
	let ok = false;
	try {
		// execCommand is deprecated but remains the only last-resort copy path
		// outside the async Clipboard API; access it without the typed signature.
		const execCopy = (
			document as unknown as {
				execCommand(cmd: string): boolean;
			}
		).execCommand;
		ok = execCopy.call(document, "copy");
	} catch {
		ok = false;
	}
	ta.remove();
	return ok;
}

function shareWorkout(): void {
	const btn = $<HTMLButtonElement>(".workout-tray__share", rootEl!);
	// writeParams keeps location.href in sync, so the current URL is the share link
	const url = location.href;
	const done = () => {
		if (!btn) return;
		btn.textContent = "Copied ✓";
		window.setTimeout(() => {
			btn.textContent = "Copy share link";
		}, 1600);
	};
	const fail = () => {
		if (!btn) return;
		btn.textContent = "Copy from address bar";
		window.setTimeout(() => {
			btn.textContent = "Copy share link";
		}, 4000);
	};
	if (navigator.clipboard?.writeText) {
		navigator.clipboard.writeText(url).then(done, () => {
			if (legacyCopy(url)) done();
			else fail();
		});
	} else if (legacyCopy(url)) {
		done();
	} else {
		fail();
	}
}

/* ---------- detail overlay ---------- */

function openDetail(id: string): void {
	const idx = state.order.findIndex((e) => e.id === id);
	if (idx < 0) return;
	state.selected = idx;
	renderDetail();
	if (overlayEl) {
		overlayEl.classList.add("is-open");
		lastFocused = document.activeElement as HTMLElement;
		document.body.style.overflow = "hidden";
		$(".icon-btn--close", overlayEl)?.focus();
	}
}

function closeDetail(): void {
	if (!overlayEl) return;
	overlayEl.classList.remove("is-open");
	document.body.style.overflow = "";
	lastFocused?.focus();
	state.selected = -1;
}

function stepDetail(dir: 1 | -1): void {
	if (state.selected < 0 || state.order.length === 0) return;
	const n = state.order.length;
	state.selected = (state.selected + dir + n) % n;
	renderDetail();
}

function renderDetail(): void {
	if (!overlayEl) return;
	const e = state.order[state.selected];
	if (!e) return;

	const r = SIDE_RATIONALE[e.side];
	const pos = `${state.selected + 1} / ${state.order.length}`;

	const navLabel = $(".overlay__nav-label", overlayEl);
	if (navLabel) navLabel.textContent = pos;
	const prev = req$<HTMLButtonElement>(".icon-btn--prev", overlayEl);
	const next = req$<HTMLButtonElement>(".icon-btn--next", overlayEl);
	prev.disabled = state.order.length < 2;
	next.disabled = state.order.length < 2;

	const scroll = $(".overlay__scroll", overlayEl)!;
	scroll.textContent = "";

	// media
	const media = el("div", "detail-media");
	const img = el("img");
	img.src = asset(e.image);
	img.alt = `Animation preview of ${e.name}`;
	img.width = 360;
	img.height = 360;
	img.decoding = "async";
	media.appendChild(img);

	// side-mode rationale card
	const sideBox = el("div", "detail-side");
	sideBox.dataset.side = e.side;
	const sideTitle = el("div", "detail-side__title");
	sideTitle.append(icon(e.side), textEl("span", "", r.title));
	const ul = el("ul");
	for (const p of r.points) {
		const li = textEl("li", "", p);
		ul.appendChild(li);
	}
	sideBox.append(sideTitle, ul);

	const idLine = textEl(
		"div",
		"detail-id",
		`Exercise #${e.id} · ${e.category}`,
	);
	const title = textEl("h2", "detail-title", e.name);

	const tags = el("div", "detail-tags");
	tags.append(
		chip(e.target, true),
		chip(e.equipment),
		chip(e.category),
		chip(e.body_part),
	);

	const stepsBlock = el("div", "detail-block");
	stepsBlock.appendChild(textEl("h3", "", "How to perform"));
	if (e.steps.length > 0) {
		const ol = el("ol", "steps");
		for (const s of e.steps) ol.appendChild(textEl("li", "", s));
		stepsBlock.appendChild(ol);
	} else if (e.instructions) {
		stepsBlock.appendChild(textEl("p", "detail-paragraph", e.instructions));
	} else {
		stepsBlock.appendChild(
			textEl(
				"p",
				"detail-paragraph detail-paragraph--muted",
				"No instructions available.",
			),
		);
	}

	const muscles = [e.muscle_group, ...e.secondary_muscles].filter(Boolean);
	const muscleBlock = el("div", "detail-block");
	if (muscles.length > 0) {
		muscleBlock.appendChild(textEl("h3", "", "Involved muscles"));
		const list = el("div", "muscle-list");
		list.appendChild(chip(e.target, true));
		for (const m of muscles) list.appendChild(chip(m));
		muscleBlock.appendChild(list);
	}

	const note = el("p", "attribution-note");
	note.append(
		document.createTextNode(
			`Side-mode tag: ${SIDE_SHORT[e.side]} — ${r.tag}. Exercise data & animation © Gym Visual, via the `,
		),
	);
	const repo = el("a");
	repo.href = "https://github.com/hasaneyldrm/exercises-dataset";
	repo.target = "_blank";
	repo.rel = "noopener";
	repo.textContent = "exercises-dataset";
	const lic = el("a");
	lic.href = asset("DATASET-LICENSE.txt");
	lic.target = "_blank";
	lic.rel = "noopener";
	lic.textContent = "license";
	const not = el("a");
	not.href = asset("DATASET-NOTICE.md");
	not.target = "_blank";
	not.rel = "noopener";
	not.textContent = "notice";
	note.append(
		repo,
		document.createTextNode(" repo · "),
		lic,
		document.createTextNode(" · "),
		not,
		document.createTextNode(")."),
	);

	scroll.append(
		media,
		sideBox,
		idLine,
		title,
		tags,
		stepsBlock,
		muscleBlock,
		note,
	);

	if (!prefersReducedMotion) {
		const gifUrl = asset(e.gif_url);
		const swap = () => {
			img.src = gifUrl;
			img.removeEventListener("mouseenter", swap);
		};
		img.addEventListener("mouseenter", swap);
	}
	scroll.scrollTop = 0;
	updatePickedUI(); // keep the "add to workout" button in sync
}

/* ---------- events ---------- */

function onFilterChange(syncUrl = true): void {
	applyFilters();
	renderGrid(false);
	if (syncUrl) writeParams();
}

function syncSideControls(): void {
	for (const btn of rootEl!.querySelectorAll<HTMLButtonElement>(
		".seg__btn[data-side]",
	)) {
		btn.setAttribute(
			"aria-pressed",
			btn.dataset.side === state.side ? "true" : "false",
		);
	}
	for (const card of rootEl!.querySelectorAll<HTMLElement>(".side-card")) {
		card.classList.toggle("is-active", card.dataset.side === state.side);
	}
}

function syncControls(): void {
	syncSideControls();
	const search = req$<HTMLInputElement>(
		".filterbar input[type='search']",
		rootEl!,
	);
	search.value = state.q;
	req$<HTMLSelectElement>('select[data-kind="cat"]', rootEl!).value = state.cat;
	req$<HTMLSelectElement>('select[data-kind="eq"]', rootEl!).value = state.eq;
	req$<HTMLSelectElement>('select[data-kind="target"]', rootEl!).value =
		state.target;
	req$<HTMLSelectElement>('select[data-kind="sort"]', rootEl!).value =
		state.sort;
}

function bindEvents(): void {
	rootEl!.addEventListener("click", (ev) => {
		const t = ev.target as HTMLElement;
		const viewBtn = t.closest<HTMLButtonElement>(
			".viewbar .seg__btn[data-view]",
		);
		if (viewBtn && viewBtn.dataset.view) {
			state.view = viewBtn.dataset.view as State["view"];
			updatePickedUI();
			onFilterChange();
			return;
		}
		const catBtn = t.closest<HTMLButtonElement>(".routines__cat");
		if (catBtn && catBtn.dataset.cat) {
			state.activeCat = catBtn.dataset.cat as RoutineCategory;
			renderRoutines();
			return;
		}
		const routineBtn = t.closest<HTMLButtonElement>(".routines__var");
		if (routineBtn && routineBtn.dataset.routine) {
			const r = ROUTINES.find((x) => x.id === routineBtn.dataset.routine);
			if (r) applyRoutine(r);
			return;
		}
		const seg = t.closest<HTMLButtonElement>(".seg__btn[data-side]");
		if (seg) {
			state.side = seg.dataset.side as State["side"];
			syncSideControls();
			onFilterChange();
			return;
		}
		const sideCard = t.closest<HTMLElement>(".side-card[data-side]");
		if (sideCard) {
			state.side = sideCard.dataset.side as State["side"];
			syncSideControls();
			onFilterChange();
			sideCard.scrollIntoView({ block: "nearest" });
			return;
		}
		if (t.closest(".btn-clear")) {
			state.side = "all";
			state.q = "";
			state.cat = "";
			state.eq = "";
			state.target = "";
			state.sort = "name";
			syncControls();
			onFilterChange();
			return;
		}
		if (t.closest(".load-more")) {
			state.visible += PAGE_SIZE;
			renderGrid(true);
		}
	});

	const search = req$<HTMLInputElement>(
		".filterbar input[type='search']",
		rootEl!,
	);
	search.addEventListener("input", () => {
		state.q = search.value;
		onFilterChange();
	});

	for (const kind of ["cat", "eq", "target"] as const) {
		const sel = req$<HTMLSelectElement>(`select[data-kind="${kind}"]`, rootEl!);
		sel.addEventListener("change", () => {
			(state as unknown as Record<string, string>)[kind] = sel.value;
			onFilterChange();
		});
	}

	const sortSel = req$<HTMLSelectElement>('select[data-kind="sort"]', rootEl!);
	sortSel.addEventListener("change", () => {
		state.sort = sortSel.value as State["sort"];
		onFilterChange();
	});

	$(".overlay__backdrop", rootEl!)?.addEventListener("click", closeDetail);
	$(".icon-btn--close", rootEl!)?.addEventListener("click", closeDetail);
	$(".icon-btn--prev", rootEl!)?.addEventListener("click", () =>
		stepDetail(-1),
	);
	$(".icon-btn--next", rootEl!)?.addEventListener("click", () => stepDetail(1));
	$(".overlay__pick", rootEl!)?.addEventListener("click", () => {
		if (state.selected >= 0 && state.order[state.selected]) {
			togglePick(state.order[state.selected].id);
		}
	});
	$(".workout-tray__share", rootEl!)?.addEventListener("click", shareWorkout);
	$(".workout-tray__clear", rootEl!)?.addEventListener("click", clearPicked);

	document.addEventListener("keydown", (ev) => {
		if (ev.key === "Escape" && overlayEl?.classList.contains("is-open")) {
			closeDetail();
			return;
		}
		const typing =
			ev.target instanceof HTMLInputElement ||
			ev.target instanceof HTMLSelectElement ||
			ev.target instanceof HTMLTextAreaElement;
		if (typing) return;
		if (ev.key === "/") {
			ev.preventDefault();
			search.focus();
		} else if (overlayEl?.classList.contains("is-open")) {
			if (ev.key === "ArrowLeft") stepDetail(-1);
			if (ev.key === "ArrowRight") stepDetail(1);
		}
	});

	window.addEventListener("popstate", () => {
		readParams();
		syncControls();
		onFilterChange(false);
	});

	observer = new IntersectionObserver(
		(entries) => {
			if (
				entries.some((en) => en.isIntersecting) &&
				state.visible < state.order.length
			) {
				state.visible += PAGE_SIZE;
				renderGrid(true);
			}
		},
		{ rootMargin: "600px" },
	);
	if (sentinelEl) observer.observe(sentinelEl);
}

/* ---------- boot ---------- */

export async function init(root: HTMLElement): Promise<void> {
	rootEl = root;
	gridEl = $(".grid", root);
	sentinelEl = $(".grid-sentinel", root);
	overlayEl = $(".overlay", root);
	loadMoreEl = $<HTMLButtonElement>(".load-more", root);

	readParams();

	const res = await fetchAsset("data/exercises.json");
	if (!res.ok) throw new Error(`failed to load exercises: ${res.status}`);
	state.all = (await res.json()) as Exercise[];

	// drop any ?w= ids that do not exist in the dataset
	for (const id of [...state.picked]) {
		if (!state.all.some((e) => e.id === id)) state.picked.delete(id);
	}

	// if the restored selection is exactly a routine, surface its category
	const matched = currentRoutine();
	if (matched) state.activeCat = matched.category;

	renderStats();
	populateSelects();
	syncControls();
	bindEvents();
	applyFilters();
	renderGrid(false);
	renderRoutines();
	updatePickedUI();
	writeParams();
}
