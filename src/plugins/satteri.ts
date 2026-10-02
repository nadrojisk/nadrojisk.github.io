import type { Image, Nodes, Parents } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import getReadingTime from "reading-time";
import type { HastPluginDefinition, MdastPluginDefinition } from "satteri";
import { h } from "@/utils/remark";

export function satteriAutolinkHeadingsPlugin(): HastPluginDefinition {
	return {
		name: "cactus-autolink-headings",
		element: {
			filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
			visit(node) {
				const id = node.properties?.id;
				if (typeof id !== "string" || !id) return;
				return {
					...node,
					children: [
						{
							type: "element",
							tagName: "a",
							properties: { href: `#${id}`, className: ["not-prose"] },
							children: [...node.children],
						},
					],
				};
			},
		},
	};
}

export function satteriReadingTimePlugin(): () => MdastPluginDefinition {
	return () => {
		let done = false;
		return {
			name: "cactus-reading-time",
			text(node, ctx) {
				if (done) return;

				let root: Readonly<Nodes> = node;
				let parent: Readonly<Parents> | undefined = ctx.parent(root);
				while (parent) {
					root = parent;
					parent = ctx.parent(root);
				}

				done = true;
				const textOnPage = mdastToString(root);
				const readingTime = getReadingTime(textOnPage);

				ctx.data.astro!.frontmatter.readingTime = readingTime.text;
			},
		};
	};
}

export function satteriFigurePlugin(): MdastPluginDefinition {
	return {
		name: "cactus-figure",
		paragraph(node) {
			const child = node.children[0];
			if (node.children.length !== 1 || child?.type !== "image") return;
			if (!child.alt) return child as Image;

			return h("figure", {}, [child, h("figcaption", {}, [{ type: "text", value: child.alt }])]);
		},
	};
}

export function satteriFootnoteLabelPlugin(): HastPluginDefinition {
	return {
		name: "cactus-footnote-label",
		element: {
			filter: ["h2"],
			visit(node, ctx) {
				if (node.properties?.id !== "footnote-label") return;
				ctx.setProperty(node, "className", [""]);
			},
		},
	};
}

export function satteriExternalLinksPlugin(): HastPluginDefinition {
	return {
		name: "cactus-external-links",
		element: {
			filter: ["a"],
			visit(node, ctx) {
				const href = node.properties?.href;
				if (typeof href !== "string" || !href) return;

				let url: URL;
				try {
					url = new URL(href);
				} catch {
					return; // relative path or fragment, not "external"
				}

				if (url.protocol !== "http:" && url.protocol !== "https:") return;

				ctx.setProperty(node, "rel", ["noreferrer", "noopener"]);
				ctx.setProperty(node, "target", "_blank");
			},
		},
	};
}
