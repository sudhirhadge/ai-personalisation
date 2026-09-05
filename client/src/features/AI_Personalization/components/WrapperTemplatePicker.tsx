/**
 * Visual grid of wrapper templates. Used two ways:
 * - At session creation (CreateSessionForm): clickable, sets productSku.
 * - In the personalize wizard (read-only): shows which template the
 *   session is already bound to, with the region box for reference — the
 *   session's productSku is fixed at creation time, so this view never lets
 *   the user pick a different template than the one their session already
 *   has (there's no endpoint to change productSku after creation).
 *
 * The region overlay (shaped per `template.shape` — rectangle/circle/
 * triangle) is defined in the template's own natural pixel dimensions
 * (server/services/imageCompositeService.js), but the <img> is rendered at
 * whatever width the grid gives it. An SVG viewBox matching the image's
 * natural size handles that scaling natively, so the overlay is drawn in
 * raw region coordinates with no manual scale-factor math.
 */
import { useState } from 'react';
import type {
    WrapperTemplate,
    WrapperTemplateRegion,
    WrapperTemplateShape,
} from '../types/wrapperTemplate';

interface WrapperTemplatePickerProps {
    templates: WrapperTemplate[];
    selectedSku: string | null;
    onSelect?: (sku: string) => void;
    readOnly?: boolean;
}

/** Dashed guide matching `shape` — 'rectangle' is also the fallback for any future shape this component doesn't know yet. */
function RegionShape({
    region,
    shape,
}: {
    region: WrapperTemplateRegion;
    shape: WrapperTemplateShape;
}) {
    const style = {
        className: 'fill-primary-500/10 stroke-primary-500',
        strokeWidth: 2,
        strokeDasharray: '6 4',
    };

    if (shape === 'circle') {
        return (
            <ellipse
                cx={region.left + region.width / 2}
                cy={region.top + region.height / 2}
                rx={region.width / 2}
                ry={region.height / 2}
                {...style}
            />
        );
    }
    if (shape === 'triangle') {
        const points = [
            [region.left + region.width / 2, region.top],
            [region.left, region.top + region.height],
            [region.left + region.width, region.top + region.height],
        ]
            .map(([x, y]) => `${x},${y}`)
            .join(' ');
        return <polygon points={points} {...style} />;
    }
    return (
        <rect
            x={region.left}
            y={region.top}
            width={region.width}
            height={region.height}
            {...style}
        />
    );
}

function TemplateTile({
    template,
    isSelected,
    readOnly,
    onSelect,
}: {
    template: WrapperTemplate;
    isSelected: boolean;
    readOnly: boolean;
    onSelect?: (sku: string) => void;
}) {
    // The region's top/left/width/height are in the template image's own
    // natural pixel space. An SVG viewBox matching that natural size lets
    // the browser scale the guide shape to the rendered image size for us
    // — no manual scale-factor math needed.
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };

    return (
        <button
            type="button"
            disabled={readOnly}
            onClick={() => onSelect?.(template.sku)}
            className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                isSelected ? 'border-primary-600 ring-4 ring-primary-500/20' : 'border-gray-200'
            } ${readOnly ? 'cursor-default' : 'hover:border-primary-400'}`}
        >
            <div className="relative">
                {/* The template photo itself — renders unconditionally, independent of
                    the svg below. Removing the svg block only removes the dashed guide
                    outline; it never affects whether this image shows up. */}
                <img
                    src={template.previewUrl}
                    alt={template.sku}
                    onLoad={handleImageLoad}
                    className="w-full h-auto block"
                />
                {/* Decorative overlay only — a transparent layer drawn on top of the
                    image above, not part of it. Shows where the print area sits and
                    what shape it's configured as (rectangle/circle/triangle); it does
                    not crop or mask anything. Safe to delete this whole block. */}
                {naturalSize !== null && (
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                        preserveAspectRatio="none"
                    >
                        <RegionShape region={template.region} shape={template.shape} />
                    </svg>
                )}
            </div>
            <div className="p-2 text-sm font-medium text-gray-700 text-center bg-white">
                {template.sku}
            </div>
        </button>
    );
}

function WrapperTemplatePicker({
    templates,
    selectedSku,
    onSelect,
    readOnly = false,
}: WrapperTemplatePickerProps) {
    if (templates.length === 0) {
        return <p className="text-gray-500 text-sm">No wrapper templates are configured yet.</p>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {templates.map((template) => (
                <TemplateTile
                    key={template.sku}
                    template={template}
                    isSelected={template.sku === selectedSku}
                    readOnly={readOnly}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}

export default WrapperTemplatePicker;
