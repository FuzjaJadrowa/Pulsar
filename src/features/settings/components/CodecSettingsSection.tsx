import React from "react";
import { CustomSelect } from "../../../components/CustomSelect";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useConfig } from "../../../services/config";
import { useTranslation } from "../../../services/i18n";
import { SettingsSection } from "../SettingsSection";

export const CodecSettingsSection: React.FC = () => {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();
  const videoCodecs = [
    { value: "auto", label: t("common.auto") },
    { value: "h264", label: "H264" },
    { value: "h265", label: "H265" },
    { value: "av1", label: "AV1" },
    { value: "vp9", label: "VP9" },
    { value: "vp8", label: "VP8" },
    { value: "prores", label: "ProRes" },
    { value: "mpeg4", label: "MPEG4" },
    { value: "theora", label: "Theora" },
    { value: "wmv", label: "WMV" },
  ];
  const audioCodecs = [
    { value: "auto", label: t("common.auto") },
    { value: "aac", label: "AAC" },
    { value: "mp3", label: "MP3" },
    { value: "flac", label: "FLAC" },
    { value: "opus", label: "Opus" },
    { value: "vorbis", label: "Vorbis" },
    { value: "ac3", label: "AC3" },
    { value: "alac", label: "ALAC" },
    { value: "wav", label: "WAV" },
    { value: "aiff", label: "AIFF" },
    { value: "wma", label: "WMA" },
  ];

  return (
    <SettingsSection title={t("settings.codecs.title")}>
      <div className="form-row">
        <span>{t("settings.codecs.copyCodecIfPossible")}</span>
        <ToggleSwitch
          checked={!!config.copy_codec_if_possible}
          onChange={(checked) => updateConfig({ copy_codec_if_possible: checked })}
        />
      </div>

      <div className="form-row">
        <span>{t("settings.codecs.defaultVideoCodec")}</span>
        <CustomSelect
          options={videoCodecs}
          value={config.default_video_codec || "auto"}
          onChange={(value) => updateConfig({ default_video_codec: value })}
          width="150px"
        />
      </div>

      <div className="form-row">
        <span>{t("settings.codecs.defaultAudioCodec")}</span>
        <CustomSelect
          options={audioCodecs}
          value={config.default_audio_codec || "auto"}
          onChange={(value) => updateConfig({ default_audio_codec: value })}
          width="150px"
        />
      </div>
    </SettingsSection>
  );
};