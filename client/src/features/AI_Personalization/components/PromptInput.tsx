/**
 * Rendered only when the selected mode's config has hasPromptInput: true —
 * WRAPPER_COMPOSITE_MULTI_REF is the one mode without a prompt field
 * (fixedPrompt: true server-side; the worker builds its own prompt).
 * The parent decides whether to render this at all by checking
 * GENERATION_MODES[mode].hasPromptInput.
 */
interface PromptInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

function PromptInput({ value, onChange, disabled = false }: PromptInputProps) {
    return (
        <div>
            <label htmlFor="prompt" className="block text-sm font-semibold text-gray-700 mb-2">
                Describe what you want
            </label>
            <textarea
                id="prompt"
                className="input-field min-h-[100px] resize-y"
                placeholder="e.g., A vibrant cartoon-style portrait with a warm smile"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </div>
    );
}

export default PromptInput;
