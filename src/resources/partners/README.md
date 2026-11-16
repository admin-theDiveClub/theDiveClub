# Partner and sponsor icons

The icons in the banner above the footer (`src/_includes/footer.html`, styles in
`footer.css`). Each one is drawn as a cut-out: the banner is grey and the icon's
shape is punched through it in the page's background colour. Only the icon's
**shape** is used, never its colours.

## Adding one

1. Save the icon here: an **SVG** (best) or a **PNG with a transparent
   background**. Whatever is solid in the file becomes the hole; whatever is
   transparent stays grey. A negative-space icon is drawn this way already.
2. Add an entry to `src/_data/partners.json`:

```json
[
	{ "name": "Example Brewing", "file": "example-brewing.svg", "href": "https://example.com" }
]
```

| Field | Meaning |
|---|---|
| `name` | Read out to screen readers and shown on hover |
| `file` | The file's name in this folder |
| `href` | Optional. Where tapping the icon goes; leave it out for no link |

The banner shows only when the list has at least one entry.
