import React from "react";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";

interface ImageGenerationFormProps {
  newPrompt: string;
  setNewPrompt: (prompt: string) => void;
  promptStyle: string;
  setPromptStyle: (style: string) => void;
  size: string;
  setSize: (size: string) => void;
  quality: string;
  setQuality: (quality: string) => void;
}

const ART_STYLES: string[] = [
  "Photorealistic",
  "Digital Art",
  "Oil Painting",
  "Watercolor",
  "Pencil Sketch",
  "Pop Art",
  "Anime",
  "3D Rendering",
  "Abstract",
  "Minimalist",
  "Manga",
  "Icon",
  "Cartoon",
  "Realistic",
  "Painted",
];

const SIZE_OPTIONS: { key: string; label: string }[] = [
  { key: "Square", label: "Square (1024x1024)" },
  { key: "Portrait", label: "Portrait (1024x1536)" },
  { key: "Landscape", label: "Landscape (1536x1024)" },
];

const RadioRow: React.FC<{
  selected: boolean;
  label: string;
  value: string;
  name: string;
  onChange: () => void;
}> = ({ selected, label, value, name, onChange }) => {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onChange}
        className="flex-shrink-0"
      />
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
};

const GenerateImageForm: React.FC<ImageGenerationFormProps> = ({
  newPrompt,
  setNewPrompt,
  promptStyle,
  setPromptStyle,
  size,
  setSize,
  quality,
  setQuality,
}) => {
  const artStyleOptions = ART_STYLES.map((style) => ({
    label: style,
    value: style,
  }));

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="w-full">
        <label className="label" htmlFor="image-prompt">
          Prompt
        </label>
        <InputTextarea
          id="image-prompt"
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          className="w-full mt-1"
          placeholder="Describe the image you want..."
          rows={5}
          autoResize
        />
      </div>

      <div className="w-full">
        <label className="label" htmlFor="art-style">
          Art Style
        </label>
        <Dropdown
          id="art-style"
          value={promptStyle}
          options={artStyleOptions}
          onChange={(e) => setPromptStyle(e.value)}
          className="w-full mt-1"
          placeholder="Select an art style"
        />
      </div>
      <div className="w-full">
        <label className="label" htmlFor="image-quality">
          Image Quality
        </label>
        <Dropdown
          id="image-quality"
          value={quality}
          options={[
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
          ]}
          onChange={(e) => {
            setQuality(e.value);
          }}
          className="w-full mt-1"
          placeholder="Select an image quality"
        />
      </div>

      <div className="w-full">
        <p className="text-sm text-text-secondary mb-2">Select Image Size</p>
        <div className="flex flex-col gap-3">
          {SIZE_OPTIONS.map((opt) => (
            <RadioRow
              key={opt.key}
              selected={size === opt.key}
              label={opt.label}
              value={opt.key}
              name="image-size"
              onChange={() => setSize(opt.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GenerateImageForm;
