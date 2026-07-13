import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearRanking,
  deleteRankingEntry,
  getTopRanking,
  type RankingEntry,
} from "../lib/indexedDb";

export default function RankingPage() {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );

  async function loadRanking() {
    setLoading(true);
    setError(null);
    try {
      const top = await getTopRanking(10);
      setEntries(top);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ランキングの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRanking();
  }, []);

  useEffect(() => {
    const urls = entries.map(
      (entry) => [entry.id, URL.createObjectURL(entry.imageBlob)] as const
    );
    setImageUrls(Object.fromEntries(urls));
    return () => {
      urls.forEach(([, url]) => URL.revokeObjectURL(url));
    };
  }, [entries]);

  async function handleDelete(id: string) {
    setConfirmingDeleteId(null);
    setError(null);
    try {
      await deleteRankingEntry(id);
      await loadRanking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  async function handleClearAll() {
    setConfirmingClearAll(false);
    setError(null);
    try {
      await clearRanking();
      await loadRanking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "全削除に失敗しました");
    }
  }

  return (
    <div className="app-shell">
      <h1>Smile Score Demo</h1>
      <p>得点ランキング（ベスト10）</p>
      <p className="consent-note">
        ランキング用の顔写真と点数はイベント中のみ使用し、イベント終了後に削除します。
      </p>

      {loading && <p className="landmark-status">読み込んでいます...</p>}
      {error && <p className="recording-error">{error}</p>}
      {!loading && entries.length === 0 && (
        <p className="landmark-status">まだ登録がありません。</p>
      )}

      <ol className="ranking-list">
        {entries.map((entry, index) => (
          <li key={entry.id} className="ranking-item">
            <span className="ranking-rank">{index + 1}位</span>
            {imageUrls[entry.id] && (
              <img
                src={imageUrls[entry.id]}
                alt={`${index + 1}位の笑顔`}
                className="ranking-image"
              />
            )}
            <span className="ranking-score">{entry.totalScore}点</span>
            <span className="ranking-date">
              {new Date(entry.createdAt).toLocaleString("ja-JP")}
            </span>
            {confirmingDeleteId === entry.id ? (
              <div className="ranking-delete-confirm">
                <span>削除しますか？</span>
                <button type="button" onClick={() => handleDelete(entry.id)}>
                  削除する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteId(null)}
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDeleteId(entry.id)}
              >
                削除
              </button>
            )}
          </li>
        ))}
      </ol>

      <div className="capture-controls">
        {!confirmingClearAll ? (
          <button type="button" onClick={() => setConfirmingClearAll(true)}>
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
            <button
              type="button"
              onClick={() => setConfirmingClearAll(false)}
            >
              キャンセル
            </button>
          </>
        )}
      </div>

      <p className="back-link">
        <Link to="/">ホームへ戻る</Link>
      </p>
    </div>
  );
}
