/**
 * Main App Component
 * Sets up routing for the application
 *
 * Architectural Decision:
 * - React Router for client-side navigation
 * - Clean separation of pages
 */
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import CreateSessionPage from './features/AI_Personalization/pages/CreateSessionPage';
import PersonalizeNowPage from './features/AI_Personalization/pages/PersonalizeNowPage';

function PersonaliseApp() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<CreateSessionPage />} />
                <Route path="/personalize-now" element={<PersonalizeNowPage />} />
            </Routes>
        </Router>
    );
}

export default PersonaliseApp;
