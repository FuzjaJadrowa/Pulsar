import { ICON_ASSETS } from "../../utils/icons";
import React from "react";
import { useTranslation } from "../../services/i18n";

interface HomeProps {
  onNavigate?: (pageName: string, index: number) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const handleNavigate = (pageName: string, index: number) => {
    onNavigate?.(pageName, index);
  };

  return (
    <div className="page-scroll app-scroll">
      <div className="home-page">
        <div className="home-hero">
          <h1 className="home-title">
            {t("home.title")}
          </h1>

          <div className="home-actions">
            <button
              type="button"
              className="home-pill"
              onClick={() => handleNavigate("downloader", 1)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              ><use href={ICON_ASSETS["download-arrow"]} /></svg>
              <span>{t("index.nav.download")}</span>
            </button>
            <button
              type="button"
              className="home-pill"
              onClick={() => handleNavigate("converter", 2)}
            >
              <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><use href={ICON_ASSETS["convert"]} /></svg>
              <span>{t("index.nav.convert")}</span>
            </button>
            <button
              type="button"
              className="home-pill"
              onClick={() => handleNavigate("compressor", 3)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true"><use href={ICON_ASSETS["compress"]} /></svg>
              <span>{t("index.nav.compress")}</span>
            </button>
          </div>

          <div className="home-actions secondary">
            <button
              type="button"
              className="home-pill small"
              onClick={() => handleNavigate("settings", 4)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                fillOpacity="0.18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                width="16"
                height="16"
              ><use href={ICON_ASSETS["gear"]} /></svg>
              <span>{t("index.nav.settings")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Home;