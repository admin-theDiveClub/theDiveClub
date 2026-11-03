# Dive SVG

Builds `src/_includes/dive.svg`, the dive loader's drawing, from the logo file `src/resources/branding/icon-primary.svg`.

**Run it whenever the logo file changes:**

```
node tools/dive-svg/build.js
```

Then reload `/sandbox/dive/`. At rest the dive must look exactly like the logo.

## What it does

| Step | Detail |
|---|---|
| Copies | The portal, the rim's shading (`gra_m_all`), the ladder and the diver, plus the blur filter and the rim gradient. Nothing is retyped |
| Labels | Inkscape's labels become classes (`sha_`, `col_m_`, `col_l_`, `blu_`, `gra_m_all`); Inkscape's ids are dropped |
| Colours | Each fill becomes a `--dive-*` variable with the file's own colour as the fallback. The theme values are in `src/stylesheets/variables.css` |
| Fails | With an error naming the part, if a part it expects has gone or its colour has changed. Then the script needs the new name or colour, not a guess |

`scripts/dive.js` runs the drawing; see the dive entry in `docs/systems/file-map.md`. The script is not published: Eleventy only copies `src/`.
