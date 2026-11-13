import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
  direction?: "up" | "down" | "auto";
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  width,
  className = "",
  direction = "auto",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const selectIdRef = useRef<object>({});

  const selectedOption = options.find((o) => o.value === value) || options[0];

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    window.dispatchEvent(new CustomEvent("custom-select-open", { detail: selectIdRef.current }));

    setIsOpen(true);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node) &&
        !popupRef.current?.contains(e.target as Node)
      ) {
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

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePopupPosition = () => {
      const head = headRef.current;
      if (!head) return;

      const rect = head.getBoundingClientRect();
      const spaceAbove = Math.max(0, rect.top - 8);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 8);
      const estimatedHeight = Math.min(options.length * 40 + 10, 240);
      const shouldOpenUp = direction === "up"
        ? true
        : direction === "down"
          ? false
          : spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const availableHeight = shouldOpenUp ? spaceAbove : spaceBelow;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8));

      setOpenUp(shouldOpenUp);
      setPopupStyle({
        position: "fixed",
        left,
        top: shouldOpenUp ? undefined : rect.bottom,
        bottom: shouldOpenUp ? window.innerHeight - rect.top : undefined,
        minWidth: rect.width,
        maxWidth: window.innerWidth - 16,
        maxHeight: Math.max(80, Math.min(240, availableHeight)),
        zIndex: 20000,
      });
    };

    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [direction, isOpen, options.length]);

  useEffect(() => {
    const closeOtherSelects = (event: Event) => {
      if ((event as CustomEvent<object>).detail !== selectIdRef.current) {
        setIsOpen(false);
      }
    };
    window.addEventListener("custom-select-open", closeOtherSelects);
    return () => window.removeEventListener("custom-select-open", closeOtherSelects);
  }, []);

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
      {isOpen && createPortal(
        <div
          ref={popupRef}
          className={`select-list open ${openUp ? "open-up" : ""}`}
          style={popupStyle}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`select-item ${opt.value === value ? "selected" : ""}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};