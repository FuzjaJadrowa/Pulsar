import React from "react";
import styles from "./ToggleSwitch.module.css";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  className = "",
}) => {
  return (
    <label className={`switch ${styles.switch} ${className} ${disabled ? `is-disabled disabled ${styles["is-disabled"]} ${styles.disabled}` : ""}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className={`slider ${styles.slider}`}></span>
    </label>
  );
};