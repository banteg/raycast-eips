import { Action, ActionPanel, Color, Detail, Icon, List, getPreferenceValues } from "@raycast/api";
import { useLocalStorage } from "@raycast/utils";
import "@total-typescript/ts-reset";
import fs from "node:fs";
import Fuse from "fuse.js";
import { globSync } from "glob";
import matter from "gray-matter";
import { useMemo, useState } from "react";

interface Preferences {
  repos_path: string;
}

type EipStatus = "Idea" | "Draft" | "Review" | "Last Call" | "Final" | "Stagnant" | "Withdrawn" | "Living" | "Moved";
type EipType = "Standards Track" | "Meta" | "Informational";
type EipCategory = "Core" | "Interface" | "Networking" | "ERC";
type EipKind = "EIP" | "ERC";

interface Metadata {
  eip: number;
  title: string;
  author: string;
  status: EipStatus;
  type: EipType;
  category: EipCategory;
  created: Date;
  "discussions-to": string;
}

interface EipFile {
  data: Metadata;
  content: string;
  github: string;
  kind: EipKind;
}

const type_colors: Record<EipType, Color> = {
  "Standards Track": Color.Blue,
  Meta: Color.Green,
  Informational: Color.Magenta,
};

const category_colors: Record<EipCategory, Color> = {
  Core: Color.Blue,
  Interface: Color.Magenta,
  Networking: Color.Green,
  ERC: Color.Purple,
};

const status_colors: Record<EipStatus, Color> = {
  Idea: Color.PrimaryText,
  Draft: Color.Yellow,
  Review: Color.Purple,
  "Last Call": Color.Orange,
  Final: Color.Blue,
  Stagnant: Color.Magenta,
  Withdrawn: Color.Red,
  Living: Color.Green,
  Moved: Color.SecondaryText,
};

const fuse_options = {
  keys: ["data.eip", "data.title", "data.type", "data.category", "data.status", "data.author", "content"],
};

function path_to_github(path: string, base: string) {
  const parts = path.replace(base, "").split("/");
  const repo = parts[1];
  const tail = parts.slice(2).join("/");
  return `https://github.com/ethereum/${repo}/blob/master/${tail}`;
}

export function EipMetadata({ meta }: { meta: Metadata }) {
  return (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.Label title="eip" text={meta.eip.toString()} />
      <List.Item.Detail.Metadata.Label title="title" text={meta.title} />
      <List.Item.Detail.Metadata.Label title="author" text={meta.author} />
      <List.Item.Detail.Metadata.Label title="created" text={meta.created.toISOString()} />
      <List.Item.Detail.Metadata.TagList title="type / category / status">
        <List.Item.Detail.Metadata.TagList.Item text={meta.type} color={type_colors[meta.type]} />
        <List.Item.Detail.Metadata.TagList.Item text={meta.category} color={category_colors[meta.category]} />
        <List.Item.Detail.Metadata.TagList.Item text={meta.status} color={status_colors[meta.status]} />
      </List.Item.Detail.Metadata.TagList>
    </List.Item.Detail.Metadata>
  );
}

export function EipDetail({ item }: { item: EipFile }) {
  const meta = [
    `# ${item.kind}-${item.data.eip}: ${item.data.title}`,
    `${item.data.type} / ${item.data.category} / ${item.data.status}`,
    `Authors: ${item.data.author}`,
    `Created: ${item.data.created.toISOString().split("T")[0]}`,
  ].join("\n\n");

  return (
    <Detail
      markdown={[meta, item.content].join("\n\n")}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser url={item.github} title="GitHub" />
          <Action.OpenInBrowser url={item.data["discussions-to"]} title="Ethereum Magicians" />
        </ActionPanel>
      }
    />
  );
}

export function ActionFavorites({
  favorites,
  set_favorites,
  eip,
}: {
  favorites: number[];
  set_favorites: (value: number[]) => void;
  eip: number;
}) {
  const is_fav = favorites.includes(eip);
  return (
    <Action
      title={is_fav ? "Remove from Favorites" : "Add to Favorites"}
      onAction={() => {
        is_fav ? set_favorites(favorites.filter((item) => item !== eip)) : set_favorites([...favorites, eip]);
      }}
      shortcut={{ modifiers: ["cmd"], key: "f" }}
    />
  );
}

function EipListItem({
  item,
  favorites,
  set_favorites,
}: {
  item: EipFile;
  favorites: number[];
  set_favorites: (value: number[]) => void;
}) {
  const accessories = [
    item.data.type && { text: { value: item.data.type.replace("s Track", ""), color: type_colors[item.data.type] } },
    item.data.category && { text: { value: item.data.category, color: category_colors[item.data.category] } },
    item.data.status && { text: { value: item.data.status, color: status_colors[item.data.status] } },
    { date: item.data.created },
    favorites.includes(item.data.eip) && { icon: Icon.Star },
  ].filter(Boolean);
  const eip = `${item.kind}-${item.data.eip}`;

  return (
    <List.Item
      key={eip}
      title={item.data.title ?? "??"}
      subtitle={eip}
      accessories={accessories}
      detail={<List.Item.Detail metadata={<EipMetadata meta={item.data} />} />}
      actions={
        <ActionPanel title={`${eip}: ${item.data.title}`}>
          <Action.Push title="Instant View" icon={Icon.Book} target={<EipDetail item={item} />} />
          <Action.OpenInBrowser url={item.github} title="GitHub" />
          <Action.OpenInBrowser
            url={item.data["discussions-to"]}
            title="Ethereum Magicians"
            shortcut={{ modifiers: ["cmd"], key: "d" }}
          />
          <Action
            title={favorites.includes(item.data.eip) ? "Remove from Favorites" : "Add to Favorites"}
            icon={Icon.Star}
            onAction={() => {
              favorites.includes(item.data.eip)
                ? set_favorites(favorites.filter((fav) => fav !== item.data.eip))
                : set_favorites([...favorites, item.data.eip]);
            }}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const preferences = getPreferenceValues<Preferences>();
  const { value: favorites, setValue: set_favorites } = useLocalStorage<number[]>("favorite_eips", []);
  const base = preferences.repos_path;

  const eips = useMemo(() => {
    const files = globSync([`${base}/EIPs/EIPS/eip-*.md`, `${base}/ERCs/ERCS/erc-*.md`]);
    const matters = files.map((path) => {
      const md = matter(fs.readFileSync(path));
      return {
        data: md.data as Metadata,
        content: md.content,
        kind: (path.toLowerCase().includes("/eip-") ? "EIP" : "ERC") as EipKind,
        github: path_to_github(path, base),
      };
    });
    return matters.filter((item) => item.data.status !== "Moved");
  }, []);

  const fuse = new Fuse(eips, fuse_options);
  const data: EipFile[] = searchText ? fuse.search(searchText).map((item) => item.item) : eips;

  if (searchText)
    return (
      <List onSearchTextChange={setSearchText} throttle>
        {data.map((item) => (
          <EipListItem key={item.data.eip} item={item} favorites={favorites ?? []} set_favorites={set_favorites} />
        ))}
      </List>
    );

  // show favorites first when not searching
  return (
    <List onSearchTextChange={setSearchText} throttle>
      {[true, false].map((fav) => (
        <List.Section key={`fav-${fav}`} title={fav ? "Favorites" : "Other"}>
          {data
            .filter((item) => favorites?.includes(item.data.eip) === fav)
            .map((item) => (
              <EipListItem key={item.data.eip} item={item} favorites={favorites ?? []} set_favorites={set_favorites} />
            ))}
        </List.Section>
      ))}
    </List>
  );
}
