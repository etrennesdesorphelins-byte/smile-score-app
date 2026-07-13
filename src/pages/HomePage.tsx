import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>顔ランドマークを使って笑顔の特徴を可視化・点数化する体験アプリです</p>
      <div className="home-menu">
        <Link to="/landmark" className="home-menu-button">
          顔ランドマークを見る
        </Link>
      </div>
    </div>
  );
}
