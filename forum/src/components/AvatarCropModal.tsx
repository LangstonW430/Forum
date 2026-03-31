import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface AvatarCropModalProps {
  imageSrc: string;
  onSave: (croppedAreaPixels: Area) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function AvatarCropModal({
  imageSrc,
  onSave,
  onCancel,
  saving,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  return (
    <div className="crop-modal-overlay" onClick={onCancel}>
      <div
        className="crop-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="crop-modal-title">Crop Profile Picture</h2>

        <div className="crop-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="crop-controls">
          <label className="crop-zoom-label">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="crop-zoom-slider"
          />
        </div>

        <div className="crop-actions">
          <button
            className="btn btn-outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!croppedAreaPixels || saving}
            onClick={() => croppedAreaPixels && onSave(croppedAreaPixels)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
