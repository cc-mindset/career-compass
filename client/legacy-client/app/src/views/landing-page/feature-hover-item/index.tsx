import React, { useRef, useEffect } from "react";

interface FeatureHoverItemProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FeatureHoverItem: React.FC<FeatureHoverItemProps> = ({
  index,
  icon,
  title,
  description,
  isOpen,
  onToggle,
}) => {
  const featureRef = useRef<HTMLDivElement>(null);

  // Shift popup towards center on mobile for first (0) and third (2) icons
  const getMobilePosition = () => {
    if (index === 0) {
      // First icon: shift right (towards center) - increased shift
      return "sm:left-1/2 sm:-translate-x-1/2 left-[calc(50%+4rem)] -translate-x-1/2";
    } else if (index === 2) {
      // Third icon: shift left (towards center) - increased shift
      return "sm:left-1/2 sm:-translate-x-1/2 left-[calc(50%-4rem)] -translate-x-1/2";
    }
    return "left-1/2 -translate-x-1/2";
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        featureRef.current &&
        !featureRef.current.contains(event.target as Node)
      ) {
        if (isOpen) {
          onToggle();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={featureRef} className="group relative flex flex-col items-center">
      <button
        onClick={onToggle}
        className={`p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[1.75rem] bg-indigo-50 text-indigo-600 border border-indigo-100 transition-all duration-300 cursor-pointer shadow-lg shadow-indigo-600/5 touch-manipulation ${
          isOpen
            ? "scale-110 bg-indigo-100"
            : "hover:scale-110 hover:bg-indigo-100"
        }`}
        aria-expanded={isOpen}
        aria-label={`${title} - ${description}`}
      >
        {icon}
      </button>

      {/* Detail: shown on click (mobile) or hover (desktop) */}
      <div
        className={`absolute bottom-full mb-4 sm:mb-6 ${getMobilePosition()} w-64 p-4 sm:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xl shadow-indigo-500/10 z-50 transition-all duration-300 ${
          isOpen
            ? "opacity-100 visible transform translate-y-0 pointer-events-auto"
            : "opacity-0 invisible transform translate-y-2 pointer-events-none md:group-hover:opacity-100 md:group-hover:visible md:group-hover:translate-y-0 md:group-hover:pointer-events-auto"
        }`}
      >
        <h4 className="font-bold text-slate-900 mb-1.5 sm:mb-2 text-sm">
          {title}
        </h4>
        <p className="text-sm text-slate-500 font-normal leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

export default FeatureHoverItem;
