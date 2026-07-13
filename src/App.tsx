import { HashRouter, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LandmarkPage from "./pages/LandmarkPage";
import SmileCapturePage from "./pages/SmileCapturePage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/landmark" element={<LandmarkPage />} />
        <Route path="/smile-capture" element={<SmileCapturePage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
