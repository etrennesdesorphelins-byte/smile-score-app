import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ScoreBreakdown from "../components/ScoreBreakdown";
import { dataUrlToBlob, renderLandmarkOverlayImage } from "../lib/imageUtils";
import { addRankingEntry, type RankingEntry } from "../lib/indexedDb";
import type { ResultLocationState } from "../types/app";

type ConsentStatus = "pending" | "registered" | "declined";

function createRankingId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultLocationState | null;

  const [landmarkImageUrl, setLandmarkImageUrl] = useState<string | null>(
    null
  );
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>("pending");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    renderLandmarkOverlayImage(
      state.imageDataUrl,
      state.scoreResult.representativeLandmarks
    )
      .then((url) => {
        if (!cancelled) setLandmarkImageUrl(url);
      })
      .catch(() => {
        // Non-critical: the plain photo is still shown either way.
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (!state) {
    return (
      <div className="app-shell">
        <h1>Smile Score Demo</h1>
        <p>採点結果が見つかりませんでした。もう一度採点してください。</p>
        <p className="back-link">
          <Link to="/smile-capture">笑顔採点へ戻る</Link>
        </p>
      </div>
    );
  }

  async function handleRegister() {
    if (!state) return;
    setIsRegistering(true);
    setRegisterError(null);
    try {
      const imageBlob = await dataUrlToBlob(state.imageDataUrl);
      const entry: RankingEntry = {
        id: createRankingId(),
        createdAt: new Date().toISOString(),
        totalScore: state.scoreResult.total,
        scores: {
          mouthCorner: state.scoreResult.mouthCorner,
          mouthWidth: state.scoreResult.mouthWidth,
          cheekEye: state.scoreResult.cheekEye,
          symmetry: state.scoreResult.symmetry,
          stability: state.scoreResult.stability,
          teeth: state.scoreResult.teeth,
        },
        imageBlob,
      };
      await addRankingEntry(entry);
      setConsentStatus("registered");
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "ランキング登録に失敗しました"
      );
    } finally {
      setIsRegistering(false);
    }
  }

  function handleDecline() {
    setConsentStatus("declined");
  }

  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>採点結果</p>

      <ScoreBreakdown scores={state.scoreResult} />

      <div className="result-images">
        <div>
          <p>元画像</p>
          <img
            src={state.imageDataUrl}
            alt="元画像"
            className="capture-review-image"
          />
        </div>
        <div>
          <p>ランドマーク付き画像</p>
          <img
            src={landmarkImageUrl ?? state.imageDataUrl}
            alt="ランドマーク付き画像"
            className="capture-review-image"
          />
        </div>
      </div>
      <p className="result-caption">
        顔メッシュ・輪郭・目・口のランドマークの動きから、口角挙上・口幅拡大・頬目周囲・左右対称性の各項目を算出しています。
      </p>

      <div className="advice-box">
        {state.adviceMessages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>

      {consentStatus === "pending" && (
        <div className="consent-box">
          <p>ランキングに登録しますか？</p>
          <p>顔写真と点数をランキング画面に表示することに同意します。</p>
          <p className="consent-note">
            ランキング用の顔写真と点数はイベント中のみ使用し、イベント終了後に削除します。
            <br />
            ランキングへの登録は任意です。登録しなくても採点結果は確認できます。
          </p>
          <div className="capture-controls">
            <button
              type="button"
              onClick={handleRegister}
              disabled={isRegistering}
            >
              登録する
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isRegistering}
            >
              登録しない
            </button>
          </div>
          {registerError && (
            <p className="recording-error">{registerError}</p>
          )}
        </div>
      )}
      {consentStatus === "registered" && (
        <p className="capture-success">ランキングに登録しました。</p>
      )}
      {consentStatus === "declined" && (
        <p className="capture-success">登録しませんでした。</p>
      )}

      <div className="capture-controls">
        <button type="button" onClick={() => navigate("/smile-capture")}>
          もう一度採点する
        </button>
      </div>
      {consentStatus !== "pending" && (
        <p className="back-link">
          <Link to="/ranking">ランキングを見る</Link>
        </p>
      )}
      <p className="back-link">
        <Link to="/">ホームへ戻る</Link>
      </p>
    </div>
  );
}
