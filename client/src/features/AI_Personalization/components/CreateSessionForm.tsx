/**
 * Rewrite of CreateSessionForm.jsx. Replaces the old single free-text
 * productSku field with a dual-path chooser:
 * - "Personalize a wrapper template" (default): a visual grid from
 *   useWrapperTemplates(), since only wrapper-configured SKUs can ever use
 *   the WRAPPER_COMPOSITE modes and there's no reason to make a user type
 *   one of 2 known SKUs blind.
 * - "Other product (manual SKU)": free text, for sessions that will only
 *   ever use TEXT_TO_IMAGE/IMAGE_TO_IMAGE — there's no general product
 *   catalog for this feature, so manual entry remains the only option for
 *   SKUs outside the wrapper-template registry.
 */
import { useState } from 'react';
import { useWrapperTemplates } from '../hooks/useWrapperTemplates';
import { isValidEmail } from '../utils/validation';
import WrapperTemplatePicker from './WrapperTemplatePicker';

type SkuPath = 'template' | 'manual';

interface CreateSessionFormProps {
    onSubmit: (email: string, productSku: string) => void;
    isLoading: boolean;
    error: string | null;
}

function CreateSessionForm({ onSubmit, isLoading, error }: CreateSessionFormProps) {
    const { data: templates, isLoading: templatesLoading } = useWrapperTemplates();

    const [email, setEmail] = useState('');
    const [skuPath, setSkuPath] = useState<SkuPath>('template');
    const [selectedTemplateSku, setSelectedTemplateSku] = useState<string | null>(null);
    const [manualSku, setManualSku] = useState('');
    const [validationErrors, setValidationErrors] = useState<{ email?: string; productSku?: string }>({});

    const productSku = skuPath === 'template' ? selectedTemplateSku : manualSku.trim();

    const validate = (): boolean => {
        const errors: { email?: string; productSku?: string } = {};
        if (!email) {
            errors.email = 'Email is required';
        } else if (!isValidEmail(email)) {
            errors.email = 'Invalid email format';
        }
        if (!productSku) {
            errors.productSku =
                skuPath === 'template' ? 'Please select a wrapper template' : 'Product SKU is required';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || !productSku) return;
        onSubmit(email, productSku);
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                </label>
                <input
                    type="email"
                    id="email"
                    className="input-field"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setValidationErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    disabled={isLoading}
                />
                {validationErrors.email && (
                    <div className="mt-2 text-sm text-red-600">{validationErrors.email}</div>
                )}
            </div>

            <div className="mb-6">
                <div className="flex items-center gap-4 mb-3">
                    <button
                        type="button"
                        className={`text-sm font-semibold pb-1 border-b-2 ${
                            skuPath === 'template' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-400'
                        }`}
                        onClick={() => setSkuPath('template')}
                    >
                        Personalize a wrapper template
                    </button>
                    <button
                        type="button"
                        className={`text-sm font-semibold pb-1 border-b-2 ${
                            skuPath === 'manual' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-400'
                        }`}
                        onClick={() => setSkuPath('manual')}
                    >
                        Other product (manual SKU)
                    </button>
                </div>

                {skuPath === 'template' ? (
                    templatesLoading ? (
                        <p className="text-sm text-gray-500">Loading templates...</p>
                    ) : (
                        <WrapperTemplatePicker
                            templates={templates || []}
                            selectedSku={selectedTemplateSku}
                            onSelect={(sku) => {
                                setSelectedTemplateSku(sku);
                                setValidationErrors((prev) => ({ ...prev, productSku: undefined }));
                            }}
                        />
                    )
                ) : (
                    <input
                        type="text"
                        className="input-field"
                        placeholder="e.g., TSHIRT-BLUE-M"
                        value={manualSku}
                        onChange={(e) => {
                            setManualSku(e.target.value);
                            setValidationErrors((prev) => ({ ...prev, productSku: undefined }));
                        }}
                        disabled={isLoading}
                    />
                )}
                {validationErrors.productSku && (
                    <div className="mt-2 text-sm text-red-600">{validationErrors.productSku}</div>
                )}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
                {isLoading ? 'Creating Session...' : 'Create Personalization Session'}
            </button>
        </form>
    );
}

export default CreateSessionForm;
