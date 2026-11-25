module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/stylesheets");
  eleventyConfig.addPassthroughCopy("src/resources");
  eleventyConfig.addPassthroughCopy("src/scripts");

  // Supabase library, pinned in package.json and served from our own site
  eleventyConfig.addPassthroughCopy({
    "node_modules/@supabase/supabase-js/dist/umd/supabase.js": "scripts/vendor/supabase.js"
  });
  // QR code maker (MIT, Kazuhiko Arase), pinned in package.json: the Add credits card's
  // pay-at-the-club QR (scripts/credits-card.js loads it only when a code is shown)
  eleventyConfig.addPassthroughCopy({
    "node_modules/qrcode-generator/qrcode.js": "scripts/vendor/qrcode.js"
  });
  // 3D viewer (Google's <model-viewer>, Apache-2.0, three.js inside), pinned in package.json:
  // a product's model on its shop card (scripts/shop.js loads it only when such a card opens).
  // The Draco unpacker the models need comes from three (installed with it) and is served
  // from here too, rather than the viewer's default fetch from Google's servers.
  eleventyConfig.addPassthroughCopy({
    "node_modules/@google/model-viewer/dist/model-viewer.min.js": "scripts/vendor/model-viewer.js",
    "node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm": "scripts/vendor/draco/draco_decoder.wasm",
    "node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js": "scripts/vendor/draco/draco_wasm_wrapper.js",
    "node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js": "scripts/vendor/draco/draco_decoder.js"
  });
  eleventyConfig.addPassthroughCopy("src/components");

  // Project board: its code lives outside src/ in tools/project-board/app/ and is published
  // at /staff/board/app/. The page itself is src/staff/board/index.html.
  eleventyConfig.addPassthroughCopy({ "tools/project-board/app": "staff/board/app" });
  eleventyConfig.addWatchTarget("tools/project-board/app/");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/sitemap.xml");
  eleventyConfig.addPassthroughCopy("src/site.webmanifest");
  eleventyConfig.addPassthroughCopy("src/sw.js");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/google07470aafc2664052.html");

  // Keep this file untouched by the template engine — it must stay
  // byte-identical at its exact original URL for Google's check
  eleventyConfig.ignores.add("src/google07470aafc2664052.html");

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};