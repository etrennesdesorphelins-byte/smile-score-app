import { useRef } from "react";
import CameraView from "./components/CameraView";
import LandmarkCanvas from "./components/LandmarkCanvas";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>顔ランドマーク表示（Phase 1 動作確認）</p>
      <div className="camera-stage">
        <CameraView ref={videoRef} />
        <LandmarkCanvas videoRef={videoRef} />
      </div>
    </div>
  );
}

export default App;
