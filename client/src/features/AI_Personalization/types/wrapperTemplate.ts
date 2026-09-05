/**
 * Mirrors GET /api/v1/products/wrapper-templates (server/controllers/wrapperTemplateController.js),
 * itself derived from imageCompositeService.listRegions().
 */
export interface WrapperTemplateRegion {
    top: number;
    left: number;
    width: number;
    height: number;
}

/**
 * How the print/label area should eventually be cropped in the frontend
 * (not implemented yet — this is just the shape hint). 'rectangle' is the
 * default for any SKU that doesn't set one explicitly.
 */
export type WrapperTemplateShape = 'rectangle' | 'circle' | 'triangle';

export interface WrapperTemplate {
    sku: string;
    previewUrl: string;
    region: WrapperTemplateRegion;
    shape: WrapperTemplateShape;
}
