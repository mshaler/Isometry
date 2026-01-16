import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { FilterProvider } from './contexts/FilterContext';
import { PAFVProvider } from './contexts/PAFVContext';
import { AppLayout } from './components/AppLayout';
import { initDatabase } from './db/init';

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch(err => setDbError(err));
  }, []);

  if (dbError) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50">
        <div className="text-red-600">
          <h1 className="text-xl font-bold">Database Error</h1>
          <p>{dbError.message}</p>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading database...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppStateProvider>
          <FilterProvider>
            <PAFVProvider>
              <AppLayout />
            </PAFVProvider>
          </FilterProvider>
        </AppStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
