# Smile Score ブラウザアプリ 技術提案書

作成日：2026-07-13  
対象：オープンキャンパス展示用・学生卒業研究用プロトタイプ  
開発想定：VS Code + Claude Code 実装、Codex review & 修正

---

## 1. 技術提案の概要

本提案では、MediaPipe Face Landmarkerを用いたブラウザアプリとして、以下を実装する。

1. Webカメラ映像のリアルタイム表示
2. 顔ランドマークのリアルタイム描画
3. 動画録画とランドマークCSV出力
4. 基準顔取得を用いたSmile Score算出
5. 採点結果・項目別点数・アドバイス表示
6. 同意制ランキング機能
7. 根拠情報を示す概要説明ページ

ブラウザアプリとして実装することで、Python環境構築の負担を減らし、VS Code上のローカル開発サーバーで展示PCから起動できる構成とする。

---

## 2. 推奨技術スタック

## 2.1 フロントエンド

| 項目 | 推奨 |
|---|---|
| 言語 | TypeScript |
| フレームワーク | Vite + React |
| 顔ランドマーク | MediaPipe Tasks Vision Face Landmarker |
| 描画 | HTML Canvas |
| 動画録画 | MediaRecorder API |
| CSV生成 | JavaScript / TypeScriptで生成しBlobとしてダウンロード |
| 画像保存 | CanvasからBlob生成 |
| ランキング保存 | IndexedDB |
| UI | CSS Modules または通常CSS |

## 2.2 推奨理由

### Vite + React

- 起動が速い
- 学生が画面単位で実装しやすい
- Claude Codeでコンポーネント単位の修正がしやすい
- 静的ファイルとしてビルド可能

### TypeScript

- ランドマーク配列、採点結果、ランキングデータの型を定義しやすい
- Codexレビュー時にバグを見つけやすい
- 将来的な拡張に強い

### MediaPipe Tasks Vision Face Landmarker

MediaPipe Face Landmarkerは、画像および動画から顔ランドマークや表情関連情報を検出できるWeb向けタスクとして提供されている。Webカメラ映像に対してリアルタイム処理を行う用途に適している。

---

## 3. プロジェクト構成案

```text
smile-score-app/
  package.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    styles/
      global.css
    pages/
      HomePage.tsx
      LandmarkPage.tsx
      SmileCapturePage.tsx
      ResultPage.tsx
      RankingPage.tsx
      AboutPage.tsx
      AdminPage.tsx
    components/
      CameraView.tsx
      FaceGuideOverlay.tsx
      LandmarkCanvas.tsx
      CountdownOverlay.tsx
      ScoreBreakdown.tsx
      AdviceBox.tsx
      RankingCard.tsx
      ConsentDialog.tsx
    lib/
      mediapipe.ts
      scoring.ts
      landmarks.ts
      recording.ts
      csv.ts
      indexedDb.ts
      imageUtils.ts
      advice.ts
      constants.ts
    types/
      app.ts
```

---

## 4. 主要モジュール設計

## 4.1 mediapipe.ts

### 役割

- Face Landmarkerの初期化
- Webカメラ映像からランドマーク推定
- フレームごとの検出結果を返す

### 主な関数案

```ts
initializeFaceLandmarker(): Promise<FaceLandmarker>
detectFace(video: HTMLVideoElement, timestampMs: number): FaceDetectionResult
```

### 設定案

```ts
{
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true
}
```

### 補足

Smile Scoreは基本的にランドマークベースで算出する。ただし、Face Landmarkerのblendshape情報が安定して取得できる場合は、将来的に参考値として利用できる。

---

## 4.2 landmarks.ts

### 役割

- MediaPipeのランドマーク番号を意味のある部位名に対応させる
- 顔幅、顔高、口幅、目の高さなどの幾何指標を計算する

### 主な型

```ts
type Point3D = {
  x: number
  y: number
  z: number
}
```

### 主な関数案

```ts
getMouthCornerPoints(landmarks: Point3D[]): { left: Point3D; right: Point3D }
getEyeMetrics(landmarks: Point3D[]): EyeMetrics
getFaceBoxMetrics(landmarks: Point3D[]): FaceBoxMetrics
calculateDistance(a: Point3D, b: Point3D): number
```

### 注意

MediaPipeのランドマーク番号は実装時に確認し、口角、上下口唇、目周囲、頬に対応する番号を定数化する。

---

## 4.3 scoring.ts

### 役割

- 基準顔2秒分のランドマーク特徴量を集約する
- 笑顔2秒分のランドマーク特徴量を集約する
- Smile Score 100点満点を算出する

### 入力

```ts
type CaptureFrame = {
  timestampMs: number
  landmarks: Point3D[]
  imageData?: ImageData
  faceOk: boolean
}
```

### 出力

```ts
type SmileScoreResult = {
  total: number
  mouthCorner: number
  mouthWidth: number
  cheekEye: number
  symmetry: number
  stability: number
  teeth: number
  advice: string[]
  representativeFrameIndex: number
}
```

---

## 5. Smile Score算出アルゴリズム案

## 5.1 前処理

### 基準顔特徴量

基準顔2秒間の有効フレームから中央値または平均値を計算する。

使用候補：

- 顔幅
- 顔高
- 左右口角座標
- 口角間距離
- 目の縦幅
- 頬・下眼瞼付近の座標
- 左右差

平均値は外れ値の影響を受けるため、初期実装では **中央値** を推奨する。

### 笑顔特徴量

笑顔2秒間の有効フレームから以下を計算する。

- 各フレームの暫定総合点
- 最も総合点が高い代表フレーム
- 2秒間の変動係数または標準偏差
- 顔検出成功率

---

## 5.2 口角挙上スコア：25点

### 指標

```text
口角挙上量 = 基準顔の左右口角平均y - 笑顔時の左右口角平均y
正規化口角挙上量 = 口角挙上量 / 顔高
```

画像座標ではyが小さいほど上方向であるため、基準顔yから笑顔yを引く。

### 点数化例

```ts
mouthCornerScore = clamp(normalizedLift / targetLift, 0, 1) * 25
```

`targetLift` は予備テストで調整する。

---

## 5.3 口幅拡大スコア：20点

### 指標

```text
口幅拡大率 = 笑顔時口角距離 / 基準顔口角距離
```

### 点数化例

```ts
mouthWidthScore = clamp((ratio - 1.0) / targetExpansion, 0, 1) * 20
```

`targetExpansion` は、例えば0.15〜0.30程度の範囲で予備テストする。

---

## 5.4 頬・目周囲スコア：25点

### 指標候補

1. 眼裂縦幅の変化
2. 下眼瞼・頬周囲ランドマークの上方移動
3. 口角挙上と目周囲変化の同時性

### 点数化例

```text
cheekEyeIndex = cheekLiftIndex * 0.6 + eyeNarrowingIndex * 0.4
cheekEyeScore = clamp(cheekEyeIndex, 0, 1) * 25
```

### 注意

目の大きさ、眼鏡、前髪、照明の影響を受けるため、過度に厳密な評価は避ける。

---

## 5.5 左右対称性スコア：15点

### 指標

```text
左右口角挙上差
左右口角移動量差
左右目周囲変化差
```

### 点数化例

```ts
symmetryScore = (1 - clamp(asymmetryIndex / maxAllowedAsymmetry, 0, 1)) * 15
```

### 注意

基準顔との差分を用い、元々の顔の非対称性の影響を軽減する。

---

## 5.6 安定性スコア：10点

### 指標

- 笑顔2秒間の暫定総合点の標準偏差
- 顔検出成功率
- 顔枠内維持率

### 点数化例

```text
stabilityScore = scoreVariationComponent + detectionComponent + faceGuideComponent
```

配点例：

| 内訳 | 点数 |
|---|---:|
| スコア変動の少なさ | 4点 |
| 顔検出成功率 | 3点 |
| 顔枠内維持率 | 3点 |

---

## 5.7 上歯露出スコア：5点

### 指標

1. 口唇内側領域をランドマークからポリゴンとして切り出す
2. 口腔内領域の上半分を対象にする
3. 白色〜明色画素の割合を計算する
4. 適度な範囲を最高点とする

### 実装例

```text
teethRatio = brightPixelsInUpperMouth / upperMouthArea
```

点数化例：

```text
teethRatioが小さすぎる：0〜1点
適度：5点
大きすぎる：2〜3点
```

### 注意

歯の露出判定は誤検出が出やすいため、採点結果では「補助指標」として説明する。

---

## 6. 顔枠ガイド判定

## 6.1 判定に使う情報

- 顔ランドマークの最小・最大x/y
- 顔中心座標
- 顔幅・顔高
- 左右目・鼻・口の位置関係
- Face Landmarkerの顔変換行列またはランドマークから推定した顔向き

## 6.2 判定結果の型

```ts
type FaceGuideStatus = {
  ok: boolean
  messages: string[]
  faceCentered: boolean
  faceSizeOk: boolean
  headPoseOk: boolean
  landmarksOk: boolean
}
```

## 6.3 UI

- OK：緑枠、「その位置でOKです」
- 注意：黄色枠、「もう少し正面を向いてください」
- NG：赤枠、「顔を枠の中に入れてください」

---

## 7. 録画・CSV出力設計

## 7.1 動画録画

### 技術

- MediaRecorder APIを使用
- WebM形式で保存
- Canvasにランドマーク描画済み映像を出力し、そのCanvas streamを録画対象にする

### 出力

```text
face_landmark_YYYYMMDD_HHMMSS.webm
```

## 7.2 CSV出力

### 技術

- フレームごとの検出結果を配列に蓄積
- 停止時にCSV文字列へ変換
- Blobとしてダウンロードリンクを生成

### 出力

```text
face_landmark_YYYYMMDD_HHMMSS.csv
```

---

## 8. ランキング保存設計

## 8.1 保存方式

初期実装では **IndexedDB** を推奨する。

理由：

- 画像Blobを保存できる
- localStorageより容量に余裕がある
- ブラウザ内で完結できる
- サーバー不要で展示しやすい

## 8.2 ランキングデータ型

```ts
type RankingEntry = {
  id: string
  createdAt: string
  totalScore: number
  scores: {
    mouthCorner: number
    mouthWidth: number
    cheekEye: number
    symmetry: number
    stability: number
    teeth: number
  }
  imageBlob: Blob
}
```

## 8.3 操作

- `addRankingEntry(entry)`
- `getTopRanking(limit = 10)`
- `deleteRankingEntry(id)`
- `clearRanking()`

## 8.4 同意制

採点結果画面で明示的に「登録する」を押した場合のみ保存する。

---

## 9. 概要説明ページ実装

概要説明ページでは、アプリ内に以下を表示する。

### 記載項目

- MediaPipe Face Landmarkerの説明
- Smile Scoreの6項目
- 点数化の限界
- 歯の露出判定の限界
- ランキングデータはイベント終了後に削除すること
- 今回は展示用データであり研究解析用データではないこと
- 参考文献

---

## 10. 開発フェーズ

## Phase 0：環境構築

- Node.js導入
- VS Code準備
- Vite + React + TypeScriptプロジェクト作成
- Git初期化

### コマンド例

```bash
npm create vite@latest smile-score-app -- --template react-ts
cd smile-score-app
npm install
npm run dev
```

---

## Phase 1：カメラ・MediaPipe実装

### 目標

- Webカメラ起動
- Face Landmarker初期化
- 顔ランドマーク取得
- Canvas上にランドマーク描画

### 成果物

- `CameraView.tsx`
- `LandmarkCanvas.tsx`
- `mediapipe.ts`

---

## Phase 2：ランドマーク表示・録画・CSV出力

### 目標

- リアルタイム顔ランドマーク表示ページ
- 録画開始・停止
- WebMダウンロード
- CSVダウンロード

### 成果物

- `LandmarkPage.tsx`
- `recording.ts`
- `csv.ts`

---

## Phase 3：顔枠ガイド

### 目標

- 顔枠表示
- 顔位置・サイズ・向き判定
- 案内文表示

### 成果物

- `FaceGuideOverlay.tsx`
- `landmarks.ts`

---

## Phase 4：基準顔・笑顔撮影フロー

### 目標

- 基準顔2秒撮影
- 笑顔2秒撮影
- 3秒カウントダウン
- 撮影画像確認
- 撮り直し機能

### 成果物

- `SmileCapturePage.tsx`
- `CountdownOverlay.tsx`

---

## Phase 5：Smile Score算出

### 目標

- 6項目の点数化
- 総合点算出
- 代表フレーム選択
- アドバイス生成

### 成果物

- `scoring.ts`
- `advice.ts`
- `ScoreBreakdown.tsx`

---

## Phase 6：結果画面・ランキング

### 目標

- 結果画面表示
- 同意制ランキング登録
- ベスト10表示
- 個別削除
- 全削除

### 成果物

- `ResultPage.tsx`
- `RankingPage.tsx`
- `AdminPage.tsx`
- `indexedDb.ts`

---

## Phase 7：概要説明ページ・仕上げ

### 目標

- 根拠情報表示
- 注意事項表示
- UI調整
- 展示用の文言調整

### 成果物

- `AboutPage.tsx`
- `global.css`

---

## 11. Claude Codeへの実装依頼例

以下の順番でClaude Codeに依頼すると進めやすい。

### 依頼1：プロジェクト初期化

```text
Vite + React + TypeScriptでSmile Score Demoのブラウザアプリを作成してください。
画面はHomePage, LandmarkPage, SmileCapturePage, ResultPage, RankingPage, AboutPage, AdminPageに分けてください。
まずはルーティングと仮UIのみ作成してください。
```

### 依頼2：MediaPipe実装

```text
MediaPipe Tasks VisionのFace Landmarkerを使って、Webカメラ映像から顔ランドマークをリアルタイム検出し、Canvas上に描画する機能を実装してください。
numFacesは1、runningModeはVIDEOでお願いします。
```

### 依頼3：録画・CSV出力

```text
LandmarkPageに録画開始・停止機能を追加してください。
Canvasに描画された映像をMediaRecorder APIでwebm保存し、同時に各フレームの顔ランドマーク座標をCSVとしてダウンロードできるようにしてください。
```

### 依頼4：採点フロー

```text
SmileCapturePageに、顔枠ガイド、基準顔2秒撮影、笑顔2秒撮影、3秒カウントダウン、撮影画像確認、撮り直し機能を実装してください。
```

### 依頼5：Smile Score

```text
基準顔と笑顔時のランドマーク差分から、口角挙上25点、口幅拡大20点、頬・目周囲25点、左右対称性15点、安定性10点、上歯露出5点でSmile Scoreを算出するscoring.tsを実装してください。
各項目点と総合点を返すようにしてください。
```

### 依頼6：ランキング

```text
採点結果画面でランキング登録の同意確認を表示し、登録する場合のみ顔写真と総合点をIndexedDBに保存してください。
RankingPageではベスト10を表示し、個別削除と全削除を実装してください。
```

---

## 12. Codexレビュー依頼例

実装後、Codexには以下の観点でレビューさせる。

```text
このSmile Scoreブラウザアプリのコードをレビューしてください。
特に以下を確認してください。
1. MediaPipe Face Landmarkerの初期化とメモリ解放が適切か
2. requestAnimationFrameのループが多重起動しないか
3. カメラ停止処理が適切か
4. MediaRecorderの停止・Blob生成が安全か
5. IndexedDBの保存・削除処理にバグがないか
6. Smile Score算出でNaNやInfinityが出ないか
7. 顔検出失敗時にアプリが落ちないか
8. 個人情報・顔写真保存に関する同意導線が守られているか
9. TypeScriptの型安全性に問題がないか
10. 展示中に連続使用してもメモリリークしにくいか
```

---

## 13. テスト計画

## 13.1 単体テスト相当

| 対象 | 確認内容 |
|---|---|
| scoring.ts | 各項目が0点未満・満点超過にならない |
| advice.ts | 低得点項目に応じた文章が返る |
| csv.ts | CSVヘッダーと行数が正しい |
| indexedDb.ts | 登録、取得、削除、全削除ができる |

## 13.2 手動テスト

| テスト | 期待結果 |
|---|---|
| カメラ許可 | 映像が表示される |
| 顔検出 | ランドマークが表示される |
| 顔を枠外に移動 | 案内文が表示される |
| 基準顔撮影 | 2秒間撮影される |
| 笑顔撮影 | 2秒間撮影される |
| 撮り直し | 再撮影できる |
| 採点 | 総合点・項目別点が表示される |
| ランキング登録する | ベスト10に表示される |
| ランキング登録しない | 保存されない |
| 個別削除 | 指定データが削除される |
| 全削除 | 全ランキングが削除される |

---

## 14. 想定リスクと対応

| リスク | 対応 |
|---|---|
| ブラウザでカメラが起動しない | Chrome / Edge最新版を使用。HTTPSまたはlocalhostで起動する |
| Face Landmarkerモデルの読み込みに失敗 | モデルファイルをローカルに配置する構成も検討する |
| 処理が重い | 描画点数を減らす、解像度を下げる、推論間隔を調整する |
| 歯の露出判定が不安定 | 補助項目として扱い、配点を5点に留める |
| 顔写真保存への不安 | 同意制、登録しない選択、個別削除、全削除を明示する |
| 展示終了後にデータが残る | 管理画面に全削除ボタンを設け、終了時チェックリストを作る |

---

## 15. 展示当日の運用案

1. 展示開始前にブラウザを起動
2. カメラ動作確認
3. ランキングデータが空であることを確認
4. 来場者に「ランキング登録は任意」と説明
5. 採点後、登録する／しないを来場者が選択
6. 登録削除希望があれば個別削除
7. 展示終了後、管理画面から全削除
8. ブラウザのIndexedDB / キャッシュも必要に応じて削除

---

## 16. 参考情報

- MediaPipe Face Landmarker Web documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MediaPipe Face Mesh documentation: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
- Girard JM, et al. Estimating smile intensity: A better way. https://pmc.ncbi.nlm.nih.gov/articles/PMC4598946/
- Helwig NE, et al. Dynamic properties of successful smiles. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0179708
- OpenFace: https://github.com/TadasBaltrusaitis/OpenFace

---

## 17. 最終提案

初期版は、**Vite + React + TypeScript + MediaPipe Face Landmarker + IndexedDB** で実装することを推奨する。

理由は以下である。

- ブラウザだけで動作し、展示しやすい
- MediaPipeのWeb版と相性がよい
- 動画録画、CSV出力、画像保存がブラウザAPIで実現できる
- ランキング保存をローカルブラウザ内で完結できる
- Claude Codeで実装しやすく、Codexでレビューしやすい構成にできる

まずはPhase 1〜5までを優先し、Smile Score算出と結果表示まで完成させる。その後、ランキングと概要説明ページを追加する流れが最も安全である。
