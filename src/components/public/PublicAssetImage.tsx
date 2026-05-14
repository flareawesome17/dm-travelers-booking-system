"use client";

import Image, { type ImageProps, type StaticImageData } from "next/image";
import { useState } from "react";

type PublicAssetImageProps = Omit<ImageProps, "src"> & {
  src?: ImageProps["src"] | null;
  fallbackSrc: StaticImageData;
};

export function PublicAssetImage({
  src,
  fallbackSrc,
  onError,
  ...props
}: PublicAssetImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      {...props}
      src={failed || !src ? fallbackSrc : src}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

