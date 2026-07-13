import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>概要説明</p>

      <section className="about-section">
        <h2>1. このアプリについて</h2>
        <p>
          本アプリは、オープンキャンパス来場者にMediaPipe Face Mesh / Face
          Landmarkerによる顔ランドマーク検出技術を体験してもらうことを目的とした
          ブラウザアプリです。Webカメラ映像から顔ランドマークをリアルタイムに
          表示し、笑顔時の顔ランドマークおよび画像特徴量からSmile
          Score（100点満点）を算出します。
        </p>
      </section>

      <section className="about-section">
        <h2>2. MediaPipe Face Mesh / Face Landmarkerとは</h2>
        <p>
          Googleが提供する顔ランドマーク検出技術で、顔の画像・映像から目・鼻・口・
          輪郭などの特徴点をリアルタイムに検出できます。本アプリはそのWeb版である
          MediaPipe Tasks Vision Face Landmarkerを使用しています。
        </p>
      </section>

      <section className="about-section">
        <h2>3. Smile Scoreの考え方</h2>
        <p>
          あらかじめ撮影した基準顔（無表情時）と笑顔時の顔ランドマークを比較し、
          口角の動き・頬や目元の変化・左右のバランス・表情の安定性・歯の見え方から
          点数化しています。基準顔との差分を用いることで、もともとの顔立ちの
          個人差による影響をできるだけ小さくしています。
        </p>
      </section>

      <section className="about-section">
        <h2>4. Smile Scoreの6項目</h2>
        <ul className="about-list">
          <li>口角挙上：25点</li>
          <li>口幅の拡大：20点</li>
          <li>頬・目周囲の変化：25点</li>
          <li>左右対称性：15点</li>
          <li>笑顔の安定性：10点</li>
          <li>上歯の適度な露出：5点</li>
        </ul>
      </section>

      <section className="about-section">
        <h2>5. 参考にした研究・資料</h2>
        <ul className="about-list">
          <li>
            <a
              href="https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js"
              target="_blank"
              rel="noreferrer"
            >
              MediaPipe Face Landmarker Web documentation
            </a>
          </li>
          <li>
            <a
              href="https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md"
              target="_blank"
              rel="noreferrer"
            >
              MediaPipe Face Mesh documentation
            </a>
          </li>
          <li>
            <a
              href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4598946/"
              target="_blank"
              rel="noreferrer"
            >
              Girard JM, et al. Estimating smile intensity: A better way.
            </a>
          </li>
          <li>
            <a
              href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0179708"
              target="_blank"
              rel="noreferrer"
            >
              Helwig NE, et al. Dynamic properties of successful smiles.
            </a>
          </li>
          <li>
            <a
              href="https://github.com/TadasBaltrusaitis/OpenFace"
              target="_blank"
              rel="noreferrer"
            >
              OpenFace
            </a>
          </li>
        </ul>
      </section>

      <section className="about-section about-notice">
        <h2>6. 注意事項</h2>
        <p>
          本アプリのSmile Scoreは、MediaPipe Face Mesh /
          Face Landmarkerで取得した顔ランドマークと画像特徴量に基づく教育・体験用の参考スコアです。
          <br />
          心理状態、性格、魅力度、健康状態、表情筋機能を医学的・心理学的に診断するものではありません。
          <br />
          照明、顔の向き、カメラ距離、眼鏡、マスク、歯の見え方、個人の顔貌によって点数が変動することがあります。
          <br />
          ランキング用の顔写真と点数はイベント中のみ使用し、イベント終了後に削除します。
          <br />
          今回は展示用データとしてのみ扱い、研究解析用データとしては使用しません。
        </p>
      </section>

      <p className="back-link">
        <Link to="/">ホームへ戻る</Link>
      </p>
    </div>
  );
}
