<script lang="ts">
  import { base } from "$app/paths";
</script>

<svelte:head><title>关于项目 | 歧路旅人Ⅱ中文存档修改器</title></svelte:head>

<div class="gtc-about">
  <h1>关于《歧路旅人Ⅱ》中文存档修改器</h1>
  <p>本项目专注于歧路旅人2／八方旅人2（Octopath Traveler II）的简体中文存档编辑，支持 Switch 与 Steam。</p>
  <p>基于 <a href="https://github.com/RyudoSynbios/game-tools-collection">RyudoSynbios / Game Tools Collection</a> 二次开发，保留原作者 MIT 版权声明。中文物品浏览、角色技能、捕获魔物和随行 NPC 功能由本项目维护。</p>
  <p>存档在浏览器本地读取和处理；保存会下载副本，不会直接覆盖原文件。实验性槽位扩容仍需自行在游戏中验证。</p>
  <p>游戏名称、图像和文本归各自权利人所有。本项目不是官方产品。</p>
  <p><a href="{base}/licenses/README.txt">第三方版权与许可证</a></p>
</div>

<style lang="postcss">
  .gtc-about {
    @apply mt-4 rounded bg-primary-900 p-4 text-white;

    & p {
      @apply mb-4 text-sm;
    }

    & p:last-of-type {
      @apply m-0;
    }
  }
</style>
