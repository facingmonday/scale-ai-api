import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import { filesService } from "../../../services";
import GeneratedImageDisplay from "./GeneratedImageDisplay";
import GenerateImageForm from "./GenerateImageForm";
import Alert from "../../Alert";
import LoadingOverlay from "../../LoadingOverlay";

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: (imageUrl: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  bucketPath?: string;
  context?: string;
}

const DEFAULT_TEXT = "";

const GenerateImageModal: React.FC<ImageModalProps> = ({
  open,
  onClose,
  onAccept,
  isLoading,
  setIsLoading,
  bucketPath = "scale/misc",
  context = "",
}) => {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [newPrompt, setNewPrompt] = React.useState<string | undefined>(
    DEFAULT_TEXT
  );
  const [promptStyle, setPromptStyle] = useState<string>("");
  const [size, setSize] = useState<string>("Square");
  const [quality, setQuality] = useState<string>("low");
  const [error, setError] = useState<string | null>(null);

  const generatePrompt = () => {
    const generationPrompt = `Using the following article context: "${context}", generate an image that matches the description: "${newPrompt}" in the style of "${promptStyle}"`;
    return generationPrompt;
  };

  const resetForm = () => {
    setGeneratedImageUrl(null);
    setNewPrompt(DEFAULT_TEXT);
    setPromptStyle("");
    setSize("Square");
    setError(null);
    setQuality("low");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getImageSize = (sizeKey: string) => {
    switch (sizeKey) {
      case "Portrait":
        return "1024x1536";
      case "Landscape":
        return "1536x1024";
      default:
        return "1024x1024";
    }
  };

  const handleGenerateClick = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!newPrompt || !promptStyle) {
        setError("Please fill in both the prompt and the art style.");
        setIsLoading(false);
        return;
      }

      const response = await filesService.generate({
        prompt: generatePrompt(),
        path: bucketPath,
        size: getImageSize(size),
        quality: quality as "low" | "medium" | "high",
      });

      // Handle axios response structure
      const responseData = response?.data;
      const imageUrl: string | undefined =
        (typeof responseData?.image === "string"
          ? responseData.image
          : undefined) ||
        (responseData?.data &&
        typeof responseData.data === "object" &&
        "image" in responseData.data &&
        typeof responseData.data.image === "string"
          ? (responseData.data.image as string)
          : undefined);

      if (!imageUrl) {
        throw new Error("No image URL returned from server");
      }
      setGeneratedImageUrl(imageUrl);
    } catch (err: unknown) {
      console.error("Error generating image:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate image. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <Dialog
      header="Generate an AI Image"
      visible={open}
      onHide={handleClose}
      modal
      closable={true}
      dismissableMask={true}
      className="modal w-full max-w-4xl overflow-hidden border-none"
      maskClassName="modal-mask"
      headerClassName="modal-header overflow-hidden"
      contentClassName="modal-content max-h-[calc(100vh-200px)] overflow-y-auto "
      pt={{
        headerTitle: { className: "modal-title text-brand-blue" },
        footer: { className: "modal-footer" },
      }}
      footer={
        <div className="flex gap-2 justify-end p-4">
          <button className="btn-outline" onClick={handleClose} type="button">
            Cancel
          </button>
          <button
            className={`btn-orange ${
              !newPrompt || !promptStyle ? "btn-disabled" : ""
            }`}
            onClick={() => void handleGenerateClick()}
            disabled={!newPrompt || !promptStyle}
            type="button"
          >
            Generate
          </button>
          <button
            className={`btn-teal ${!generatedImageUrl ? "btn-disabled" : ""}`}
            onClick={() => {
              if (generatedImageUrl) {
                onAccept(generatedImageUrl);
              }
            }}
            disabled={!generatedImageUrl}
            type="button"
          >
            Use Image
          </button>
        </div>
      }
    >
      <LoadingOverlay loading={isLoading} />
      <div className="flex flex-col gap-4">
        {error && (
          <Alert
            variant="error"
            title="Error"
            message={error}
            closable
            onClose={handleCloseError}
          />
        )}

        <div className="flex flex-row gap-6 items-start">
          {/* Image Preview - Left Side */}
          <div className="w-1/2 max-h-[500px] flex items-center justify-center rounded-lg overflow-hidden">
            <GeneratedImageDisplay generatedImageUrl={generatedImageUrl} />
          </div>

          {/* Form - Right Side */}
          <div className="flex flex-col w-1/2">
            <GenerateImageForm
              newPrompt={newPrompt || ""}
              setNewPrompt={(v: string) => setNewPrompt(v)}
              promptStyle={promptStyle}
              setPromptStyle={setPromptStyle}
              size={size}
              setSize={setSize}
              quality={quality}
              setQuality={setQuality}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default GenerateImageModal;
