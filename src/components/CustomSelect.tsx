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
  direction?: "up" | "down" | "auto";
}

const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
  if (!node) return null;
  let parent = node.parentElement;
  while (parent && parent !== document.body) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll" || parent.classList.contains("preset-modal-body")) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen && headRef.current) {
      if (direction === "up") {
        setOpenUp(true);
      } else if (direction === "down") {
        setOpenUp(false);
      } else {
        const headRect = headRef.current.getBoundingClientRect();
        const estimatedHeight = Math.min(options.length * 40, 240);

        let spaceAbove = headRect.top;
        let spaceBelow = window.innerHeight - headRect.bottom;

        const scrollParent = getScrollParent(wrapperRef.current);
        if (scrollParent) {
          const parentRect = scrollParent.getBoundingClientRect();
          spaceBelow = Math.min(spaceBelow, parentRect.bottom - headRect.bottom);
          spaceAbove = Math.min(spaceAbove, headRect.top - parentRect.top);
        }

        const shouldOpenUp = spaceBelow < estimatedHeight && spaceAbove > 40;
        setOpenUp(shouldOpenUp);
      }
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

  useEffect(() => {
    const card = wrapperRef.current?.closest(".settings-section-card");
    if (card) {
      if (isOpen) {
        card.classList.add("select-open-card");
      } else {
        card.classList.remove("select-open-card");
      }
    }
    return () => {
      if (card) card.classList.remove("select-open-card");
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
      <div className={`select-list ${isOpen ? "open" : ""} ${openUp ? "open-up" : ""}`}>
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
    </div>
  );
};