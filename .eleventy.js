module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/stylesheets");
  eleventyConfig.addPassthroughCopy("src/resources");
  eleventyConfig.addPassthroughCopy("src/scripts");

  // Supabase library, pinned in package.json and served from our own site
  eleventyConfig.addPassthroughCopy({
    "node_modules/@supabase/supabase-js/dist/umd/supabase.js": "scripts/vendor/supabase.js"
  });
  eleventyConfig.addPassthroughCopy("src/components");
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