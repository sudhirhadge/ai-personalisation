/**
 * Extracted from the old SuccessScreen.jsx's inline copy-to-clipboard logic
 * so it's reusable anywhere a personalization link needs to be shown/copied.
 */
import { useState } from 'react';

interface CopyLinkButtonProps {
    link: string;
}

function CopyLinkButton({ link }: CopyLinkButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button type="button" className="btn-secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
        </button>
    );
}

export default CopyLinkButton;
