import React, { useState, useEffect, useRef } from "react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  width?: string;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  width,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen && headRef.current) {
      const headRect = headRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(options.length * 40, 240);
      const spaceAbove = headRect.top;
      const spaceBelow = window.innerHeight - headRect.bottom;
      const shouldOpenUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      setOpenUp(shouldOpenUp);
    }
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("click", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className={`select-wrapper ${isOpen ? "select-open" : ""} ${className}`}
      style={{ width }}
    >
      <div
        ref={headRef}
        className={`select-head ${isOpen ? "open" : ""} ${openUp && isOpen ? "open-up" : ""}`}
        onClick={toggleOpen}
        style={{
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {selectedOption?.label || ""}
      </div>
      {isOpen && (
        <div className={`select-list open ${openUp ? "open-up" : ""}`}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`select-item ${opt.value === value ? "selected" : ""}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};