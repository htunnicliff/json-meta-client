// Generates the README banners in docs/public. The title is drawn as paths
// from Rec Mono Duotone, so the SVGs need no font to render the same everywhere.

import { writeFile } from "node:fs/promises";

import { parse } from "opentype.js/dist/opentype.mjs";

const fontUrl =
  "https://raw.githubusercontent.com/arrowtype/recursive/v1.085/fonts/ArrowType-Recursive-1.085/Recursive_Code/RecMonoDuotone/RecMonoDuotone-Bold-1.085.ttf";

const title = "json-meta-client";
const description = "A TypeScript client for JMAP";

const width = 960;
const height = 224;
const logoSize = 128;
const gap = 40;
const fontSize = 58;

const themes = {
  "readme-banner.svg": { background: "#faf7f0", title: "#192d50", border: "#e2d9c2" },
  "readme-banner-dark.svg": { background: "#161618", title: "#f0e9d8", border: "#3a3833" },
};

const response = await fetch(fontUrl);
if (!response.ok) {
  throw new Error(`Could not download ${fontUrl}: ${response.status}`);
}
const font = parse(await response.arrayBuffer());

// Measure the ink of the title, then center it and the logo as one group.
const measured = font.getPath(title, 0, 0, fontSize).getBoundingBox();
const titleWidth = measured.x2 - measured.x1;
const logoX = Math.round((width - (logoSize + gap + titleWidth)) / 2);
const logoY = (height - logoSize) / 2;
const titleX = logoX + logoSize + gap - measured.x1;
const titleY = height / 2 - (measured.y1 + measured.y2) / 2;
const titlePath = font.getPath(title, titleX, titleY, fontSize).toPathData(2);

await Promise.all(
  Object.entries(themes).map(([file, colors]) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${title}</title>
  <desc>${description}</desc>
  <defs>
    <clipPath id="a">
      <rect width="${width}" height="${height}" rx="16"/>
    </clipPath>
  </defs>
  <g clip-path="url(#a)">
    <path fill="${colors.background}" d="M0 0h${width}v${height}H0z"/>
    <g transform="translate(${logoX} ${logoY})">
      <rect width="${logoSize}" height="${logoSize}" fill="#b22234" rx="25"/>
      <path fill="#faf7f0" d="M45 27H22v74h23v-9H31V36h14Zm38 0h23v74H83v-9h14V36H83ZM50 48h32v9H50zm0 23h24v9H50z"/>
    </g>
    <path fill="${colors.title}" d="${titlePath}"/>
  </g>
  <rect width="${width - 1}" height="${height - 1}" x=".5" y=".5" fill="none" stroke="${colors.border}" rx="15.5"/>
</svg>
`;
    return writeFile(new URL(`../docs/public/${file}`, import.meta.url), svg);
  }),
);
