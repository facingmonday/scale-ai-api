import React from "react";

interface GeneratedImageDisplayProps {
  generatedImageUrl: string | null;
}

const GeneratedImageDisplay: React.FC<GeneratedImageDisplayProps> = ({
  generatedImageUrl,
}) => {
  if (!generatedImageUrl) {
    return (
      <div className="w-full h-full min-h-[400px] border-2 border-dashed border-ui-border flex justify-center items-center rounded-lg bg-ui-muted p-4">
        <p className="text-text-muted text-center">No image generated yet</p>
      </div>
    );
  }

  return (
    <img
      src={generatedImageUrl}
      alt="Generated"
      className="max-w-full max-h-full w-full h-full object-contain rounded-lg"
    />
  );
};

export default GeneratedImageDisplay;
