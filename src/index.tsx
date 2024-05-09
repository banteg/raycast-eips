import fs from "node:fs";
import {
	Action,
	ActionPanel,
	Detail,
	List,
	getPreferenceValues,
} from "@raycast/api";
import Fuse from "fuse.js";
import { globSync } from "glob";
import matter from "gray-matter";
import { useMemo, useState } from "react";

interface Preferences {
	repos_path: string;
}

interface Metadata {
	eip: number;
	title: string;
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

const fuse_options = {
	keys: ["data.eip", "data.title", "data.author", "content"],
};

function path_to_github(path: string, base: string) {
	const parts = path.replace(base, "").split("/");
	const repo = parts[1];
	const tail = parts.slice(2).join("/");
	return `https://github.com/ethereum/${repo}/blob/master/${tail}`;
}

export function EipMetadata({ item }: { item: Metadata }) {
	const tags = [item.category, item.type, item.status];
	const created = item.created.toISOString();
	return (
		<List.Item.Detail.Metadata>
			<List.Item.Detail.Metadata.Label title="eip" text={item.eip.toString()} />
			<List.Item.Detail.Metadata.Label title="title" text={item.title} />
			<List.Item.Detail.Metadata.Label title="author" text={item.author} />
			<List.Item.Detail.Metadata.Label
				title="created"
				text={item.created.toISOString()}
			/>
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

export function EipDetail({ item }) {
	return (
		<Detail
			markdown={item.content}
			actions={
				<ActionPanel>
					<Action.OpenInBrowser url={item.github} title="GitHub" />
					<Action.OpenInBrowser
						url={item.data["discussions-to"]}
						title="Ethereum Magicians"
					/>
				</ActionPanel>
			}
		/>
	);
}

export default function Command() {
	const [searchText, setSearchText] = useState("");
	const preferences = getPreferenceValues<Preferences>();
	const base = preferences.repos_path;

	const eips = useMemo(() => {
		const result = globSync([
			`${base}/EIPs/EIPS/eip-*.md`,
			`${base}/ERCs/ERCS/erc-*.md`,
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

	const fuse = new Fuse(eips, fuse_options);
	const data = searchText
		? fuse.search(searchText).map((item) => item.item)
		: eips;

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
							<Action.Push
								title="Instant View"
								target={<EipDetail item={item} />}
							/>
							<Action.OpenInBrowser url={item.github} title="GitHub" />
							<Action.OpenInBrowser
								url={item.data["discussions-to"]}
								title="Ethereum Magicians"
								shortcut={{ modifiers: ["cmd"], key: "d" }}
							/>
						</ActionPanel>
					}
				/>
			))}
		</List>
	);
}
