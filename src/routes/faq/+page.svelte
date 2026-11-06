<script lang="ts">
  import Spoiler from "$lib/components/Spoiler.svelte";
</script>

<svelte:head><title>常见问题 | 歧路旅人Ⅱ中文存档修改器</title></svelte:head>

<div class="gtc-faq">
  <h1>常见问题</h1>
  <Spoiler title="存档会上传到服务器吗？"><p>不会。存档在浏览器本地读取、编辑和导出；成功与失败状态只写本地控制台。</p></Spoiler>
  <Spoiler title="支持哪些存档？"><p>支持原编辑器兼容的 Switch 与 Steam 歧路旅人Ⅱ存档。请先备份；其他版本或不受支持的格式可能无法读取。</p></Spoiler>
  <Spoiler title="保存后怎么放回游戏？"><p>“保存副本”会下载带 .edited 后缀的新文件。退出游戏后，将副本改回游戏要求的原文件名，再放回存档目录；请保留原档备份。</p></Spoiler>
  <Spoiler title="习得技能扩容和 NPC 数据是否已经游戏内验证？"><p>编辑器内读写验证不等于游戏支持所有数据组合。实验性扩容、剧情 NPC 与特殊机制仍以实际游戏测试为准。</p></Spoiler>
</div>

<style lang="postcss">
  .gtc-faq {
    @apply mt-4 rounded bg-primary-900 p-4 text-white;

    & :global(.gtc-spoiler):last-of-type {
      @apply m-0;
    }
  }
</style>
