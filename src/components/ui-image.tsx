import Image, { type ImageProps } from "next/image";

type UiImageProps = Omit<ImageProps, "width" | "height"> & {
  width?: number;
  height?: number;
};

function isSmallLocalAsset(src: UiImageProps["src"], width: number, height: number, fill: boolean | undefined): src is string {
  if (fill) return false;
  if (typeof src !== "string") return false;
  if (!src.startsWith("/")) return false;
  return width * height <= 64_000;
}

export function UiImage({
  alt,
  src,
  width = 400,
  height = 400,
  sizes = "100vw",
  unoptimized = true,
  fill,
  priority,
  loading,
  className,
  style,
  ...rest
}: UiImageProps) {
  const eager = priority || loading === "eager";

  if (isSmallLocalAsset(src, width, height, fill)) {
    return (
      // Small local brand assets render faster as plain images than as unoptimized next/image wrappers.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        src={src}
        width={width}
        height={height}
        loading={eager ? "eager" : loading}
        fetchPriority={eager ? "high" : undefined}
        decoding={eager ? "sync" : "async"}
        className={className}
        style={{ display: "block", ...style }}
        {...rest}
      />
    );
  }

  return (
    <Image
      alt={alt}
      src={src}
      width={width}
      height={height}
      sizes={sizes}
      unoptimized={unoptimized}
      fill={fill}
      priority={priority}
      loading={loading}
      className={className}
      style={style}
      {...rest}
    />
  );
}
