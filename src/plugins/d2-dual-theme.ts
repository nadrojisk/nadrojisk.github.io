import postcss from "postcss";
import type { HastPluginDefinition } from "satteri";

const DARK_MEDIA_PATTERN = /prefers-color-scheme/;
const STYLE_BLOCK_PATTERN = /<style[^>]*>([\s\S]*?)<\/style>/g;
const CDATA_PATTERN = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/;
const SCOPE_ID_PATTERN = /\bd2-\d+\b/;

/** Split a D2-generated stylesheet into a light-only and a dark-only variant.
 *  Structural, not class-based: it moves whatever rules D2 put inside the
 *  `@media (prefers-color-scheme: dark)` block it already emits, so this
 *  keeps working if D2 changes or adds theme classes. Returns `undefined`
 *  when the stylesheet has no dark-mode media block to split (e.g. a block
 *  configured to render a single theme only). */
function splitD2ThemeCss(css: string): { light: string; dark: string } | undefined {
	const root = postcss.parse(css);
	const hasDarkMedia = root.nodes.some(
		(node) =>
			node.type === "atrule" && node.name === "media" && DARK_MEDIA_PATTERN.test(node.params),
	);
	if (!hasDarkMedia) return undefined;

	const lightRoot = root.clone();
	lightRoot.walkAtRules("media", (rule) => {
		if (DARK_MEDIA_PATTERN.test(rule.params)) rule.remove();
	});

	const darkRoot = root.clone();
	darkRoot.walkAtRules("media", (rule) => {
		if (!DARK_MEDIA_PATTERN.test(rule.params)) return;
		// Re-append the dark declarations unwrapped, after the base ones, so
		// they win by source order at equal specificity, then drop the
		// (OS-only) media wrapper -- this is what makes the site's manual
		// `data-theme` toggle apply the same rules the media query would.
		rule.after((rule.nodes ?? []).map((child) => child.clone()));
		rule.remove();
	});

	return { light: lightRoot.toString(), dark: darkRoot.toString() };
}

/** Replace the single `<style>` block (of possibly several -- D2 also emits
 *  one for @font-face rules) that carries the dark-mode media query. */
function withStyleContent(
	svgHtml: string,
	matchStart: number,
	matchEnd: number,
	wasCdata: boolean,
	css: string,
) {
	const replacement = wasCdata ? `<![CDATA[${css}]]>` : css;
	return svgHtml.slice(0, matchStart) + replacement + svgHtml.slice(matchEnd);
}

/** Give a clone its own scope id. Inline `<style>` tags aren't scoped to
 *  their containing SVG -- they apply to the whole document -- so the light
 *  and dark clones must not share D2's `d2-<hash>` class/font-family prefix,
 *  or the one later in the DOM wins for both (which is what made every
 *  diagram render as whichever variant came last, regardless of the toggle). */
function rescope(svgHtml: string, scopeId: string, suffix: string) {
	return svgHtml.split(scopeId).join(`${scopeId}${suffix}`);
}

export function satteriD2DualThemePlugin(): HastPluginDefinition {
	return {
		name: "cactus-d2-dual-theme",
		raw(node) {
			if (typeof node.value !== "string" || !node.value.includes("data-d2-version")) return;

			let target: { start: number; end: number; css: string; wasCdata: boolean } | undefined;
			for (const match of node.value.matchAll(STYLE_BLOCK_PATTERN)) {
				const inner = match[1] ?? "";
				if (!DARK_MEDIA_PATTERN.test(inner)) continue;

				const cdataMatch = CDATA_PATTERN.exec(inner);
				const css = cdataMatch ? (cdataMatch[1] ?? "") : inner;
				const contentStart = match.index! + match[0].indexOf(inner);
				target = {
					start: contentStart,
					end: contentStart + inner.length,
					css,
					wasCdata: !!cdataMatch,
				};
				break;
			}
			if (!target) return;

			const split = splitD2ThemeCss(target.css);
			if (!split) return;

			let lightHtml = withStyleContent(
				node.value,
				target.start,
				target.end,
				target.wasCdata,
				split.light,
			);
			let darkHtml = withStyleContent(
				node.value,
				target.start,
				target.end,
				target.wasCdata,
				split.dark,
			);

			const scopeId = SCOPE_ID_PATTERN.exec(node.value)?.[0];
			if (scopeId) {
				lightHtml = rescope(lightHtml, scopeId, "-light");
				darkHtml = rescope(darkHtml, scopeId, "-dark");
			}

			return {
				type: "element",
				tagName: "div",
				properties: { className: ["d2-dual-theme"] },
				children: [
					{
						type: "element",
						tagName: "div",
						properties: { className: ["d2-light-only"] },
						children: [{ type: "raw", value: lightHtml }],
					},
					{
						type: "element",
						tagName: "div",
						properties: { className: ["d2-dark-only"] },
						children: [{ type: "raw", value: darkHtml }],
					},
				],
			};
		},
	};
}
