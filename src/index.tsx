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

function EipMetadata({ item }: { item: Metadata }) {
	const tags = [item.category, item.type, item.status];
	const created = item.created.toISOString();
	return (
		<List.Item.Detail.Metadata>
			<List.Item.Detail.Metadata.Link
				target={item["discussions-to"]}
				text={item["discussions-to"]}
				title="discuss"
			/>
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

	const data = useMemo(() => {
		const base = "/users/banteg/dev/ethereum";
		const search = searchText === "" ? "*" : searchText;
		console.log(search);
		return globSync([
			`${base}/EIPs/EIPS/eip-${search}.md`,
			`${base}/ERCs/ERCS/erc-${search}.md`,
		])
			.map((path) => ({
				...matter(fs.readFileSync(path)),
				kind: path.toLowerCase().includes("/eip-") ? "eip" : "erc",
				github: path_to_github(path, base),
			}))
			.filter((item) => item.data.status !== "Moved")
			.sort((item) => item.data.eip);
	}, [searchText]);

	console.log(data.map((item) => item.data.eip));

	return (
		<List onSearchTextChange={setSearchText} throttle isShowingDetail>
			{["eip", "erc"].map((kind) => (
				<List.Section title={kind} key={kind}>
					{data
						.filter((item) => item.kind === kind)
						.map((item) => (
							<List.Item
								key={`${item.kind}-${item.data.eip}`}
								title={item.data.title ?? "??"}
								subtitle={`${item.kind}-${item.data.eip}`}
								detail={
									<List.Item.Detail
										markdown={`${JSON.stringify(item.data)} ${item.content}`}
										metadata={<EipMetadata item={item.data} />}
									/>
								}
								actions={
									<ActionPanel title="action panel title">
										<Action.OpenInBrowser url={item.github} title="GitHub" />
										<Action.OpenInBrowser
											url={item.data["discussions-to"]}
											title="Ethereum Magicians"
										/>
									</ActionPanel>
								}
							/>
						))}
				</List.Section>
			))}
		</List>
	);
}
