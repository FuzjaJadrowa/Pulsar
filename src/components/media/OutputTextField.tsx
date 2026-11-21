import React from "react";

interface OutputTextFieldProps {
  classPrefix: "converter" | "compressor";
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export const OutputTextField: React.FC<OutputTextFieldProps> = ({
  classPrefix,
  id,
  label,
  placeholder,
  value,
  onChange,
}) => (
  <label className={`${classPrefix}-specs-row`}>
    <span className={`${classPrefix}-specs-label`}>{label}</span>
    <div className={`${classPrefix}-specs-control`}>
      <input
        id={id}
        className="custom-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </div>
  </label>
);
