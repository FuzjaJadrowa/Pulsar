import React from "react";
import styles from "./SettingsSection.module.css";

interface SettingsSectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children, className = "" }) => (
  <section className={`${styles.card} settings-section-card ${className}`}>
    <div className={`${styles.title} settings-section-title`}>{title}</div>
    {children}
  </section>
);