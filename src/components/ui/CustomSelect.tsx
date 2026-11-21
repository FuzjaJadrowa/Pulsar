import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./CustomSelect.module.css";

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

    window.dispatchEvent(
      new CustomEvent("custom-select-open", { detail: selectIdRef.current }),
    );

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

    let placement: boolean | null = null;
    let frameId = 0;

    const updatePopupPosition = () => {
      const head = headRef.current;
      const popup = popupRef.current;
      if (!head || !popup) return;

      const rect = head.getBoundingClientRect();
      const titleBar = document.getElementById("titlebar");
      const contentTop = Math.max(
        8,
        (titleBar?.getBoundingClientRect().bottom ?? 0) + 8,
      );
      const modalFooter = head
        .closest(".preset-modal")
        ?.querySelector<HTMLElement>(".preset-modal-footer");
      const footerTop = modalFooter?.getBoundingClientRect().top;
      const contentBottom = Math.min(
        window.innerHeight - 8,
        footerTop === undefined ? window.innerHeight - 8 : footerTop - 8,
      );
      const spaceAbove = Math.max(0, rect.top - contentTop);
      const spaceBelow = Math.max(0, contentBottom - rect.bottom);
      const estimatedHeight = Math.min(options.length * 40 + 10, 240);

      if (rect.bottom <= contentTop || rect.top >= contentBottom) {
        setIsOpen(false);
        return;
      }

      if (placement === null) {
        placement =
          direction === "up"
            ? true
            : direction === "down"
              ? false
              : spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
        setOpenUp(placement);
      }

      const availableHeight = placement ? spaceAbove : spaceBelow;
      if (availableHeight < 48) {
        setIsOpen(false);
        return;
      }
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - rect.width - 8),
      );

      popup.style.position = "fixed";
      popup.style.left = `${left}px`;
      popup.style.top = placement ? "auto" : `${rect.bottom}px`;
      popup.style.bottom = placement
        ? `${window.innerHeight - rect.top}px`
        : "auto";
      popup.style.minWidth = `${rect.width}px`;
      popup.style.maxWidth = `${window.innerWidth - 16}px`;
      popup.style.maxHeight = `${Math.min(240, availableHeight)}px`;
      popup.style.zIndex = "20000";
    };

    const schedulePositionUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updatePopupPosition();
      });
    };

    updatePopupPosition();
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, true);
    return () => {
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
    };
  }, [direction, isOpen, options.length]);

  useEffect(() => {
    const closeOtherSelects = (event: Event) => {
      if ((event as CustomEvent<object>).detail !== selectIdRef.current) {
        setIsOpen(false);
      }
    };
    window.addEventListener("custom-select-open", closeOtherSelects);
    return () =>
      window.removeEventListener("custom-select-open", closeOtherSelects);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`select-wrapper ${styles["select-wrapper"]} ${isOpen ? `select-open ${styles["select-open"]}` : ""} ${className}`}
      style={{ width }}
    >
      <div
        ref={headRef}
        className={`select-head ${styles["select-head"]} ${isOpen ? `open ${styles.open}` : ""} ${openUp && isOpen ? `open-up ${styles["open-up"]}` : ""}`}
        onClick={toggleOpen}
        style={{
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {selectedOption?.label || ""}
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className={`select-list ${styles["select-list"]} open ${styles.open} ${openUp ? `open-up ${styles["open-up"]}` : ""}`}
            style={{ zIndex: 20000 }}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`select-item ${styles["select-item"]} ${opt.value === value ? `selected ${styles.selected}` : ""}`}
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
