/* ============================================================
   Predetermined routines — curated exercise lists grouped by
   training focus. Every id below exists in the dataset bundle
   (public/data/exercises.json); applyRoutine() still validates
   against the loaded data as a safety net.

   Clicking a routine fills the workout selection (?w=…) — purely
   client-side, shareable via URL, no login.
   ============================================================ */

export type RoutineCategory =
	| "full-body"
	| "core"
	| "lower"
	| "upper"
	| "running"
	| "cycling"
	| "swimming";

export interface Routine {
	id: string;
	category: RoutineCategory;
	code: string; // A / B / C within the category
	label: string;
	hint: string;
	ids: string[];
}

export const ROUTINE_CATEGORIES: { id: RoutineCategory; label: string }[] = [
	{ id: "full-body", label: "Full body" },
	{ id: "core", label: "Core" },
	{ id: "lower", label: "Lower" },
	{ id: "upper", label: "Upper" },
	{ id: "running", label: "Running" },
	{ id: "cycling", label: "Cycling" },
	{ id: "swimming", label: "Swimming" },
];

export const ROUTINES: Routine[] = [
	/* ---------------- full body ---------------- */
	{
		id: "full-body-strength",
		category: "full-body",
		code: "A",
		label: "Strength",
		hint: "Heavy compounds across the whole body — squat, deadlift, press, row, pull-up.",
		ids: [
			"0043",
			"0032",
			"0025",
			"0027",
			"1457",
			"0652",
			"0054",
			"0464",
			"0549",
		],
	},
	{
		id: "full-body-hypertrophy",
		category: "full-body",
		code: "B",
		label: "Hypertrophy",
		hint: "Higher-volume mix of free weights and machines for size across all muscle groups.",
		ids: [
			"0042",
			"0117",
			"0289",
			"0293",
			"0426",
			"0251",
			"0313",
			"0201",
			"0334",
		],
	},
	{
		id: "full-body-quick",
		category: "full-body",
		code: "C",
		label: "Quick 20",
		hint: "Compact compound circuit — a whole-body session in ~20 minutes.",
		ids: ["0032", "1760", "0025", "0652", "0027", "0054", "0464", "1160"],
	},
	{
		id: "full-body-noequip",
		category: "full-body",
		code: "D",
		label: "No equipment",
		hint: "Bodyweight only — pull-ups, push-ups, dips and jumps, anywhere.",
		ids: [
			"0652",
			"0283",
			"0251",
			"0464",
			"3470",
			"3543",
			"1160",
			"0484",
			"1471",
		],
	},

	/* ---------------- core ---------------- */
	{
		id: "core-stability",
		category: "core",
		code: "A",
		label: "Stability",
		hint: "Isometric and anti-movement work: planks, dead bugs, carries, crawling.",
		ids: [
			"0464",
			"1775",
			"0276",
			"0630",
			"0472",
			"3663",
			"0006",
			"0459",
			"3360",
		],
	},
	{
		id: "core-power",
		category: "core",
		code: "B",
		label: "Power & rotation",
		hint: "Dynamic trunk work — twists, sit-up variations, jack-knives, v-ups.",
		ids: ["0014", "0972", "0981", "0872", "0001", "0969", "1471", "1314"],
	},
	{
		id: "core-obliques",
		category: "core",
		code: "C",
		label: "Obliques & anti-rotation",
		hint: "Side-dominant and anti-rotation moves to keep the trunk balanced.",
		ids: ["3544", "1011", "0242", "2963", "1774", "3667", "0459", "0006"],
	},
	{
		id: "core-noequip",
		category: "core",
		code: "D",
		label: "No equipment",
		hint: "Bodyweight core — planks, dead bugs, leg raises, no gear needed.",
		ids: [
			"0464",
			"3544",
			"0276",
			"0630",
			"0472",
			"0872",
			"0507",
			"0006",
			"0459",
		],
	},

	/* ---------------- lower ---------------- */
	{
		id: "lower-strength",
		category: "lower",
		code: "A",
		label: "Strength",
		hint: "The big leg builders: squat, deadlift, lunge, hinge, calf and bridge work.",
		ids: ["0043", "0032", "0054", "1409", "0586", "1372", "0114", "0085"],
	},
	{
		id: "lower-hypertrophy",
		category: "lower",
		code: "B",
		label: "Hypertrophy",
		hint: "Higher-volume quads, hamstrings, glutes, calves and hip work.",
		ids: [
			"0042",
			"0117",
			"0585",
			"0489",
			"0088",
			"0168",
			"0597",
			"0284",
			"0044",
		],
	},
	{
		id: "lower-unilateral",
		category: "lower",
		code: "C",
		label: "Unilateral focus",
		hint: "One side at a time — train each leg in balance, great for symmetry.",
		ids: ["1757", "0544", "1410", "0078", "0999", "0431", "1386", "3013"],
	},
	{
		id: "lower-noequip",
		category: "lower",
		code: "D",
		label: "No equipment",
		hint: "Bodyweight legs — pistols, lunges, calf raises, jumps and hops.",
		ids: ["1759", "3470", "3769", "1373", "3013", "3222", "3361", "1490"],
	},

	/* ---------------- upper ---------------- */
	{
		id: "upper-strength",
		category: "upper",
		code: "A",
		label: "Strength",
		hint: "Press, pull, overhead and dip patterns for maximal pushing/pulling strength.",
		ids: ["0025", "0027", "0652", "1457", "0313", "0201", "0251", "2330"],
	},
	{
		id: "upper-hypertrophy",
		category: "upper",
		code: "B",
		label: "Hypertrophy",
		hint: "Dumbbell-and-cable volume: presses, rows, curls, raises and flies.",
		ids: [
			"0289",
			"0314",
			"0293",
			"0426",
			"0318",
			"0375",
			"0202",
			"0334",
			"0139",
		],
	},
	{
		id: "upper-push-pull",
		category: "upper",
		code: "C",
		label: "Push / pull balance",
		hint: "Even push and pull volume plus single-arm work to balance both sides.",
		ids: ["0047", "0861", "0017", "0310", "0993", "0189", "0577", "0375"],
	},
	{
		id: "upper-noequip",
		category: "upper",
		code: "D",
		label: "No equipment",
		hint: "Bodyweight upper — pull-ups, dips, push-up variations and handstands.",
		ids: [
			"0652",
			"0251",
			"0283",
			"0493",
			"0259",
			"1273",
			"0129",
			"3302",
			"0471",
		],
	},

	/* ---------------- running ---------------- */
	{
		id: "run-strength-power",
		category: "running",
		code: "A",
		label: "Strength & power",
		hint: "Single-leg strength and plyometrics that carry over to running economy.",
		ids: [
			"1756",
			"0054",
			"0114",
			"3222",
			"1374",
			"1373",
			"1409",
			"3361",
			"1160",
		],
	},
	{
		id: "run-stability-mobility",
		category: "running",
		code: "B",
		label: "Stability & mobility",
		hint: "Balance, ankle strength and hip mobility — the runner's maintenance work.",
		ids: ["1757", "0999", "0431", "3013", "3636", "1775", "1559", "0276"],
	},
	{
		id: "run-sprint-speed",
		category: "running",
		code: "C",
		label: "Sprint & speed prep",
		hint: "Pistols, reactive hops and hip-drive work for faster, sharper strides.",
		ids: ["0544", "1410", "0078", "0597", "0168", "1008", "1386", "1490"],
	},
	{
		id: "run-noequip",
		category: "running",
		code: "D",
		label: "No equipment",
		hint: "Bodyweight runner prep — lunges, hops, calf raises, no gym needed.",
		ids: [
			"3470",
			"3582",
			"3361",
			"3222",
			"1373",
			"3636",
			"1160",
			"3013",
			"1759",
		],
	},

	/* ---------------- cycling ---------------- */
	{
		id: "bike-leg-strength",
		category: "cycling",
		code: "A",
		label: "Leg strength",
		hint: "Squat, hinge, extension and calf work to push a bigger gear.",
		ids: ["0043", "0054", "0085", "0586", "1372", "1409", "0585", "0044"],
	},
	{
		id: "bike-pedal-stability",
		category: "cycling",
		code: "B",
		label: "Pedal stability",
		hint: "Unilateral leg and hip work for a smooth, even pedal stroke.",
		ids: ["0999", "0544", "1008", "1757", "0597", "0168", "3013", "0276"],
	},
	{
		id: "bike-recovery-core",
		category: "cycling",
		code: "C",
		label: "Recovery & core",
		hint: "Lighter trunk, back and hip-opening work for off-the-bike days.",
		ids: ["0014", "0630", "0472", "1559", "0488", "1314", "3663", "0006"],
	},
	{
		id: "bike-noequip",
		category: "cycling",
		code: "D",
		label: "No equipment",
		hint: "Bodyweight legs and core for riders — squats, bridges, calf raises, planks.",
		ids: [
			"3769",
			"1688",
			"0484",
			"1373",
			"1490",
			"3013",
			"3222",
			"0464",
			"0276",
		],
	},

	/* ---------------- swimming ---------------- */
	{
		id: "swim-pull",
		category: "swimming",
		code: "A",
		label: "Pull strength",
		hint: "Lat and upper-back volume to drive a stronger, longer pull.",
		ids: ["0652", "2330", "0861", "0007", "0293", "0139", "0202", "0993"],
	},
	{
		id: "swim-rotator-posture",
		category: "swimming",
		code: "B",
		label: "Rotator cuff & posture",
		hint: "Shoulder stability and rear-delt work to bulletproof the swimmer's shoulder.",
		ids: ["0235", "1022", "0334", "0310", "0201", "2144", "0864", "3664"],
	},
	{
		id: "swim-core-rotation",
		category: "swimming",
		code: "C",
		label: "Core & rotation",
		hint: "Rotational trunk control to link hips and shoulders through the stroke.",
		ids: ["0014", "0972", "0472", "0464", "0630", "0276", "3544", "0001"],
	},
	{
		id: "swim-noequip",
		category: "swimming",
		code: "D",
		label: "No equipment",
		hint: "Bodyweight swimmer prep — pull-ups, push-ups, kick work and core.",
		ids: [
			"0652",
			"0283",
			"0803",
			"0464",
			"0459",
			"0472",
			"3544",
			"0489",
			"0630",
		],
	},
];
