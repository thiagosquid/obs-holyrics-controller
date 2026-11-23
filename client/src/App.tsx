import { Routes, Route } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import LyricsDock from './pages/LyricsDock';
import BibleDock from './pages/BibleDock';
import SlidesDock from './pages/SlidesDock';
import PresenterPage from './pages/PresenterPage';

function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/lyrics" element={<LyricsDock />} />
      <Route path="/bible" element={<BibleDock />} />
      <Route path="/slides" element={<SlidesDock />} />
      <Route path="/presenter" element={<PresenterPage />} />
      <Route path="*" element={<AdminPage />} />
    </Routes>
  );
}

export default App;
