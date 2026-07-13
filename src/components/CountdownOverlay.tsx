import { useEffect, useRef, useState } from "react";

type CountdownOverlayProps = {
  seconds: number;
  onComplete: () => void;
};

// A fresh countdown run must be started by mounting a new instance (e.g. via
// a changing `key` prop on the caller side) rather than by changing
// `seconds` on an existing instance.
export default function CountdownOverlay({
  seconds,
  onComplete,
}: CountdownOverlayProps) {
  const [remaining, setRemaining] = useState(seconds);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (remaining <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  if (remaining <= 0) return null;

  return (
    <div className="countdown-overlay">
      <span className="countdown-number">{remaining}</span>
    </div>
  );
}
