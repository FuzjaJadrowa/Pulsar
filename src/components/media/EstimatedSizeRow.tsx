import React from "react";
import { useTranslation } from "../../services/i18n";

interface EstimatedSizeRowProps {
  classPrefix: "converter" | "compressor";
  id: string;
  value: string | null;
}

export const EstimatedSizeRow: React.FC<EstimatedSizeRowProps> = ({
  classPrefix,
  id,
  value,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`${classPrefix}-specs-row`}>
      <span className={`${classPrefix}-specs-label`}>
        {t("common.options.estimatedSize")}
      </span>
      <span id={id} className={`${classPrefix}-specs-value`}>
        {value || "-"}
      </span>
    </div>
  );
};
