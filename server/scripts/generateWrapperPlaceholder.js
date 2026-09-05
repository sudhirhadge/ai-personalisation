/**
 * Generates placeholder wrapper-template mockup PNGs for new product SKUs,
 * matching the visual style of the existing hand-made placeholders in
 * assets/wrappers/ (rounded gradient background, title/subtitle, dashed
 * "LABEL AREA" box, footer line).
 *
 * Run with: npm run generate:wrapper-placeholders
 *
 * Prints the WRAPPER_OVERLAY_REGIONS entry for each generated spec so the
 * coordinates only need to be copy-pasted once into imageCompositeService.js
 * instead of being re-measured by opening the image in an editor (see
 * assets/wrappers/dimenions.js.txt, leftover notes from when that was done
 * by hand and drifted from the actual registry once already).
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(process.cwd(), 'assets', 'wrappers');

/**
 * 12 evenly-spaced clock tick marks as SVG <line> elements — computed
 * rather than hand-typed, since 12 trig coordinates invite the same
 * transcription drift this script exists to avoid elsewhere.
 */
function clockTicks(cx, cy, r) {
    let ticks = '';
    for (let i = 0; i < 12; i++) {
        const angle = (i * 30 * Math.PI) / 180;
        const inner = r - 25;
        const outer = r - 10;
        const x1 = (cx + inner * Math.sin(angle)).toFixed(1);
        const y1 = (cy - inner * Math.cos(angle)).toFixed(1);
        const x2 = (cx + outer * Math.sin(angle)).toFixed(1);
        const y2 = (cy - outer * Math.cos(angle)).toFixed(1);
        ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#00000040" stroke-width="4"/>`;
    }
    return ticks;
}

/**
 * The dashed "LABEL AREA" guide, shaped to match the SKU's configured crop
 * shape (imageCompositeService.js's WRAPPER_OVERLAY_REGIONS `shape` field,
 * default 'rectangle') — so the placeholder image doesn't show a rectangle
 * for a SKU that's actually configured as a circle or triangle.
 */
function buildLabelGuide(label, shape) {
    const commonAttrs = 'fill="none" stroke-width="3" stroke-dasharray="10 8"';
    let whiteFill;
    let redDash;
    let blueDash;

    if (shape === 'circle') {
        const cx = label.left + label.width / 2;
        const cy = label.top + label.height / 2;
        const rx = label.width / 2;
        const ry = label.height / 2;
        whiteFill = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ffffff"/>`;
        redDash = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${commonAttrs} stroke="#ef4444"/>`;
        blueDash = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${commonAttrs} stroke="#3b82f6" stroke-dashoffset="9"/>`;
    } else if (shape === 'triangle') {
        const points = [
            [label.left + label.width / 2, label.top],
            [label.left, label.top + label.height],
            [label.left + label.width, label.top + label.height],
        ]
            .map(([x, y]) => `${x},${y}`)
            .join(' ');
        whiteFill = `<polygon points="${points}" fill="#ffffff"/>`;
        redDash = `<polygon points="${points}" ${commonAttrs} stroke="#ef4444"/>`;
        blueDash = `<polygon points="${points}" ${commonAttrs} stroke="#3b82f6" stroke-dashoffset="9"/>`;
    } else {
        const rectAttrs = `x="${label.left}" y="${label.top}" width="${label.width}" height="${label.height}"`;
        whiteFill = `<rect ${rectAttrs} fill="#ffffff"/>`;
        redDash = `<rect ${rectAttrs} ${commonAttrs} stroke="#ef4444"/>`;
        blueDash = `<rect ${rectAttrs} ${commonAttrs} stroke="#3b82f6" stroke-dashoffset="9"/>`;
    }

    return `${whiteFill}\n  ${redDash}\n  ${blueDash}`;
}

/**
 * The "LABEL AREA" / "WxH px" caption. For rectangle/circle this centers on
 * the label's bounding-box center same as before. A triangle (apex at top,
 * base at bottom) is narrower than its bounding box everywhere except right
 * at the base, so centering there overflows past the slanted edges — this
 * shrinks the font and anchors both lines near the base instead, where the
 * triangle is actually as wide as the box.
 */
function buildLabelText(label, shape) {
    const cx = label.left + label.width / 2;

    if (shape === 'triangle') {
        return `
  <text x="${cx}" y="${label.top + label.height - 20}" font-family="Arial, sans-serif" font-size="11" fill="#334155" text-anchor="middle">LABEL AREA</text>
  <text x="${cx}" y="${label.top + label.height - 7}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">${label.width} x ${label.height}px</text>`;
    }

    const cy = label.top + label.height / 2;
    return `
  <text x="${cx}" y="${cy - 6}" font-family="Arial, sans-serif" font-size="16" fill="#334155" text-anchor="middle">LABEL AREA</text>
  <text x="${cx}" y="${cy + 14}" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">${label.width} x ${label.height}px</text>`;
}

/**
 * Renders a flat vector silhouette of the product (via `shapeSvg`, a small
 * SVG markup snippet — usually a few <path>/<rect>/<ellipse> elements using
 * fill="url(#shape)" for the body plus fixed-color accents like a mug rim
 * or phone camera module) on a neutral card, instead of a plain colored
 * rectangle — so a t-shirt spec actually looks like a t-shirt. `label`
 * stays in the same canvas-pixel coordinate space as `shapeSvg`, positioned
 * wherever the printable area sits on that shape (e.g. the chest, for a tee).
 * `labelShape` defaults to 'rectangle' — pass 'circle'/'triangle' to match
 * a SKU that configures a non-default shape in WRAPPER_OVERLAY_REGIONS.
 */
function buildSvg({
    title,
    subtitle,
    footer,
    canvasWidth,
    canvasHeight,
    bgColorFrom,
    bgColorTo,
    shapeSvg,
    label,
    labelShape = 'rectangle',
}) {
    return `
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shape" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgColorFrom}"/>
      <stop offset="100%" stop-color="${bgColorTo}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" rx="24" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="2"/>
  <text x="${canvasWidth / 2}" y="50" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#1e293b" text-anchor="middle">${title}</text>
  <text x="${canvasWidth / 2}" y="80" font-family="Arial, sans-serif" font-size="15" fill="#64748b" text-anchor="middle">${subtitle}</text>
  ${shapeSvg}
  ${buildLabelGuide(label, labelShape)}
  ${buildLabelText(label, labelShape)}
  <text x="${canvasWidth / 2}" y="${canvasHeight - 24}" font-family="Arial, sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">${footer}</text>
</svg>`.trim();
}

// Add one spec per new product. canvasWidth/canvasHeight should roughly
// match the product's real aspect ratio; label is the box (in the same
// pixel space as the canvas) where the personalized artwork gets composited.
const SPECS = [
    {
        sku: 'generic-tshirt-placeholder',
        fileName: 'tshirt-wrapper-mockup.png',
        title: 'T-SHIRT',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: T-Shirt (placeholder)',
        canvasWidth: 600,
        canvasHeight: 700,
        bgColorFrom: '#0f766e',
        bgColorTo: '#134e4a',
        // Flat crew-neck short-sleeve tee silhouette, hand-plotted in canvas
        // pixel coordinates: shoulder -> sleeve outer-top -> sleeve
        // outer-bottom (cuff) -> underarm notch -> hem, mirrored, closed by
        // a shallow neckline curve. The distinct cuff corner + inward
        // underarm notch is what reads as "sleeve" instead of a smooth arc.
        shapeSvg:
            '<path d="M235,110 L118,175 L157,266 L222,240 L209,578 L391,578 L378,240 L443,266 L482,175 L365,110 Q300,149 235,110 Z" fill="url(#shape)"/>',
        // Chest print area — centered on the torso, clear of the underarm
        // notches and neckline on every side.
        label: { top: 305, left: 235, width: 130, height: 182 },
    },
    {
        sku: 'generic-mug-placeholder',
        fileName: 'mug-wrapper-mockup.png',
        title: 'MUG',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Mug (placeholder)',
        canvasWidth: 560,
        canvasHeight: 600,
        bgColorFrom: '#b45309',
        bgColorTo: '#78350f',
        // Cylindrical body + a flattened rim ellipse (shading only, hints
        // the opening) + a C-shaped handle ring built from two concentric
        // arcs (outer arc out, inner arc back) attached to the body's right
        // edge. Handle sits off-center — real mugs are asymmetric too.
        shapeSvg: `
            <rect x="140" y="170" width="220" height="300" rx="16" fill="url(#shape)"/>
            <ellipse cx="250" cy="170" rx="110" ry="16" fill="#00000022"/>
            <path d="M360,235 A70,90 0 0 1 360,405 L360,375 A40,60 0 0 0 360,265 Z" fill="url(#shape)"/>
        `,
        // Wrap-around print area on the body front, clear of the rim shading
        // above and the base below.
        label: { top: 230, left: 180, width: 150, height: 170 },
    },
    {
        sku: 'generic-mobile-cover-placeholder',
        fileName: 'mobile-cover-wrapper-mockup.png',
        title: 'MOBILE COVER',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Mobile Cover (placeholder)',
        canvasWidth: 420,
        canvasHeight: 760,
        bgColorFrom: '#4338ca',
        bgColorTo: '#312e81',
        // Rounded-corner case body + a camera-module cutout (dual lens +
        // flash) in the top-left corner, the detail that reads as "phone
        // back cover" instead of a generic rounded rectangle.
        shapeSvg: `
            <rect x="60" y="110" width="300" height="560" rx="50" fill="url(#shape)"/>
            <rect x="90" y="150" width="90" height="90" rx="20" fill="#00000030"/>
            <circle cx="115" cy="175" r="14" fill="#00000055"/>
            <circle cx="155" cy="175" r="14" fill="#00000055"/>
            <circle cx="115" cy="215" r="8" fill="#00000055"/>
        `,
        // Full-cover print area below the camera module.
        label: { top: 270, left: 90, width: 240, height: 350 },
    },
    {
        sku: 'generic-school-bag-placeholder',
        fileName: 'school-bag-wrapper-mockup.png',
        title: 'SCHOOL BAG',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: School Bag (placeholder)',
        canvasWidth: 620,
        canvasHeight: 740,
        bgColorFrom: '#be123c',
        bgColorTo: '#881337',
        // Two shoulder straps (behind everything) -> main body -> a flap
        // overlapping the body's top edge -> a shaded front pocket. Paint
        // order matters here: straps must render before the body/flap so
        // they read as tucked underneath, not floating on top.
        shapeSvg: `
            <rect x="190" y="100" width="40" height="140" rx="20" fill="url(#shape)"/>
            <rect x="390" y="100" width="40" height="140" rx="20" fill="url(#shape)"/>
            <rect x="140" y="240" width="340" height="380" rx="40" fill="url(#shape)"/>
            <rect x="160" y="180" width="300" height="100" rx="40" fill="url(#shape)"/>
            <rect x="210" y="460" width="200" height="140" rx="24" fill="#00000022"/>
        `,
        // Print area on the main body, between the flap above and the front
        // pocket below.
        label: { top: 300, left: 210, width: 200, height: 130 },
    },
    {
        sku: 'generic-bottle-placeholder',
        fileName: 'bottle-wrapper-mockup.png',
        title: 'BOTTLE',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Bottle (placeholder)',
        canvasWidth: 420,
        canvasHeight: 820,
        bgColorFrom: '#0e7490',
        bgColorTo: '#164e63',
        // Rounded cylindrical body + a curved shoulder (cubic bezier on each
        // side, not a straight taper — a sharp trapezoid reads as a witch's
        // hat, not a bottle) narrowing up to a small cap. All three pieces
        // share the same horizontal center (210, i.e. canvas width / 2) so
        // the silhouette reads as one bottle.
        shapeSvg: `
            <rect x="80" y="240" width="260" height="520" rx="50" fill="url(#shape)"/>
            <path d="M175,145 C130,160 90,190 80,240 L340,240 C330,190 290,160 245,145 Z" fill="url(#shape)"/>
            <rect x="175" y="100" width="70" height="45" rx="10" fill="url(#shape)"/>
        `,
        // Wrap-around label band in the middle third of the body.
        label: { top: 380, left: 110, width: 200, height: 250 },
    },
    {
        sku: 'generic-tote-bag-placeholder',
        fileName: 'tote-bag-wrapper-mockup.png',
        title: 'TOTE BAG',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Tote Bag (placeholder)',
        canvasWidth: 560,
        canvasHeight: 680,
        bgColorFrom: '#15803d',
        bgColorTo: '#14532d',
        // Two rounded loop handles (thick open strokes, not filled shapes)
        // drawn before the body rect so their attach points sit tucked
        // under the body's top edge.
        shapeSvg: `
            <path d="M200,220 C200,140 260,140 260,220" fill="none" stroke="url(#shape)" stroke-width="18" stroke-linecap="round"/>
            <path d="M340,220 C340,140 400,140 400,220" fill="none" stroke="url(#shape)" stroke-width="18" stroke-linecap="round"/>
            <rect x="140" y="220" width="280" height="380" rx="20" fill="url(#shape)"/>
        `,
        label: { top: 280, left: 190, width: 180, height: 220 },
    },
    {
        sku: 'generic-cap-placeholder',
        fileName: 'cap-wrapper-mockup.png',
        title: 'CAP',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Cap (placeholder)',
        canvasWidth: 600,
        canvasHeight: 420,
        bgColorFrom: '#c2410c',
        bgColorTo: '#7c2d12',
        // Dome crown (a half-ellipse arc closed straight across the
        // bottom) + a shallow lens-shaped brim beneath its front edge.
        shapeSvg: `
            <path d="M150,300 A150,160 0 0 1 450,300 Z" fill="url(#shape)"/>
            <path d="M170,300 Q300,345 430,300 Q300,320 170,300 Z" fill="url(#shape)"/>
        `,
        // Front panel print area, on the crown above the brim.
        label: { top: 190, left: 230, width: 140, height: 90 },
    },
    {
        sku: 'generic-mouse-pad-placeholder',
        fileName: 'mouse-pad-wrapper-mockup.png',
        title: 'MOUSE PAD',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Mouse Pad (placeholder)',
        canvasWidth: 700,
        canvasHeight: 500,
        bgColorFrom: '#475569',
        bgColorTo: '#1e293b',
        // Deliberately the simplest shape in the set — a mouse pad really
        // is just a wide flat rectangle.
        shapeSvg: '<rect x="60" y="100" width="580" height="300" rx="24" fill="url(#shape)"/>',
        label: { top: 150, left: 140, width: 420, height: 200 },
    },
    {
        sku: 'generic-photo-frame-placeholder',
        fileName: 'photo-frame-wrapper-mockup.png',
        title: 'PHOTO FRAME',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Photo Frame (placeholder)',
        canvasWidth: 560,
        canvasHeight: 680,
        bgColorFrom: '#a16207',
        bgColorTo: '#713f12',
        // Just the outer frame rect — the label box (drawn on top by
        // buildSvg) IS the photo opening, inset 40px on every side to read
        // as the frame's border thickness.
        shapeSvg: '<rect x="100" y="140" width="360" height="460" rx="16" fill="url(#shape)"/>',
        label: { top: 180, left: 140, width: 280, height: 380 },
    },
    {
        sku: 'generic-pillow-placeholder',
        fileName: 'pillow-wrapper-mockup.png',
        title: 'PILLOW COVER',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Pillow Cover (placeholder)',
        canvasWidth: 560,
        canvasHeight: 560,
        bgColorFrom: '#a21caf',
        bgColorTo: '#701a75',
        // Square body with heavy corner rounding (soft pillow look) + a
        // small circle at each corner standing in for a tassel/pom-pom.
        shapeSvg: `
            <rect x="110" y="140" width="340" height="340" rx="40" fill="url(#shape)"/>
            <circle cx="110" cy="140" r="16" fill="url(#shape)"/>
            <circle cx="450" cy="140" r="16" fill="url(#shape)"/>
            <circle cx="110" cy="480" r="16" fill="url(#shape)"/>
            <circle cx="450" cy="480" r="16" fill="url(#shape)"/>
        `,
        label: { top: 210, left: 180, width: 200, height: 200 },
    },
    {
        sku: 'generic-coaster-placeholder',
        fileName: 'coaster-wrapper-mockup.png',
        title: 'COASTER',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Coaster (placeholder)',
        canvasWidth: 480,
        canvasHeight: 500,
        bgColorFrom: '#78350f',
        bgColorTo: '#451a03',
        shapeSvg: '<circle cx="240" cy="270" r="160" fill="url(#shape)"/>',
        // A square label inscribed inside the circle — its corners stay
        // well within the radius so nothing clips the circular edge.
        label: { top: 180, left: 150, width: 180, height: 180 },
        labelShape: 'circle',
    },
    {
        sku: 'generic-keychain-placeholder',
        fileName: 'keychain-wrapper-mockup.png',
        title: 'KEYCHAIN',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Keychain (placeholder)',
        canvasWidth: 360,
        canvasHeight: 520,
        bgColorFrom: '#ca8a04',
        bgColorTo: '#854d0e',
        // An unfilled ring (stroke only) sitting flush against the top of
        // the tag body, standing in for the keyring loop.
        shapeSvg: `
            <circle cx="180" cy="145" r="35" fill="none" stroke="url(#shape)" stroke-width="14"/>
            <rect x="80" y="180" width="200" height="280" rx="24" fill="url(#shape)"/>
        `,
        label: { top: 230, left: 110, width: 140, height: 160 },
    },
    {
        sku: 'generic-notebook-placeholder',
        fileName: 'notebook-wrapper-mockup.png',
        title: 'NOTEBOOK',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Notebook (placeholder)',
        canvasWidth: 560,
        canvasHeight: 680,
        bgColorFrom: '#1d4ed8',
        bgColorTo: '#1e3a8a',
        // Cover rect + a column of small dark dots along the left edge
        // standing in for spiral-binding rings. The label sits 50px clear
        // of that column so it never overlaps the "spiral".
        shapeSvg: `
            <rect x="140" y="140" width="340" height="460" rx="12" fill="url(#shape)"/>
            <circle cx="140" cy="180" r="10" fill="#00000035"/>
            <circle cx="140" cy="234" r="10" fill="#00000035"/>
            <circle cx="140" cy="288" r="10" fill="#00000035"/>
            <circle cx="140" cy="342" r="10" fill="#00000035"/>
            <circle cx="140" cy="396" r="10" fill="#00000035"/>
            <circle cx="140" cy="450" r="10" fill="#00000035"/>
            <circle cx="140" cy="504" r="10" fill="#00000035"/>
            <circle cx="140" cy="558" r="10" fill="#00000035"/>
        `,
        label: { top: 220, left: 190, width: 240, height: 320 },
    },
    {
        sku: 'generic-greeting-card-placeholder',
        fileName: 'greeting-card-wrapper-mockup.png',
        title: 'GREETING CARD',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Greeting Card (placeholder)',
        canvasWidth: 560,
        canvasHeight: 680,
        bgColorFrom: '#dc2626',
        bgColorTo: '#991b1b',
        // Card rect + a dashed center fold line. The label sits entirely on
        // the right half (the front cover) — the left half is the card's
        // inside, which a design never prints on.
        shapeSvg: `
            <rect x="110" y="140" width="340" height="460" rx="12" fill="url(#shape)"/>
            <line x1="280" y1="140" x2="280" y2="600" stroke="#00000025" stroke-width="2" stroke-dasharray="6 6"/>
        `,
        label: { top: 220, left: 300, width: 130, height: 220 },
    },
    {
        sku: 'generic-wallet-placeholder',
        fileName: 'wallet-wrapper-mockup.png',
        title: 'WALLET',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Wallet (placeholder)',
        canvasWidth: 560,
        canvasHeight: 420,
        bgColorFrom: '#57534e',
        bgColorTo: '#292524',
        // Bifold body + dashed center fold line + a small card peeking out
        // of a slot on the right, clear of the label on the left half.
        shapeSvg: `
            <rect x="90" y="140" width="380" height="220" rx="20" fill="url(#shape)"/>
            <line x1="280" y1="140" x2="280" y2="360" stroke="#00000025" stroke-width="2" stroke-dasharray="6 6"/>
            <rect x="340" y="120" width="70" height="30" rx="6" fill="url(#shape)"/>
        `,
        label: { top: 190, left: 130, width: 130, height: 130 },
    },
    {
        sku: 'generic-umbrella-placeholder',
        fileName: 'umbrella-wrapper-mockup.png',
        title: 'UMBRELLA',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Umbrella (placeholder)',
        canvasWidth: 560,
        canvasHeight: 600,
        bgColorFrom: '#0284c7',
        bgColorTo: '#075985',
        // Dome canopy (quarter-ellipse arc closed straight across) + 5
        // radiating seam lines (the panel-stitch detail that reads as
        // "umbrella" rather than a plain dome) + a hooked handle stroke.
        shapeSvg: `
            <path d="M100,320 A180,200 0 0 1 460,320 Z" fill="url(#shape)"/>
            <line x1="280" y1="120" x2="160" y2="320" stroke="#00000025" stroke-width="2"/>
            <line x1="280" y1="120" x2="220" y2="320" stroke="#00000025" stroke-width="2"/>
            <line x1="280" y1="120" x2="280" y2="320" stroke="#00000025" stroke-width="2"/>
            <line x1="280" y1="120" x2="340" y2="320" stroke="#00000025" stroke-width="2"/>
            <line x1="280" y1="120" x2="400" y2="320" stroke="#00000025" stroke-width="2"/>
            <path d="M280,320 L280,460 A30,30 0 1 1 250,460" fill="none" stroke="url(#shape)" stroke-width="14" stroke-linecap="round"/>
        `,
        label: { top: 200, left: 220, width: 120, height: 100 },
    },
    {
        sku: 'generic-apron-placeholder',
        fileName: 'apron-wrapper-mockup.png',
        title: 'APRON',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Apron (placeholder)',
        canvasWidth: 500,
        canvasHeight: 680,
        bgColorFrom: '#65a30d',
        bgColorTo: '#3f6212',
        // Bib rect + a neck-strap loop over the top + a flared skirt
        // (straight-line trapezoid — apron skirts genuinely flare outward
        // toward the hem, unlike the bottle shoulder, so no curve needed
        // here) + two waist-tie strokes.
        shapeSvg: `
            <path d="M170,160 C170,95 330,95 330,160" fill="none" stroke="url(#shape)" stroke-width="16" stroke-linecap="round"/>
            <rect x="170" y="160" width="160" height="180" rx="20" fill="url(#shape)"/>
            <path d="M120,340 L380,340 L420,620 L80,620 Z" fill="url(#shape)"/>
            <line x1="120" y1="480" x2="60" y2="500" stroke="url(#shape)" stroke-width="10" stroke-linecap="round"/>
            <line x1="380" y1="480" x2="440" y2="500" stroke="url(#shape)" stroke-width="10" stroke-linecap="round"/>
        `,
        label: { top: 400, left: 140, width: 220, height: 180 },
    },
    {
        sku: 'generic-hoodie-placeholder',
        fileName: 'hoodie-wrapper-mockup.png',
        title: 'HOODIE',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Hoodie (placeholder)',
        canvasWidth: 600,
        canvasHeight: 740,
        bgColorFrom: '#6d28d9',
        bgColorTo: '#4c1d95',
        // Same tee silhouette technique as generic-tshirt-placeholder, with
        // the shallow neckline curve swapped for a much deeper one (hood
        // bump) plus two drawstring ticks and a kangaroo-pocket rect.
        shapeSvg: `
            <path d="M235,150 L118,215 L157,306 L222,280 L209,618 L391,618 L378,280 L443,306 L482,215 L365,150 Q300,100 235,150 Z" fill="url(#shape)"/>
            <line x1="270" y1="190" x2="270" y2="230" stroke="#00000030" stroke-width="4" stroke-linecap="round"/>
            <line x1="300" y1="190" x2="300" y2="230" stroke="#00000030" stroke-width="4" stroke-linecap="round"/>
            <rect x="250" y="480" width="100" height="90" rx="16" fill="#00000022"/>
        `,
        label: { top: 345, left: 235, width: 130, height: 120 },
    },
    {
        sku: 'generic-wall-clock-placeholder',
        fileName: 'wall-clock-wrapper-mockup.png',
        title: 'WALL CLOCK',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Wall Clock (placeholder)',
        canvasWidth: 480,
        canvasHeight: 520,
        bgColorFrom: '#334155',
        bgColorTo: '#0f172a',
        shapeSvg: `
            <circle cx="240" cy="280" r="160" fill="url(#shape)"/>
            ${clockTicks(240, 280, 160)}
            <line x1="240" y1="280" x2="190" y2="190" stroke="#00000060" stroke-width="6" stroke-linecap="round"/>
            <line x1="240" y1="280" x2="300" y2="160" stroke="#00000060" stroke-width="4" stroke-linecap="round"/>
            <circle cx="240" cy="280" r="8" fill="#00000060"/>
        `,
        // Lower-face print area, clear of both hands and every tick mark.
        label: { top: 320, left: 190, width: 100, height: 80 },
        labelShape: 'circle',
    },
    {
        sku: 'generic-face-mask-placeholder',
        fileName: 'face-mask-wrapper-mockup.png',
        title: 'FACE MASK',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Face Mask (placeholder)',
        canvasWidth: 520,
        canvasHeight: 400,
        bgColorFrom: '#0d9488',
        bgColorTo: '#115e59',
        // Lens-shaped body (4 quadratic curves: nose-bridge dip, two cheek
        // bulges, chin bulge) + two ear-loop ellipse outlines.
        shapeSvg: `
            <path d="M100,150 Q250,110 400,150 Q430,220 400,280 Q250,320 100,280 Q70,220 100,150 Z" fill="url(#shape)"/>
            <ellipse cx="60" cy="215" rx="40" ry="60" fill="none" stroke="url(#shape)" stroke-width="10"/>
            <ellipse cx="460" cy="215" rx="40" ry="60" fill="none" stroke="url(#shape)" stroke-width="10"/>
        `,
        label: { top: 170, left: 170, width: 160, height: 90 },
    },
    {
        sku: 'generic-baby-bib-placeholder',
        fileName: 'baby-bib-wrapper-mockup.png',
        title: 'BABY BIB',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Baby Bib (placeholder)',
        canvasWidth: 480,
        canvasHeight: 520,
        bgColorFrom: '#db2777',
        bgColorTo: '#9d174d',
        // Heavily-rounded body + a same-color-as-card circle punched into
        // the top edge (a cheap "cutout" trick: matches buildSvg's #f1f5f9
        // card fill, so it reads as a neckline notch instead of a shape) +
        // two neck-tie strokes.
        shapeSvg: `
            <rect x="100" y="160" width="280" height="260" rx="100" fill="url(#shape)"/>
            <circle cx="240" cy="160" r="50" fill="#f1f5f9"/>
            <line x1="200" y1="140" x2="160" y2="100" stroke="url(#shape)" stroke-width="10" stroke-linecap="round"/>
            <line x1="280" y1="140" x2="320" y2="100" stroke="url(#shape)" stroke-width="10" stroke-linecap="round"/>
        `,
        label: { top: 250, left: 170, width: 140, height: 130 },
    },
    {
        sku: 'generic-pennant-flag-placeholder',
        fileName: 'pennant-flag-wrapper-mockup.png',
        title: 'PENNANT FLAG',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Pennant Flag (placeholder)',
        canvasWidth: 460,
        canvasHeight: 500,
        bgColorFrom: '#7f1d1d',
        bgColorTo: '#450a0a',
        // Pole rect + a triangular pennant. Label is sized to fit inside
        // the triangle's wide (pole-side) portion only — it would poke
        // past the slanted edge if it extended toward the tip.
        shapeSvg: `
            <rect x="100" y="100" width="14" height="320" rx="6" fill="url(#shape)"/>
            <path d="M114,130 L400,220 L114,310 Z" fill="url(#shape)"/>
        `,
        label: { top: 175, left: 140, width: 100, height: 90 },
        labelShape: 'triangle',
    },
    {
        sku: 'generic-puzzle-piece-placeholder',
        fileName: 'puzzle-piece-wrapper-mockup.png',
        title: 'JIGSAW PUZZLE',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Jigsaw Puzzle (placeholder)',
        canvasWidth: 480,
        canvasHeight: 480,
        bgColorFrom: '#059669',
        bgColorTo: '#065f46',
        // A square with one classic puzzle "knob" (outward arc) on the top
        // edge and one "notch" (inward arc, opposite sweep flag) on the
        // right edge — enough to read as a puzzle piece without needing
        // all 4 sides bumped.
        shapeSvg:
            '<path d="M140,140 L215,140 A35,35 0 0 1 285,140 L340,140 L340,215 A35,35 0 0 0 340,285 L340,340 L140,340 Z" fill="url(#shape)"/>',
        label: { top: 180, left: 170, width: 110, height: 130 },
    },
    {
        sku: 'generic-guitar-pick-placeholder',
        fileName: 'guitar-pick-wrapper-mockup.png',
        title: 'GUITAR PICK',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Guitar Pick (placeholder)',
        canvasWidth: 400,
        canvasHeight: 440,
        bgColorFrom: '#f59e0b',
        bgColorTo: '#92400e',
        // Reuleaux-triangle construction: 3 equal-radius arcs between 3
        // points, each bulging outward — a standard technique for a smooth
        // rounded-triangle (pick/plectrum) silhouette.
        shapeSvg:
            '<path d="M160,190 A150,150 0 0 1 320,190 A150,150 0 0 1 240,380 A150,150 0 0 1 160,190 Z" fill="url(#shape)"/>',
        label: { top: 220, left: 180, width: 120, height: 100 },
        labelShape: 'triangle',
    },
    {
        sku: 'generic-passport-cover-placeholder',
        fileName: 'passport-cover-wrapper-mockup.png',
        title: 'PASSPORT COVER',
        subtitle: 'placeholder mockup — not a real product photo',
        footer: 'Product: Passport Cover (placeholder)',
        canvasWidth: 420,
        canvasHeight: 580,
        bgColorFrom: '#166534',
        bgColorTo: '#052e16',
        // Cover rect + a generic ring-and-dot emblem accent — distinguishes
        // it from the plain-rectangle notebook/wallet at a glance.
        shapeSvg: `
            <rect x="90" y="140" width="240" height="340" rx="12" fill="url(#shape)"/>
            <circle cx="210" cy="220" r="35" fill="none" stroke="#00000030" stroke-width="4"/>
            <circle cx="210" cy="220" r="6" fill="#00000040"/>
        `,
        label: { top: 290, left: 120, width: 180, height: 160 },
    },
];

async function generateAll() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const spec of SPECS) {
        const svg = buildSvg(spec);
        const outputPath = path.join(OUTPUT_DIR, spec.fileName);
        await sharp(Buffer.from(svg)).png().toFile(outputPath);

        console.log(`Generated ${spec.fileName}`);
        console.log(`Paste this into WRAPPER_OVERLAY_REGIONS in imageCompositeService.js:\n`);
        console.log(`    '${spec.sku}': {`);
        console.log(
            `        templatePath: path.join(process.cwd(), 'assets', 'wrappers', '${spec.fileName}'),`
        );
        console.log(`        publicUrl: \`\${config.apiURL}/assets/wrappers/${spec.fileName}\`,`);
        console.log(`        top: ${spec.label.top},`);
        console.log(`        left: ${spec.label.left},`);
        console.log(`        width: ${spec.label.width},`);
        console.log(`        height: ${spec.label.height},`);
        if (spec.labelShape && spec.labelShape !== 'rectangle') {
            console.log(`        shape: '${spec.labelShape}',`);
        }
        console.log(`    },\n`);
    }
}

generateAll().catch((error) => {
    console.error('Failed to generate wrapper placeholders:', error);
    process.exit(1);
});
