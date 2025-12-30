import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import RoundtablePage from '@/pages/RoundtablePage';
import ConclusionPage from '@/pages/ConclusionPage';
import NovelWorkshopPage from '@/pages/NovelWorkshopPage';
import FinalNovelPage from '@/pages/FinalNovelPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/roundtable" element={<RoundtablePage />} />
          <Route path="/conclusion" element={<ConclusionPage />} />
          <Route path="/novel-workshop" element={<NovelWorkshopPage />} />
          <Route path="/final-novel" element={<FinalNovelPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
