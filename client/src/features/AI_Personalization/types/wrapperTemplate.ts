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

export interface WrapperTemplate {
    sku: string;
    previewUrl: string;
    region: WrapperTemplateRegion;
}
