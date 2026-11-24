/**
 * Plan review overlay: the plan rendered as scrollable Markdown plus the
 * approval choices (keep / compact / refine / save).
 *
 * The overlay is a right-half floating rectangle composited over the live main
 * screen. Column 0 of every line is the vertical border; the left half shows the
 * pi main screen clipped at that border column.
 * shortcut: the left half is the live main screen clipped at the border, not
 * reflowed — pi 1.6.0 has no split-pane layout API.
 *
 * Body and actions are two focus regions; Tab switches, Esc dismisses.
 * The overlay is closed only by resolving the pick through done().
 */

import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Markdown, ScrollView, matchesKey, truncateToWidth, type Component, type KeybindingsManager, type TUI } from "@earendil-works/pi-tui";

export type ReviewPick = "keep" | "compact" | "refine" | "save" | null;

export interface ReviewOverlayChoice {
	id: Exclude<ReviewPick, null>;
	label: string;
	detail: string;
}

export interface ReviewOverlayOptions {
	slug: string;
	planContent: string;
	choices: ReviewOverlayChoice[];
}

interface PlanReviewOverlayArgs extends ReviewOverlayOptions {
	tui: TUI;
	theme: Theme;
	keybindings: KeybindingsManager;
	done: (pick: ReviewPick) => void;
}

type FocusRegion = "body" | "actions";

const HINT = "Tab: toggle focus · j/k or ↑↓: scroll or select · Enter: confirm · Esc: dismiss";

export class PlanReviewOverlay implements Component {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly slug: string;
	private readonly choices: ReviewOverlayChoice[];
	private readonly markdown: Markdown;
	private readonly scroll: ScrollView;
	private readonly done: (pick: ReviewPick) => void;
	private focus: FocusRegion = "body";
	private selected = 0;
	private settled = false;
	private cachedWidth = -1;
	private cachedRows = -1;
	private cachedLines: readonly string[] = [];

	constructor(options: PlanReviewOverlayArgs) {
		this.tui = options.tui;
		this.theme = options.theme;
		this.slug = options.slug;
		this.choices = options.choices;
		this.done = options.done;
		this.markdown = new Markdown(options.planContent, 0, 0, getMarkdownTheme());
		this.scroll = new ScrollView(this.markdown, { primary: true, scrollbar: "hidden" });
	}

	render(width: number): readonly string[] {
		const rows = this.tui.terminal.rows;
		if (this.cachedWidth === width && this.cachedRows === rows) return this.cachedLines;

		const safeWidth = Math.max(1, width);
		// Column 0 is the border, column 1 the gap; content starts at column 2.
		const contentWidth = Math.max(1, width - 2);
		const prefixed = (line: string) => truncateToWidth(this.theme.fg("border", "│") + " " + line, safeWidth);
		const bodyHeight = this.bodyHeight();
		const content = this.scroll.render(contentWidth);
		// Overlays skip pi-tui's layout pass, so the viewport is clamped here.
		this.scroll.updateLayout(content.length, bodyHeight, () => this.dirty());
		const top = this.scroll.scrollTop;

		const lines: string[] = [
			prefixed(this.theme.fg("accent", `Plan Review — ${this.slug}`)),
			prefixed(""),
		];
		for (const line of content.slice(top, top + bodyHeight)) lines.push(prefixed(line));
		lines.push(prefixed(this.theme.fg("borderMuted", "─".repeat(contentWidth))));

		for (let index = 0; index < this.choices.length; index++) {
			const choice = this.choices[index];
			const active = this.focus === "actions" && index === this.selected;
			const marker = active ? "❯ " : "  ";
			lines.push(prefixed(marker + (active ? this.theme.fg("accent", choice.label) : choice.label)));
			lines.push(prefixed("    " + this.theme.fg("muted", choice.detail)));
		}

		lines.push(prefixed(this.theme.fg("dim", HINT)));
		this.cachedWidth = width;
		this.cachedRows = rows;
		this.cachedLines = lines;
		return lines;
	}

	handleInput(data: string): void {
		if (this.settled) return;

		if (matchesKey(data, "escape")) {
			this.finish(null);
			return;
		}
		if (matchesKey(data, "tab") || matchesKey(data, "shift+tab")) {
			this.focus = this.focus === "body" ? "actions" : "body";
			this.dirty();
			return;
		}

		if (this.focus === "body") {
			if (matchesKey(data, "j") || matchesKey(data, "down")) this.scroll.scrollBy(1);
			else if (matchesKey(data, "k") || matchesKey(data, "up")) this.scroll.scrollBy(-1);
			return;
		}

		if (matchesKey(data, "down")) {
			this.selected = (this.selected + 1) % this.choices.length;
			this.dirty();
			return;
		}
		if (matchesKey(data, "up")) {
			this.selected = (this.selected - 1 + this.choices.length) % this.choices.length;
			this.dirty();
			return;
		}
		if (matchesKey(data, "return")) {
			const choice = this.choices[this.selected];
			if (choice) this.finish(choice.id);
		}
	}

	invalidate(): void {
		this.cachedWidth = -1;
		this.markdown.invalidate();
	}

	private bodyHeight(): number {
		const overhead = 2 + 1 + 2 * this.choices.length + 1;
		return Math.max(1, this.tui.terminal.rows - overhead);
	}

	private dirty(): void {
		this.invalidate();
		this.tui.requestRender();
	}

	private finish(pick: ReviewPick): void {
		if (this.settled) return;
		this.settled = true;
		this.done(pick);
	}
}

export function planReviewOverlay(options: ReviewOverlayOptions): (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (pick: ReviewPick) => void) => PlanReviewOverlay {
	return (tui, theme, keybindings, done) => new PlanReviewOverlay({ ...options, tui, theme, keybindings, done });
}
