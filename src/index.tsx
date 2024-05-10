import { Action, ActionPanel, Color, Detail, Icon, List, Toast, getPreferenceValues, showToast } from "@raycast/api";
import { useLocalStorage } from "@raycast/utils";
import "@total-typescript/ts-reset";
import { execSync } from "node:child_process";
import fs from "node:fs";
import Fuse from "fuse.js";
import { globSync } from "glob";
import matter from "gray-matter";
import { useEffect, useMemo, useState } from "react";

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
  eip: string;
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

function load_eips_from_disk() {
  const base = getPreferenceValues<Preferences>().repos_path;
  console.log("loading from", base);
  const files = globSync([`${base}/EIPs/EIPS/eip-*.md`, `${base}/ERCs/ERCS/erc-*.md`]);
  const matters = files.map((path) => {
    const md = matter(fs.readFileSync(path));
    return {
      data: md.data as Metadata,
      content: md.content,
      github: path_to_github(path, base),
      eip: path.toLowerCase().includes("/eip-") ? `EIP-${md.data.eip}` : `ERC-${md.data.eip}`,
    };
  });
  return matters.filter((item) => item.data.status !== "Moved");
}

async function update_repos() {
  const base = getPreferenceValues<Preferences>().repos_path;
  for (const repo of ["EIPs", "ERCs"]) {
    const path = `${base}/${repo}`;
    if (fs.existsSync(path)) {
      const toast = await showToast({ title: "Updating", message: repo, style: Toast.Style.Animated });
      try {
        execSync("git pull", { cwd: path, encoding: "utf-8" });
        toast.style = Toast.Style.Success;
        toast.message = undefined;
        toast.title = "Updated";
      } catch (err) {
        toast.title = "Failed to update";
        toast.style = Toast.Style.Failure;
      }
    } else {
      const toast = await showToast({ title: "Cloning", message: repo, style: Toast.Style.Animated });
      console.log(`git clone ethereum/${repo}`);
      try {
        execSync(`git clone https://github.com/ethereum/${repo}.git`, { cwd: base, encoding: "utf-8" });
        toast.title = "Cloned";
        toast.style = Toast.Style.Success;
        toast.message = base;
      } catch (err) {
        toast.title = "Failed to clone";
        toast.style = Toast.Style.Failure;
      }
    }
  }
}

export function EipDetail({
  item,
  favorites,
  set_favorites,
}: {
  item: EipFile;
  favorites: number[];
  set_favorites: (value: number[]) => void;
}) {
  const meta = [
    `# ${item.eip}: ${item.data.title}`,
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
          <ActionFavorite item={item} favorites={favorites} set_favorites={set_favorites} />
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

function ActionFavorite({
  item,
  favorites,
  set_favorites,
}: {
  item: EipFile;
  favorites: number[];
  set_favorites: (value: number[]) => void;
}) {
  return (
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

  return (
    <List.Item
      key={item.eip}
      title={item.data.title}
      subtitle={item.eip}
      accessories={accessories}
      actions={
        <ActionPanel title={`${item.eip}: ${item.data.title}`}>
          <Action.Push
            title="Instant View"
            icon={Icon.Book}
            target={<EipDetail item={item} favorites={favorites} set_favorites={set_favorites} />}
          />
          <Action.OpenInBrowser url={item.github} title="GitHub" />
          <Action.OpenInBrowser
            url={item.data["discussions-to"]}
            title="Ethereum Magicians"
            shortcut={{ modifiers: ["cmd"], key: "d" }}
          />
          <ActionFavorite item={item} favorites={favorites} set_favorites={set_favorites} />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const preferences = getPreferenceValues<Preferences>();
  const { value: favorites, setValue: set_favorites } = useLocalStorage<number[]>("favorite_eips", []);
  const {
    value: last_update,
    setValue: set_last_update,
    isLoading: last_update_loading,
  } = useLocalStorage<number>("last_update", 0);

  const eips = useMemo(() => load_eips_from_disk(), []);
  const fuse = new Fuse(eips, fuse_options);
  const data: EipFile[] = searchText ? fuse.search(searchText).map((res) => res.item) : eips;

  useEffect(() => {
    if (last_update_loading) return;
    const now = new Date().valueOf();
    const one_day_ms = 86_400_000;
    if (now - (last_update ?? 0) > one_day_ms) {
      update_repos();
      set_last_update(now);
    }
  }, [last_update]);

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
            .slice()
            .sort((a, b) => a.data.eip - b.data.eip)
            .map((item) => (
              <EipListItem key={item.data.eip} item={item} favorites={favorites ?? []} set_favorites={set_favorites} />
            ))}
        </List.Section>
      ))}
    </List>
  );
}
