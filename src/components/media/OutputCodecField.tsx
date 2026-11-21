import React from "react";
import { CustomSelect } from "../ui/CustomSelect";
import { useTranslation } from "../../services/i18n";

interface OutputCodecFieldProps {
  classPrefix: "converter" | "compressor";
  label: string;
  codecs: string[];
  value: string;
  includeCopyOption?: boolean;
  onChange: (value: string) => void;
}

export const OutputCodecField: React.FC<OutputCodecFieldProps> = ({
  classPrefix,
  label,
  codecs,
  value,
  includeCopyOption = false,
  onChange,
}) => {
  const { t } = useTranslation();
  const options = [
    { value: "", label: t("common.auto") },
    ...(includeCopyOption ? [{ value: "copy", label: t("common.copy") }] : []),
    ...codecs.map((codec) => ({ value: codec, label: codec })),
  ];

  return (
    <label className={`${classPrefix}-specs-row`}>
      <span className={`${classPrefix}-specs-label`}>{label}</span>
      <div className={`${classPrefix}-specs-control`}>
        <CustomSelect
          options={options}
          value={value}
          onChange={onChange}
          width="100%"
        />
      </div>
    </label>
  );
};
