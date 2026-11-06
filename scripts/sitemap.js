import fs from "node:fs";

// Never publish the upstream site's canonical domain from a personal fork.
fs.writeFileSync("build/.nojekyll", "");
fs.mkdirSync(".local", { recursive: true });
fs.writeFileSync(".local/last-build-base", process.env.BASE_PATH || "");
const origin = process.env.SITE_ORIGIN;
if (origin) {
  const site = new URL(origin);
  if (!/^https?:$/.test(site.protocol) || site.username || site.password || site.pathname !== "/" || site.search || site.hash) {
    throw new Error("SITE_ORIGIN must be an http(s) origin without credentials, path or query.");
  }
  const base = process.env.BASE_PATH || "";
  const games = JSON.parse(fs.readFileSync("src/lib/db/games.json", "utf8"));
  const routes = ["/", "/about/", "/faq/"];
  for (const game of games) {
    for (const tool of Object.keys(game.tools)) {
      routes.push(`/${game.id}/${tool.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}/`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${site.origin}${base}${route}</loc></url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync("build/sitemap.xml", xml);
}
