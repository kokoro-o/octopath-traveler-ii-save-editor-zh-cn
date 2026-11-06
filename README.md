# 《歧路旅人Ⅱ》存档修改器 · 简体中文版

基于 [RyudoSynbios/game-tools-collection](https://github.com/RyudoSynbios/game-tools-collection) 的本地中文版本。保留原作者的 MIT 许可证和存档处理逻辑，针对《歧路旅人Ⅱ》添加简体中文界面与游戏内名称。

- 角色、职业、道具、装备、技能及地名采用游戏 `GameTextZH_CN` 文本，附英文对照。
- 保存会下载带 `.edited` 后缀的副本；请备份原存档，并在放回游戏目录前按原文件名重命名。
- macOS：安装 Node.js 24 后，双击 `启动八方旅人2中文版.command`；停止时双击对应停止脚本。
- 首次启动会安装依赖并构建，需要联网。后续可使用已安装依赖与本地构建启动。
- 其他系统：运行 `npm ci` 和 `npm run dev -- --host 127.0.0.1`，再访问 `/octopath-traveler-ii/save-editor/`。不需要 `.env` 或后端服务。
- GitHub Pages 静态发布与首次 Fork / Push 操作：见 [发布到 GitHub Pages](./docs/github-pages.md)。
- 页面中的存档读取与编辑在浏览器本地完成；成功/失败状态仅写本地控制台，不再发送统计请求。

详见 [中文版使用说明](./中文版使用说明.md)。原作者针对游戏 v1.1.0 设计；编辑器内读取、导出测试通过不等于已经验证游戏内载入。

名称来源与文本键记录在 `zh-CN.sources.json`。游戏文本名称的权利归各自权利人所有，原项目 MIT 许可证不改变这些文本的权属。仓库不包含本地提取的完整游戏文本、游戏包或个人测试存档；上游原有的测试样本按原项目保留。

---

以下为上游项目介绍：

![Game Tools Collection](https://repository-images.githubusercontent.com/696883921/114d8fd8-3b5e-4fc0-ae88-4c7d4754b73d)

# Game Tools Collection

Link to the website: [https://game-tools-collection.com](https://game-tools-collection.com)

| Games                                               | Platforms      | Tools                   | Regions                                       |
| --------------------------------------------------- | -------------- | ----------------------- | --------------------------------------------- |
| .hack//Infection                                    | PS2            | Save                    | EUR / USA / JAP                               |
| .hack//Mutation                                     | PS2            | Save                    | EUR / USA / JAP                               |
| .hack//Outbreak                                     | PS2            | Save                    | EUR / USA / JAP                               |
| .hack//Quarantine                                   | PS2            | Save                    | EUR / USA / JAP                               |
| 007: Agent Under Fire                               | GC / PS2       | Save                    | EUR / USA / KOR                               |
| 1080° Snowboarding                                  | N64            | Save                    | EUR / USA / JAP                               |
| 3D Dot Game Heroes                                  | PS3            | Save                    | EUR / USA / JAP                               |
| ActRaiser                                           | SNES           | Save                    | EUR / USA / JAP / FRA / GER                   |
| Advance Wars                                        | GBA            | Save                    | EUR / USA / JAP                               |
| Akumajou Dracula X: Chi no Rondo                    | PCECD          | Save                    | JAP                                           |
| Azure Dreams                                        | GBC            | Save                    | EUR / USA / JAP                               |
| Banjo-Kazooie                                       | N64            | Save                    | EUR / USA / JAP                               |
| Banjo-Tooie                                         | N64            | Save                    | EUR / USA / JAP / AUS                         |
| Blast Corps                                         | N64            | Save                    | EUR / USA / JAP                               |
| Bloodstained: Ritual of the Night                   | STEAM          | Save                    | WORLD                                         |
| Bomberman 64                                        | N64            | Save / Rom              | EUR / USA / JAP                               |
| Bouncer, The                                        | PS2            | Save                    | EUR / USA / JAP                               |
| Castlevania                                         | N64            | Save                    | EUR / USA / JAP                               |
| Castlevania: Aria of Sorrow                         | GBA            | Save                    | EUR / USA / JAP                               |
| Castlevania: Belmont's Curse                        | STEAM          | Save                    | WORLD                                         |
| Castlevania: Circle of the Moon                     | GBA            | Save / Rom              | EUR / USA / JAP                               |
| Castlevania: Dawn of Sorrow                         | DS             | Save                    | EUR / USA / JAP                               |
| Castlevania: Harmony of Dissonance                  | GBA            | Save                    | EUR / USA / JAP                               |
| Castlevania: Portrait of Ruin                       | DS             | Save                    | EUR / USA / JAP                               |
| Castlevania: Order of Ecclesia                      | DS             | Save                    | EUR / USA / JAP / KOR                         |
| Castlevania: Symphony of the Night                  | PS             | Save / Rom              | EUR / USA / JAP                               |
| Chrono Cross                                        | PS             | Save                    | USA / JAP                                     |
| Chrono Trigger                                      | SNES           | Save / Rom              | USA / JAP                                     |
| Crash Bandicoot                                     | PS             | Save                    | EUR / USA / JAP / AUS                         |
| Crisis Core -Final Fantasy VII- Reunion             | STEAM          | Save                    | WORLD                                         |
| CTR: Crash Team Racing                              | PS             | Save                    | EUR / USA / JAP                               |
| Dead or Alive 2                                     | PS2            | Save                    | EUR / USA / JAP                               |
| Devil May Cry                                       | PS2            | Save                    | EUR / USA / JAP / KOR                         |
| Diablo II: Lord of Destruction                      | WIN            | Save                    | WORLD                                         |
| Diddy Kong Racing                                   | N64            | Save                    | EUR / USA / JAP                               |
| Dissidia 012: Duodecim Final Fantasy                | PSP            | Save                    | EUR / USA / JAP                               |
| Donkey Kong 64                                      | N64            | Save                    | EUR / USA / JAP                               |
| Donkey Kong Country                                 | SNES           | Save                    | EUR / USA / JAP                               |
| Donkey Kong Country 2: Diddy's Kong Quest           | SNES           | Save                    | EUR / USA / JAP / GER                         |
| Donkey Kong Country 3: Dixie Kong's Double Trouble! | SNES           | Save                    | EUR / USA / JAP                               |
| Donkey Kong Land                                    | GB             | Save                    | EUR / USA / JAP                               |
| Dragon Ball Z: Budokai Tenkaichi 2                  | PS2            | Save                    | EUR / USA / JAP / KOR                         |
| Dragon Quest: The Journey of the Cursed King        | PS2            | Save                    | EUR / USA / JAP                               |
| F-Zero                                              | SNES           | Save                    | EUR / USA / JAP                               |
| F-Zero: Maximum Velocity                            | GBA            | Save                    | EUR / USA / JAP                               |
| F-Zero X                                            | N64            | Save                    | EUR / USA / JAP                               |
| Final Fantasy                                       | NES            | Save                    | USA / JAP                                     |
| Final Fantasy IV Pixel Remaster                     | STEAM          | Save                    | WORLD                                         |
| Final Fantasy VI                                    | SNES / GBA     | Save                    | EUR / USA / JAP                               |
| Final Fantasy VII                                   | PS / STEAM     | Save                    | EUR / USA / JAP / FRA / GER / SPA             |
| Final Fantasy VII Remake                            | STEAM          | Save                    | WORLD                                         |
| Final Fantasy VII Rebirth                           | STEAM          | Save                    | WORLD                                         |
| Final Fantasy VIII                                  | PS             | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA       |
| Final Fantasy IX                                    | PS             | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA       |
| Final Fantasy X                                     | PS2            | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA / AUS |
| Final Fantasy Tactics                               | PS             | Save                    | USA / JAP                                     |
| Final Fight One                                     | GBA            | Save                    | EUR / USA / JAP                               |
| Fire Emblem: Path of Radiance                       | GC             | Save                    | EUR / USA / JAP                               |
| Fire Emblem: The Blazing Blade                      | GBA            | Save                    | EUR / USA / JAP                               |
| Game & Watch Gallery 3                              | GBC            | Save                    | EUR / USA / JAP / AUS                         |
| Game Boy Camera                                     | GB             | Save                    | EUR / USA / JAP                               |
| Gex 64: Enter the Gecko                             | N64            | Save                    | EUR / USA                                     |
| Golden Sun                                          | GBA            | Save / Rom              | EUR / USA / JAP / FRA / GER / ITA / SPA       |
| Golden Sun: The Lost Age                            | GBA            | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA       |
| GoldenEye 007                                       | N64            | Save                    | EUR / USA / JAP                               |
| Gran Turismo                                        | PS             | Save                    | EUR / USA / JAP                               |
| Grandia                                             | PS             | Save / Rom              | EUR / USA / JAP / FRA / GER                   |
| Grandia II                                          | PS2            | Save                    | EUR / USA / JAP                               |
| Half-Minute Hero                                    | PSP            | Save                    | EUR / USA / JAP                               |
| Holy Magic Century                                  | N64            | Save                    | EUR / USA / JAP / FRA / GER                   |
| Kagero: Deception II                                | PS             | Save                    | EUR / USA / JAP                               |
| Kingdom Hearts                                      | PS2            | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA / AUS |
| Kingdom Hearts II                                   | PS2            | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA / AUS |
| Kingdom Hearts: Chain of Memories                   | GBA            | Save                    | EUR / USA / JAP                               |
| Kirby's Adventure                                   | NES            | Save                    | EUR / USA / JAP / FRA / GER / CAN             |
| Konami Krazy Racers                                 | GBA            | Save                    | EUR / USA / JAP                               |
| Kurukuru Kururin                                    | GBA            | Save                    | EUR / JAP                                     |
| Legend of Zelda, The: A Link to the Past            | SNES           | Save                    | EUR / USA / JAP / FRA / GER / CAN             |
| Legend of Zelda, The: Link's Awakening              | GB / GBC       | Save                    | EUR / USA / JAP / FRA / GER / CAN             |
| Legend of Zelda, The: Majora's Mask                 | N64 / GC       | Save                    | EUR / USA / JAP                               |
| Legend of Zelda, The: Ocarina of Time               | N64 / GC       | Save                    | EUR / USA / JAP                               |
| Legend of Zelda, The: Oracle of Ages                | GBC            | Save                    | EUR / USA / JAP / AUS                         |
| Legend of Zelda, The: Oracle of Seasons             | GBC            | Save                    | EUR / USA / JAP / AUS                         |
| Legend of Zelda, The: The Minish Cap                | GBA            | Save                    | EUR / USA / JAP                               |
| Legend of Zelda, The: The Wind Waker                | GC             | Save                    | EUR / USA / JAP / CAN / KOR                   |
| Legend of Zelda, The: Twilight Princess             | GC / WII       | Save                    | EUR / USA / JAP / AUS                         |
| Luigi's Mansion                                     | GC             | Save                    | EUR / USA / JAP                               |
| Lylat Wars                                          | N64            | Save                    | EUR / USA / JAP / AUS                         |
| Mario Kart 64                                       | N64            | Save                    | EUR / USA / JAP                               |
| Mario Party                                         | N64            | Save                    | EUR / USA / JAP                               |
| Mario Party 2                                       | N64            | Save                    | EUR / USA / JAP                               |
| Marvel vs. Capcom 2: New Age of Heroes              | DC             | Save                    | EUR / USA / JAP                               |
| Micro Machines 64 Turbo                             | N64            | Save                    | EUR / USA                                     |
| Mission: Impossible                                 | N64            | Save                    | EUR / USA / FRA / GER / ITA / SPA             |
| Muramasa: The Demon Blade                           | WII            | Save                    | EUR / USA / JAP                               |
| Mystic Quest Legend                                 | SNES           | Save / Rom              | EUR / USA / JAP / FRA / GER                   |
| Mystical Ninja Starring Goemon                      | N64            | Save                    | EUR / USA / JAP                               |
| Mystical Ninja 2 Starring Goemon                    | N64            | Save                    | EUR / USA / JAP                               |
| Octopath Traveler                                   | SWITCH / STEAM | Save                    | WORLD                                         |
| Octopath Traveler II                                | SWITCH / STEAM | Save                    | WORLD                                         |
| Paper Mario                                         | N64            | Save                    | EUR / USA / JAP                               |
| Paper Mario: The Thousand-Year Door                 | GC             | Save                    | EUR / USA / JAP                               |
| Pokémon Red, Blue and Yellow                        | GB             | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA       |
| Pokémon Gold, Silver and Crystal                    | GBC            | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA / AUS |
| Pokémon Snap                                        | N64            | Save                    | EUR / USA / JAP / FRA / GER / ITA / SPA / AUS |
| Pokémon Trading Card Game                           | GBC            | Save                    | EUR / USA / JAP / AUS                         |
| Rayman                                              | PS             | Save                    | EUR / USA / JAP                               |
| Rayman 2: The Great Escape                          | N64            | Save                    | EUR / USA                                     |
| Resident Evil Zero                                  | GC             | Save                    | EUR / USA / JAP                               |
| Resident Evil                                       | PS / WIN       | Save                    | EUR / USA / JAP / FRA / GER                   |
| Rogue Legacy                                        | STEAM          | Save                    | WORLD                                         |
| Secret of Mana                                      | SNES           | Save                    | USA / JAP / FRA / GER / UK / AUS              |
| Shin Megami Tensei: Lucifer's Call                  | PS2            | Save                    | EUR / USA / JAP / KOR                         |
| Shining Force                                       | MD             | Save                    | EUR / USA / JAP                               |
| Shining Force 3                                     | SATURN         | Save / Rom              | EUR / USA / JAP                               |
| Shining the Holy Ark                                | SATURN         | Save / Rom              | EUR / USA / JAP                               |
| Silent Hill                                         | PS             | Save                    | EUR / USA / JAP                               |
| Skies of Arcadia Legends                            | GC             | Save / Rom / Randomizer | EUR / USA / JAP                               |
| Solatorobo: Red the Hunter                          | DS             | Save                    | EUR / USA / JAP                               |
| Soleil                                              | MD             | Save / Rom              | EUR / USA / JAP / FRA / GER / SPA / KOR       |
| Sonic 3                                             | MD             | Save                    | EUR / USA / JAP                               |
| Sonic Advance                                       | GBA            | Save                    | EUR / USA / JAP                               |
| Sonic Advance 2                                     | GBA            | Save                    | EUR / USA / JAP                               |
| Sonic Advance 3                                     | GBA            | Save                    | EUR / USA / JAP                               |
| Sonic Adventure 2: Battle                           | GC             | Save                    | EUR / USA / JAP                               |
| Sonic Rush                                          | DS             | Save                    | EUR / USA / JAP                               |
| SoulCalibur II                                      | GC / PS2       | Save                    | EUR / USA / JAP / KOR                         |
| Super Mario 64                                      | N64            | Save                    | EUR / USA / JAP                               |
| Super Mario Galaxy                                  | WII            | Save                    | EUR / USA / JAP / AUS / KOR                   |
| Super Mario Galaxy 2                                | WII            | Save                    | EUR / USA / JAP / KOR                         |
| Super Mario Kart                                    | SNES           | Save                    | EUR / USA / JAP                               |
| Super Mario RPG: Legend of the Seven Stars          | SNES           | Save                    | USA / JAP                                     |
| Super Mario Sunshine                                | GC             | Save                    | EUR / USA / JAP / CAN / KOR                   |
| Super Metroid                                       | SNES           | Save                    | EUR / USA / JAP                               |
| Super Punch Out!!                                   | SNES           | Save                    | EUR / USA / JAP                               |
| Super Smash Bros.                                   | N64            | Save                    | EUR / USA / JAP / AUS                         |
| Super Smash Bros. Melee                             | GC             | Save                    | EUR / USA / JAP                               |
| Super Smash Bros. Brawl                             | WII            | Save                    | EUR / USA / JAP / AUS / CAN / KOR             |
| Super Street Fighter II Turbo Revival               | GBA            | Save                    | EUR / USA / JAP                               |
| Tekken                                              | PS             | Save                    | EUR / USA / JAP                               |
| Tekken 2                                            | PS             | Save                    | EUR / USA / JAP                               |
| Tekken 3                                            | PS             | Save                    | EUR / USA / JAP / AUS                         |
| Theatrhythm Final Fantasy: Curtain Call             | 3DS            | Save                    | EUR / USA / JAP                               |
| TimeSplitters 2                                     | GC / PS2       | Save                    | EUR / USA / JAP / KOR                         |
| Tomb Raider II: Starring Lara Croft                 | PS             | Save                    | EUR / USA / JAP / FRA / GER / ITA             |
| Tony Hawk's Skateboarding                           | PS             | Save                    | EUR / USA / JAP                               |
| Wario Land: Super Mario Land 3                      | GB             | Save                    | WORLD                                         |
| Wario Land II                                       | GB / GBC       | Save                    | EUR / USA / JAP                               |
| Wario Land 3                                        | GBC            | Save                    | WORLD                                         |
| Wario Land 4                                        | GBA            | Save                    | EUR / USA / JAP                               |
| WarioWare, Inc.: Minigame Mania                     | GBA            | Save                    | EUR / USA / JAP                               |
| Yoshi's Story                                       | N64            | Save                    | EUR / USA / JAP                               |

---

## How can i run this project?

You first need [node v18.20.4 (LTS)](https://nodejs.org/en/download/prebuilt-installer/current).

Once installed clone this project, run a terminal, `cd` to the root of the project and do:

```
npm install
npm run dev
```

You should see a `Local` url, open it on your browser.

---

## Wiki

You can view the documentation of this project here: [https://github.com/RyudoSynbios/game-tools-collection/wiki](https://github.com/RyudoSynbios/game-tools-collection/wiki)
