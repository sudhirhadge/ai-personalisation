import { Provider } from 'react-redux';
import { store } from './store';

import { AuthProvider } from './components/context/AuthContext';

import './index.css';
import PersonaliseApp from './PersonaliseApp';

function App() {
    return (
        <Provider store={store}>
            <AuthProvider>
                <PersonaliseApp />
            </AuthProvider>
        </Provider>
    );
}

export default App;
