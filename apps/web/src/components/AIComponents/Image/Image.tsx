import React, { useState } from "react";
import GenerateImageModal from "./GenerateImageModal";

interface ImageProps {
  style?: React.CSSProperties;
  src?: string;
  alt?: string;
  onAccept?: (imageUrl: string) => void;
  bucketPath?: string;
  context?: string;
  disabled?: boolean;
}

const Image: React.FC<ImageProps> = ({
  src,
  alt,
  onAccept,
  context = "",
  disabled = false,
}) => {
  const [localSrc, setLocalSrc] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerateImageModalOpen, setIsGenerateImageModalOpen] =
    useState(false);

  const handleGenerateImage = (imageUrl: string) => {
    setLocalSrc(imageUrl);
    setIsGenerateImageModalOpen(false);
    onAccept?.(imageUrl);
  };

  const handleAIGenerateClick = () => {
    setIsGenerateImageModalOpen(true);
  };

  const handleClose = () => {
    setIsGenerateImageModalOpen(false);
  };

  const effectiveSrc = src ?? localSrc;

  return (
    <>
      <div className="w-full">
        {/* Image box */}
        <div
          className={`w-full h-full min-h-[220px] flex items-center justify-center relative rounded-lg border border-ui-border ${
            effectiveSrc
              ? "border-ui-border bg-ui-surface"
              : "border-ui-border bg-ui-muted"
          } overflow-hidden`}
        >
          {effectiveSrc ? (
            <img
              src={effectiveSrc}
              alt={alt || "Image preview"}
              className="w-full h-full object-contain"
            />
          ) : (
            <p className="text-text-muted text-center p-4 h-full flex items-center justify-center">
              No image created
            </p>
          )}
        </div>

        {/* Button Section */}
        <div className="w-full flex justify-end mt-2">
          <button
            onClick={handleAIGenerateClick}
            className="icon-button"
            type="button"
            aria-label="Generate an AI Image"
            disabled={disabled}
          >
            <i className="pi pi-microchip-ai text-lg text-brand-blue" />
          </button>
        </div>
      </div>
      {/* ImageModal for AI image generation */}
      <GenerateImageModal
        open={isGenerateImageModalOpen}
        onClose={handleClose}
        onAccept={handleGenerateImage}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        context={context}
        bucketPath={"scale/misc"}
      />
    </>
  );
};

export default Image;
