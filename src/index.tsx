import fs from "node:fs";
import { URLSearchParams } from "node:url";
import { Action, ActionPanel, Detail, List } from "@raycast/api";
import { type Response, useFetch } from "@raycast/utils";
import { globSync } from "glob";
import matter from "gray-matter";
import { useEffect, useMemo, useState } from "react";

interface Metadata {
	eip: number;
	author: string;
	status: string;
	type: string;
	category: string;
	created: Date;
	"discussions-to": string;
}

const type_colors = {
	"Standards Track": "#007bff", // blue
	Meta: "#ffc107", // orange
	Informational: "#28a745", // green
};

const category_colors = {
	Core: "#8B0A1A", // deep red
	Interface: "#4CAF50", // teal
	Networking: "#2196F3", // blue-grey
	ERC: "#FFC107", // vibrant orange
};

const status_colors = {
	Idea: "#CCCCCC", // light grey
	Draft: "#87CEEB", // sky blue
	Review: "#F7DC6F", // yellow-orange
	"Last Call": "#FFC107", // vibrant orange
	Final: "#2ECC40", // bright green
	Stagnant: "#AAAAAA", // dark grey
	Withdrawn: "#FF69B4", // pink
	Living: "#8BC34A", // lime green
};

export function EipMetadata({ item }: { item: Metadata }) {
	const tags = [item.category, item.type, item.status];
	const created = item.created.toISOString();
	return (
		<List.Item.Detail.Metadata>
			<List.Item.Detail.Metadata.Label title="title" text={item.title} />
			<List.Item.Detail.Metadata.TagList title="type / category / status">
				<List.Item.Detail.Metadata.TagList.Item
					text={item.type}
					color={type_colors[item.type]}
				/>
				<List.Item.Detail.Metadata.TagList.Item
					text={item.category}
					color={category_colors[item.category]}
				/>
				<List.Item.Detail.Metadata.TagList.Item
					text={item.status}
					color={status_colors[item.status]}
				/>
			</List.Item.Detail.Metadata.TagList>
		</List.Item.Detail.Metadata>
	);
}

function path_to_github(path: string, base: string) {
	const parts = path.replace(base, "").split("/");
	const repo = parts[1];
	const tail = parts.slice(2).join("/");
	return `https://github.com/ethereum/${repo}/blob/master/${tail}`;
}

export default function Command() {
	const [searchText, setSearchText] = useState("");

	const all_eips = useMemo(() => {
		// if (searchText === "") return [];
		const base = "/users/banteg/dev/ethereum";
		const search = searchText === "" ? "*" : searchText;
		console.log(search);
		const result = globSync([
			`${base}/EIPs/EIPS/eip-${search}.md`,
			`${base}/ERCs/ERCS/erc-${search}.md`,
		])
			.map((path) => ({
				...matter(fs.readFileSync(path)),
				kind: path.toLowerCase().includes("/eip-") ? "EIP" : "ERC",
				github: path_to_github(path, base),
			}))
			.filter((item) => item.data.status !== "Moved");
		result.sort((a, b) => a.data.eip - b.data.eip);
		return result;
	}, []);

	const data = searchText
		? all_eips.filter((item) => item.data.eip === Number(searchText))
		: all_eips;

	console.log(new Set(data.map((item) => item.data.status)));

	return (
		<List onSearchTextChange={setSearchText} isShowingDetail throttle>
			{data.map((item) => (
				<List.Item
					key={`${item.kind}-${item.data.eip}`}
					title={item.data.title ?? "??"}
					subtitle={`${item.kind}-${item.data.eip}`}
					detail={
						<List.Item.Detail
							// markdown={`${JSON.stringify(item.data)} ${item.content}`}
							metadata={<EipMetadata item={item.data} />}
						/>
					}
					actions={
						<ActionPanel
							title={`${item.kind}-${item.data.eip} ${item.data.title}`}
						>
							<Action.OpenInBrowser url={item.github} title="GitHub" />
							<Action.OpenInBrowser
								url={item.data["discussions-to"]}
								title="Ethereum Magicians"
							/>
						</ActionPanel>
					}
				/>
			))}
		</List>
	);
}
