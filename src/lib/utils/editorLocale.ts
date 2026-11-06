const chinese: Record<string, string> = {
  Home: "首页",
  FAQ: "常见问题",
  About: "关于",
  "Save Editor": "存档修改器",
  "Drop the file here.": "将存档放到这里。",
  Loading: "正在读取",
  "Supported platforms:": "支持平台：",
  "Compatible with:": "兼容版本：",
  Eject: "卸载存档",
  Save: "保存副本",
  "You have unsaved changes, are you sure you want to eject your file?":
    "有尚未保存的修改，确定要卸载存档吗？",
};

export function editorText(gameId: string | undefined, text: string): string {
  return gameId === "octopath-traveler-ii" ? chinese[text] || text : text;
}
