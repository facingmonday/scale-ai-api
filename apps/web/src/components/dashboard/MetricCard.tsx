import "primeicons/primeicons.css";
import React from "react";

interface MetricCardProps {
  icon: string;
  iconColor: string;
  label: string;
  value: string | number | null;
  className?: string;
  description?: string;
  size?: "small" | "default";
  progressBar?: {
    segments: { value: number | null; total: number | null; color: string }[];
  };
  footer?: React.ReactNode;
}

// Map icon color strings to CSS classes or values
const getIconColorClass = (iconColor: string): string => {
  // Handle text-* classes
  if (iconColor.startsWith("text-")) {
    return iconColor;
  }
  // Handle bg-* classes (convert to text-)
  if (iconColor.startsWith("bg-")) {
    return iconColor.replace("bg-", "text-");
  }
  // Default to brand color
  return "text-brand-blue";
};

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  iconColor,
  label,
  value,
  progressBar,
  footer,
  className = "",
  size = "default",
}) => {
  const iconColorClass = getIconColorClass(iconColor);
  const sizeClass = size === "small" ? "metric-card-small" : "";

  const renderProgressBar = () => {
    if (!progressBar) return null;

    // Calculate total from all segments
    const total = progressBar.segments.reduce((sum, segment) => {
      const segmentValue = segment.value ?? 0;
      return sum + segmentValue;
    }, 0);

    if (total === 0) return null;

    return (
      <div className="metric-card-progress bg-ui-muted">
        {progressBar.segments.map((segment, index) => {
          const segmentValue = segment.value ?? 0;
          const percentage = total > 0 ? (segmentValue / total) * 100 : 0;

          // Map color strings to Tailwind classes
          let segmentColorClass = "bg-brand-teal";
          if (segment.color.includes("green")) {
            segmentColorClass = "bg-green-500";
          } else if (segment.color.includes("red")) {
            segmentColorClass = "bg-red-500";
          } else if (segment.color.includes("blue")) {
            segmentColorClass = "bg-blue-500";
          }

          return (
            <div
              key={index}
              className={`metric-card-progress-segment ${segmentColorClass}`}
              style={{ width: `${percentage}%` }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={`metric-card ${sizeClass} ${className}`}>
      <div className="metric-card-header">
        <div className={`metric-card-icon ${iconColorClass}`}>
          <i
            className={`pi ${icon} ${
              size === "small" ? "text-sm" : "text-base"
            }`}
          />
        </div>
        <div className="metric-card-label">{label}</div>
      </div>
      <div className="metric-card-value">{value}</div>
      {progressBar && renderProgressBar()}
      {footer && <div className="metric-card-footer">{footer}</div>}
    </div>
  );
};

export default MetricCard;
