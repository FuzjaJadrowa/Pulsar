import React from "react";
import { CustomSelect } from "../ui/CustomSelect";

interface SelectOption {
  value: string;
  label: string;
}

interface OutputSelectFieldProps {
  classPrefix: "converter" | "compressor";
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export const OutputSelectField: React.FC<OutputSelectFieldProps> = ({
  classPrefix,
  label,
  options,
  value,
  onChange,
}) => (
  <label className={`${classPrefix}-specs-row`}>
    <span className={`${classPrefix}-specs-label`}>{label}</span>
    <div className={`${classPrefix}-specs-control`}>
      <CustomSelect options={options} value={value} onChange={onChange} width="100%" />
    </div>
  </label>
);