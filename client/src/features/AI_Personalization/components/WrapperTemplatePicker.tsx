/**
 * Visual grid of wrapper templates. Used two ways:
 * - At session creation (CreateSessionForm): clickable, sets productSku.
 * - In the personalize wizard (read-only): shows which template the
 *   session is already bound to, with the region box for reference — the
 *   session's productSku is fixed at creation time, so this view never lets
 *   the user pick a different template than the one their session already
 *   has (there's no endpoint to change productSku after creation).
 *
 * The region overlay box is defined in the template's own natural pixel
 * dimensions (server/services/imageCompositeService.js), but the <img> is
 * rendered at whatever width the grid gives it — so the box position/size
 * must be scaled by (rendered width / natural width) once the image loads.
 */
import { useState } from 'react';
import type { WrapperTemplate } from '../types/wrapperTemplate';

interface WrapperTemplatePickerProps {
    templates: WrapperTemplate[];
    selectedSku: string | null;
    onSelect?: (sku: string) => void;
    readOnly?: boolean;
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
    // Scale factor between the region's natural-pixel coordinates and the
    // image's actual rendered size, computed once the image loads.
    const [scale, setScale] = useState<number | null>(null);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setScale(img.clientWidth / img.naturalWidth);
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
                <img
                    src={template.previewUrl}
                    alt={template.sku}
                    onLoad={handleImageLoad}
                    className="w-full h-auto block"
                />
                {scale !== null && (
                    <div
                        className="absolute border-2 border-dashed border-primary-500 bg-primary-500/10 pointer-events-none"
                        style={{
                            top: template.region.top * scale,
                            left: template.region.left * scale,
                            width: template.region.width * scale,
                            height: template.region.height * scale,
                        }}
                    />
                )}
            </div>
            <div className="p-2 text-sm font-medium text-gray-700 text-center bg-white">
                {template.sku}
            </div>
        </button>
    );
}

function WrapperTemplatePicker({ templates, selectedSku, onSelect, readOnly = false }: WrapperTemplatePickerProps) {
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
