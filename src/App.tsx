import { HashRouter, Route, Routes } from "react-router-dom";
import AboutPage from "./pages/AboutPage";
import AdminPage from "./pages/AdminPage";
import HomePage from "./pages/HomePage";
import LandmarkPage from "./pages/LandmarkPage";
import RankingPage from "./pages/RankingPage";
import ResultPage from "./pages/ResultPage";
import SmileCapturePage from "./pages/SmileCapturePage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/landmark" element={<LandmarkPage />} />
        <Route path="/smile-capture" element={<SmileCapturePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
