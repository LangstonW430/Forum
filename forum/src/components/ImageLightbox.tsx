import { useEffect } from "react";

interface Props {
  src: string;
  alt?: string;
  circle?: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt = "", circle = false, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <img
        src={src}
        alt={alt}
        className={`lightbox-image${circle ? " lightbox-image--circle" : ""}`}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
