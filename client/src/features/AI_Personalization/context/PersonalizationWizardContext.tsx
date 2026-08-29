/**
 * Client-only UI navigation state for the personalize-now wizard: which step
 * is active and which generation mode is selected. Deliberately NOT server
 * state — it resets per page load and has no reason to live in React
 * Query's cache (contrast with session/job data, which does).
 */
import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { GenerationMode } from '../types/aiJobType';

export type WizardStep = 'SELECT_MODE' | 'CONFIGURE' | 'RESULT';

interface WizardState {
    step: WizardStep;
    selectedMode: GenerationMode | null;
}

type WizardAction =
    | { type: 'SELECT_MODE'; mode: GenerationMode }
    | { type: 'GO_TO_RESULT' }
    | { type: 'RESET' };

const initialState: WizardState = { step: 'SELECT_MODE', selectedMode: null };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
        case 'SELECT_MODE':
            return { step: 'CONFIGURE', selectedMode: action.mode };
        case 'GO_TO_RESULT':
            return { ...state, step: 'RESULT' };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

interface WizardContextValue extends WizardState {
    selectMode: (mode: GenerationMode) => void;
    goToResult: () => void;
    reset: () => void;
}

const PersonalizationWizardContext = createContext<WizardContextValue | null>(null);

export function PersonalizationWizardProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(wizardReducer, initialState);

    const value: WizardContextValue = {
        ...state,
        selectMode: (mode) => dispatch({ type: 'SELECT_MODE', mode }),
        goToResult: () => dispatch({ type: 'GO_TO_RESULT' }),
        reset: () => dispatch({ type: 'RESET' }),
    };

    return (
        <PersonalizationWizardContext.Provider value={value}>
            {children}
        </PersonalizationWizardContext.Provider>
    );
}

export function usePersonalizationWizard(): WizardContextValue {
    const context = useContext(PersonalizationWizardContext);
    if (!context) {
        throw new Error('usePersonalizationWizard must be used within a PersonalizationWizardProvider');
    }
    return context;
}
