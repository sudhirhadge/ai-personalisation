import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PromptInput from './PromptInput';

describe('PromptInput', () => {
    it('renders the current value and calls onChange while typing', async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();

        render(<PromptInput value="" onChange={handleChange} />);

        const textarea = screen.getByLabelText(/describe what you want/i);
        await user.type(textarea, 'hi');

        // userEvent.type fires one onChange per keystroke, each with the
        // single character typed (the component is a controlled input, so
        // the parent — not this test — owns accumulating the full string).
        expect(handleChange).toHaveBeenCalledTimes(2);
        expect(handleChange).toHaveBeenNthCalledWith(1, 'h');
        expect(handleChange).toHaveBeenNthCalledWith(2, 'i');
    });

    it('disables the textarea when disabled is true', () => {
        render(<PromptInput value="" onChange={vi.fn()} disabled />);
        expect(screen.getByLabelText(/describe what you want/i)).toBeDisabled();
    });
});
