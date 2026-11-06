# 第三方版权与许可

- 基础项目：RyudoSynbios / Game Tools Collection，Copyright (c) 2024 RyudoSynbios，MIT。原文保留在 LICENSE.md，网站副本在 static/licenses/project-MIT.txt。
- 运行时依赖：Svelte、SvelteKit、file-saver、moment、throttle-debounce（MIT）；hex2dec、long（Apache-2.0）。随附其版本及许可证原文于 static/licenses/npm-notices.txt，也包含已安装的相关框架运行库 esm-env、devalue、cookie、set-cookie-parser。
- `src/lib/utils/format.ts` 的原有 ThreeJS 适配函数保留原注释；虽然移除了未使用的 three 依赖，仍保留对应 r178 的 MIT 声明：static/licenses/three-MIT.txt。
- `src/lib/utils/encoding.ts` 的 CP932 映射来源为 https://github.com/kawanet/iconv-cp932 ，Copyright 2014–2023 @kawanet Yusuke Kawasaki，MIT；许可证见 static/licenses/iconv-cp932-MIT.txt。
- `src/lib/utils/prototype.ts` 的 DataView 扩展保留上游代码中的来源链接：https://gist.github.com/tjmehta/7e0f0d2aca966c71e70a453d0786f938 。未对该来源另行宣称授权。
- Roboto 字体保持原文件和名称：Copyright 2011 Google Inc.，Apache-2.0，许可证见 static/licenses/Apache-2.0.txt。
- SourceCodePro-Light.ttf 保持原文件和名称：Copyright 2010, 2012 Adobe Systems Incorporated，Reserved Font Name “Source”，SIL Open Font License 1.1；见 static/licenses/SourceCodePro-OFL.txt。
- 构建与开发依赖按 package-lock.json 锁定版本；完整许可证位于安装后的各依赖包中。

游戏名称、图像、物品和技能文本等属于各自权利人，MIT 许可证不构成游戏素材的额外授权。本项目不包含游戏包或完整游戏数据库原始资产。

这些声明用于保留已识别来源与许可证，不代表对所有游戏素材或无明确许可证片段作出再授权判断。
