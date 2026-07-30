import type { Category } from "@mediapipe/tasks-vision";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  disposeFaceFigure,
  initFaceFigureScene,
  updateFaceFigure,
  type FaceFigureHandle,
} from "../lib/faceFigure";

export type FaceFigureStatus = "loading" | "ready" | "error";

export type FaceFigureViewHandle = {
  update: (
    categories: Category[] | undefined,
    matrixData: number[] | undefined
  ) => void;
};

type FaceFigureViewProps = {
  onStatusChange?: (status: FaceFigureStatus) => void;
};

const FaceFigureView = forwardRef<FaceFigureViewHandle, FaceFigureViewProps>(
  function FaceFigureView({ onStatusChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handleRef = useRef<FaceFigureHandle | null>(null);
    const onStatusChangeRef = useRef(onStatusChange);
    onStatusChangeRef.current = onStatusChange;

    useImperativeHandle(ref, () => ({
      update(categories, matrixData) {
        if (handleRef.current) {
          updateFaceFigure(handleRef.current, categories, matrixData);
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let cancelled = false;

      onStatusChangeRef.current?.("loading");
      initFaceFigureScene(canvas)
        .then((handle) => {
          if (cancelled) {
            disposeFaceFigure(handle);
            return;
          }
          handleRef.current = handle;
          onStatusChangeRef.current?.("ready");
        })
        .catch((err) => {
          console.error(err);
          if (!cancelled) onStatusChangeRef.current?.("error");
        });

      return () => {
        cancelled = true;
        if (handleRef.current) {
          disposeFaceFigure(handleRef.current);
          handleRef.current = null;
        }
      };
    }, []);

    return <canvas ref={canvasRef} className="figure-canvas" />;
  }
);

export default FaceFigureView;
