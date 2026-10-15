import * as React from "react";

export interface ModernAiSparkleProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * Modern AI Sparkle Icon matching the Google Gemini / Apple Intelligence style:
 * - 4-pointed flared curved star in center
 * - Secondary micro-star in top-right
 * - Satellite accent dot in bottom-left
 */
export function ModernAiSparkle({
  className = "size-4",
  size,
  ...props
}: ModernAiSparkleProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Primary 4-pointed curved AI star */}
      <path d="M12 2C12 7.5228 7.5228 12 2 12C7.5228 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.5228 12 2Z" />

      {/* Top-Right Secondary Micro AI Star */}
      <path d="M18.5 1.5C18.5 3.1569 17.1569 4.5 15.5 4.5C17.1569 4.5 18.5 5.8431 18.5 7.5C18.5 5.8431 19.8431 4.5 21.5 4.5C19.8431 4.5 18.5 3.1569 18.5 1.5Z" />

      {/* Bottom-Left Satellite Accent Dot */}
      <circle cx="5.5" cy="18.5" r="1.8" />
    </svg>
  );
}

export default ModernAiSparkle;
