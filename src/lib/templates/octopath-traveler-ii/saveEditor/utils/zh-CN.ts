import type { GameJson } from "$lib/types";

import gameText from "./zh-CN.game.json";

// Editor concepts do not always share the meaning of identically named NPCs
// or skills (for example, "General" is also an NPC rank in the game).
const interfaceText: Record<string, string> = {
  General: "基本设置",
  Formation: "队伍编成",
  Party: "角色",
  Inventory: "背包",
  "Main Character": "主角",
  Playtime: "游戏时间",
  Leaves: "叶币",
  "Unlocked Menus": "已解锁菜单",
  Main: "出战成员",
  Reserve: "后备成员",
  Jobs: "职业",
  Skills: "技能",
  "Visited Places": "已到访地点",
  Status: "状态",
  "Character ID": "角色编号",
  Level: "等级",
  Experience: "经验值",
  "Latent Power": "潜力",
  "Primary Job": "基础职业",
  "Secondary Job": "战斗职业",
  "Job Points": "JP",
  Bonus: "坚果等带来的能力加成",
  "Physical Attack": "物理攻击力",
  "Physical Defense": "物理防御力",
  "Elemental Attack": "属性攻击力",
  "Elemental Defense": "属性防御力",
  Accuracy: "命中",
  Speed: "行动速度",
  Critical: "暴击",
  Evasion: "回避",
  Equipment: "装备",
  Sword: "剑",
  Polearm: "长枪",
  Dagger: "短剑",
  Axe: "斧头",
  Bow: "弓",
  Staff: "杖",
  Shield: "护盾",
  Head: "头部",
  Body: "身体",
  Accessory: "饰品",
  "EX Skills": "EX技能",
  "Job Skills": "职业技能",
  "Support Skills": "辅助技能",
  Items: "道具",
  Swords: "剑",
  Polearms: "长枪",
  Daggers: "短剑",
  Axes: "斧头",
  Bows: "弓",
  Staves: "杖",
  Shields: "护盾",
  Headgear: "防具 头部",
  "Body Armor": "防具 身体",
  Accessories: "饰品",
  Materials: "调合素材",
  Valuables: "贵重物品",
  Knowledge: "情报",
  "Drag 'n' drop here or click to add a save file.":
    "将存档拖到这里，或点击选择存档。",
  "Designed to work with v1.1.0.\nOther versions may work, but may corrupt the save.\nPlease make a backup before editing.":
    "原作者针对游戏 v1.1.0 设计。\n其他版本可能兼容，也可能导致存档损坏。\n编辑前请备份；保存后会下载新文件。",
  "Not a valid save file.":
    "无法识别此存档，请确认选择了支持的 Switch 或 Steam 存档。",
};

const officialText: Record<string, string> = gameText;

export function translateName(english: string): string {
  if (interfaceText[english]) return interfaceText[english];

  const slot = /^(Character|Skill) (\d+)$/.exec(english);
  if (slot) return `${slot[1] === "Character" ? "角色" : "技能"} ${slot[2]}`;

  const place = /^<b>(.*?):<\/b> (.*)$/.exec(english);
  if (place) {
    return `<b>${officialText[place[1]] || place[1]}：</b> ${translateName(place[2])}`;
  }

  return translateGameName(english);
}

function translateGameName(english: string): string {
  const chinese = officialText[english];
  if (!chinese || chinese === english) return english;
  return `${chinese}（${english}）`;
}

/** Translate presentation fields only; IDs, JSON paths and offsets stay intact. */
export function localizeTemplate(template: GameJson): GameJson {
  function resources(node: unknown): unknown {
    if (typeof node === "string") return translateGameName(node);
    if (Array.isArray(node)) return node.map(resources);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [key, resources(value)]),
      );
    }
    return node;
  }

  function walk(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => {
        if (["resources", "resourcesLabels", "resourcesGroups"].includes(key)) {
          return [key, resources(value)];
        }
        if (
          ["name", "label", "hint", "text", "error"].includes(key) &&
          typeof value === "string"
        ) {
          const inventoryItem =
            "id" in node &&
            typeof node.id === "string" &&
            node.id.startsWith("inventory-");
          return [
            key,
            inventoryItem ? translateGameName(value) : translateName(value),
          ];
        }
        return [key, walk(value)];
      }),
    );
  }

  return walk(template) as GameJson;
}
