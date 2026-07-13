import { useState } from "react";
import { Link } from "react-router-dom";
import { clearRanking } from "../lib/indexedDb";

export default function AdminPage() {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClearAll() {
    setConfirming(false);
    try {
      await clearRanking();
      setStatus("done");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "削除に失敗しました"
      );
      setStatus("error");
    }
  }

  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>管理メニュー</p>

      <div className="capture-controls">
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)}>
            ランキングを全削除
          </button>
        ) : (
          <>
            <p className="recording-error">
              本当にランキングデータをすべて削除しますか？この操作は取り消せません。
            </p>
            <button type="button" onClick={handleClearAll}>
              削除する
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              キャンセル
            </button>
          </>
        )}
      </div>

      {status === "done" && (
        <p className="capture-success">ランキングをすべて削除しました。</p>
      )}
      {status === "error" && errorMessage && (
        <p className="recording-error">{errorMessage}</p>
      )}

      <p className="back-link">
        <Link to="/">ホームへ戻る</Link>
      </p>
    </div>
  );
}
