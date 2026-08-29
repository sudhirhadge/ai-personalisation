/**
 * Renders the 4 modes from GENERATION_MODES as selectable cards. Wrapper
 * modes are filtered out entirely when the session's productSku has no
 * entry in the wrapper-templates catalog — this avoids the user picking a
 * mode and then hitting the backend's "No wrapper template configured for
 * product: X" 400 (server/controllers/aiController.js), by simply not
 * offering an option that can't succeed for this session.
 */
import { GENERATION_MODE_LIST } from '../config/generationModes';
import { useSession } from '../hooks/useSession';
import { useWrapperTemplates } from '../hooks/useWrapperTemplates';
import { usePersonalizationWizard } from '../context/PersonalizationWizardContext';

function ModeSelector() {
    const { data: session } = useSession();
    const { data: wrapperTemplates } = useWrapperTemplates();
    const { selectedMode, selectMode } = usePersonalizationWizard();

    if (!session) return null;

    const sessionHasWrapperTemplate = Boolean(
        wrapperTemplates?.some((template) => template.sku === session.productSku)
    );

    const availableModes = GENERATION_MODE_LIST.filter(
        (config) => !config.requiresWrapperTemplate || sessionHasWrapperTemplate
    );

    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Choose a generation mode</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableModes.map((config) => (
                    <button
                        key={config.mode}
                        type="button"
                        onClick={() => selectMode(config.mode)}
                        className={`text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                            selectedMode === config.mode
                                ? 'border-primary-600 ring-4 ring-primary-500/20'
                                : 'border-gray-200 hover:border-primary-400'
                        }`}
                    >
                        <div className="font-semibold text-gray-900">{config.label}</div>
                        <div className="text-sm text-gray-600 mt-1">{config.description}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ModeSelector;
