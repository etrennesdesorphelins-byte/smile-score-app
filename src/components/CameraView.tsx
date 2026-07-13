import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const CameraView = forwardRef<HTMLVideoElement>(function CameraView(_props, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "カメラを起動できませんでした"
        );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (error) {
    return (
      <div className="camera-error">
        カメラを利用できません。ブラウザのカメラ許可設定を確認してください。
        <br />
        ({error})
      </div>
    );
  }

  return <video ref={videoRef} className="camera-video" playsInline muted />;
});

export default CameraView;
