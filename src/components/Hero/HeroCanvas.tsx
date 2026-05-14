"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import { publicAssets } from "@/lib/public-assets";

export type HeroSequenceConfig = {
  frameDirectory: string;
  framePrefix: string;
  frameCount: number;
  startIndex: number;
  extension: "avif" | "jpeg" | "jpg" | "png" | "webp";
  padLength: number;
  fallbackImagePath: string;
  ariaLabel: string;
};

// PLACEHOLDERS: adjust these values if your exported frame sequence changes.
const HERO_SEQUENCE_CONFIG: HeroSequenceConfig = {
  frameDirectory: "/assets/frames",
  framePrefix: "frame_",
  frameCount: 120,
  startIndex: 1,
  extension: "webp",
  padLength: 4,
  fallbackImagePath: "/images/hero-hotel.jpg",
  ariaLabel:
    "Scroll-driven hero sequence revealing the arrival and hospitality experience.",
};


type HeroCanvasProps = {
  className?: string;
  scrollYProgress: MotionValue<number>;
  sequenceConfig?: Partial<HeroSequenceConfig>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getFramePath = (config: HeroSequenceConfig, frameNumber: number) => {
  const paddedFrame = String(frameNumber).padStart(config.padLength, "0");
  return `${config.frameDirectory}/${config.framePrefix}${paddedFrame}.${config.extension}`;
};

const getNearestLoadedFrame = (
  frames: Map<number, HTMLImageElement>,
  targetFrame: number,
  maxOffset = 8,
) => {
  if (frames.has(targetFrame)) {
    return frames.get(targetFrame) ?? null;
  }

  for (let offset = 1; offset <= maxOffset; offset += 1) {
    const before = frames.get(targetFrame - offset);
    if (before) {
      return before;
    }

    const after = frames.get(targetFrame + offset);
    if (after) {
      return after;
    }
  }

  return null;
};

export default function HeroCanvas({
  className,
  scrollYProgress,
  sequenceConfig,
}: HeroCanvasProps) {
  const reduceMotion = useReducedMotion();
  const config = useMemo(
    () => ({ ...HERO_SEQUENCE_CONFIG, ...sequenceConfig }),
    [sequenceConfig],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef(new Map<number, HTMLImageElement>());
  const loadingFramesRef = useRef(new Set<number>());
  const fallbackImageRef = useRef<HTMLImageElement | null>(null);
  const activeImageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const idleHandleRef = useRef<number | null>(null);
  const renderedFrameRef = useRef(config.startIndex);
  const targetFrameRef = useRef(config.startIndex);
  const [framesReady, setFramesReady] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setSettings(data);
        }
      })
      .catch(() => {});
  }, []);

  const hotelName = settings.hotel_name || "D&M Travellers Inn";


  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return null;
    }

    const dpr =
      typeof window === "undefined"
        ? 1
        : clamp(window.devicePixelRatio || 1, 1, 2);
    const nextWidth = Math.max(1, Math.floor(container.clientWidth * dpr));
    const nextHeight = Math.max(1, Math.floor(container.clientHeight * dpr));

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    }

    const context = canvas.getContext("2d");

    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    }

    return context;
  }, []);

  const drawImageToCanvas = useCallback(
    (image: HTMLImageElement | null) => {
      const canvas = canvasRef.current;
      const context = syncCanvasSize();

      if (!canvas || !context || !image) {
        return;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const scale = Math.max(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight,
      );
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const offsetX = (canvas.width - drawWidth) / 2;
      const offsetY = (canvas.height - drawHeight) / 2;

      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      activeImageRef.current = image;
    },
    [syncCanvasSize],
  );

  const drawFrame = useCallback(
    (frameIndex: number) => {
      const roundedFrame = Math.round(frameIndex);
      const loadedFrame =
        getNearestLoadedFrame(framesRef.current, roundedFrame) ??
        fallbackImageRef.current;

      drawImageToCanvas(loadedFrame);
    },
    [drawImageToCanvas],
  );

  const preloadFrame = useCallback(
    (frameIndex: number) => {
      const lastFrame = config.startIndex + config.frameCount - 1;

      if (
        frameIndex < config.startIndex ||
        frameIndex > lastFrame ||
        framesRef.current.has(frameIndex) ||
        loadingFramesRef.current.has(frameIndex)
      ) {
        return;
      }

      loadingFramesRef.current.add(frameIndex);

      const frame = new window.Image();
      frame.decoding = "async";
      frame.src = getFramePath(config, frameIndex);

      frame.onload = () => {
        loadingFramesRef.current.delete(frameIndex);
        framesRef.current.set(frameIndex, frame);

        if (!framesReady) {
          setFramesReady(true);
        }

        if (Math.round(renderedFrameRef.current) === frameIndex) {
          drawFrame(frameIndex);
        }
      };

      frame.onerror = () => {
        loadingFramesRef.current.delete(frameIndex);
      };
    },
    [config, drawFrame, framesReady],
  );

  const preloadNearbyFrames = useCallback(
    (frameIndex: number, radius = 10) => {
      for (let offset = 0; offset <= radius; offset += 1) {
        preloadFrame(frameIndex + offset);

        if (offset > 0) {
          preloadFrame(frameIndex - offset);
        }
      }
    },
    [preloadFrame],
  );

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth <= 1024) {
      return undefined;
    }

    const fallbackImage = new window.Image();
    fallbackImage.decoding = "async";
    fallbackImage.src = publicAssets.heroHotel.src;
    fallbackImage.onload = () => {
      fallbackImageRef.current = fallbackImage;

      if (!framesReady) {
        drawImageToCanvas(fallbackImage);
      }
    };

    preloadNearbyFrames(config.startIndex, 16);

    const idleWindow = window as Window & {
      cancelIdleCallback?: (handle: number) => void;
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    };

    const preloadRemainingFrames = () => {
      const lastFrame = config.startIndex + config.frameCount - 1;

      for (
        let frameIndex = config.startIndex;
        frameIndex <= lastFrame;
        frameIndex += 1
      ) {
        preloadFrame(frameIndex);
      }
    };

    if (idleWindow.requestIdleCallback) {
      idleHandleRef.current = idleWindow.requestIdleCallback(() => {
        preloadRemainingFrames();
      });
    } else {
      idleHandleRef.current = window.setTimeout(preloadRemainingFrames, 180);
    }

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      if (idleHandleRef.current !== null) {
        if (idleWindow.cancelIdleCallback) {
          idleWindow.cancelIdleCallback(idleHandleRef.current);
        } else {
          window.clearTimeout(idleHandleRef.current);
        }
      }
    };
  }, [
    config.fallbackImagePath,
    config.frameCount,
    config.startIndex,
    framesReady,
    preloadFrame,
    preloadNearbyFrames,
    drawImageToCanvas,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth <= 1024) {
      return undefined;
    }

    const unsubscribe = scrollYProgress.on("change", (latestValue) => {
      const frameSpan = config.frameCount - 1;
      const nextFrame =
        config.startIndex + clamp(latestValue, 0, 1) * frameSpan;

      targetFrameRef.current = nextFrame;
      renderedFrameRef.current = nextFrame;
      preloadNearbyFrames(Math.round(nextFrame), 12);

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = window.requestAnimationFrame(() => {
        drawFrame(nextFrame);
      });
    });

    drawFrame(config.startIndex);

    return () => {
      unsubscribe();
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    config.frameCount,
    config.startIndex,
    drawFrame,
    preloadNearbyFrames,
    scrollYProgress,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth <= 1024) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const redrawActiveImage = () => {
      syncCanvasSize();
      drawImageToCanvas(activeImageRef.current ?? fallbackImageRef.current);
    };

    redrawActiveImage();

    const resizeObserver = new ResizeObserver(() => {
      redrawActiveImage();
    });

    resizeObserver.observe(container);
    window.addEventListener("orientationchange", redrawActiveImage);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("orientationchange", redrawActiveImage);
    };
  }, [drawImageToCanvas, syncCanvasSize]);

  return (
    <div ref={containerRef} className={cn("absolute inset-0 bg-secondary overflow-hidden", className)}>
      <Image
        priority
        fetchPriority="high"
        src={publicAssets.heroHotel}
        alt={`${hotelName} - Boutique hotel arrival`}
        fill
        sizes="100vw"
        className={cn(
          "object-cover transition-opacity duration-700",
          framesReady ? "opacity-0" : "opacity-100",
        )}
      />

      <canvas
        ref={canvasRef}
        aria-label={`${config.ariaLabel.replace("revealing the", `revealing the ${hotelName}`)}`}
        className="absolute inset-0 h-full w-full hidden lg:block"
        role="img"
      />
    </div>
  );
}
