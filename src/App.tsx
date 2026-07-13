import { HashRouter, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LandmarkPage from "./pages/LandmarkPage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/landmark" element={<LandmarkPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
