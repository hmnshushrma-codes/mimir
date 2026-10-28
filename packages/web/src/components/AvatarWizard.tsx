import { useState } from "react";
import {
  GENDERS, SKIN_TONES, HAIR_STYLES, HAIR_COLORS, SHIRT_COLORS, EXPRESSIONS,
  type AvatarConfig, type Gender, type SkinTone, type HairStyle, type HairColor, type ShirtColor, type Expression
} from "../characters/avatarConfig.js";

function SwatchRow<T extends string>({
  label, options, value, onChange, render
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => React.ReactNode;
}) {
  return (
    <div className="wizard-row">
      <div className="wizard-label">{label}</div>
      <div className="wizard-swatches">
        {options.map((opt) => (
          <button
            key={opt}
            className={`wizard-swatch ${opt === value ? "active" : ""}`}
            onClick={() => onChange(opt)}
            title={opt}
          >
            {render ? render(opt) : <span className="wizard-color" style={{ background: opt }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

const HAIR_LABELS: Record<HairStyle, string> = {
  short: "Short",
  long: "Long",
  curly: "Curly",
  bald: "Bald"
};

export function AvatarWizard({
  initial,
  onSave,
  onClose
}: {
  initial: AvatarConfig;
  onSave: (config: AvatarConfig) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<AvatarConfig>(initial);

  const set = <K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: val }));

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-panel" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <span className="wizard-title">Customize Your Avatar</span>
          <button className="wizard-close" onClick={onClose}>&times;</button>
        </div>

        <div className="wizard-body">
          <SwatchRow<Gender>
            label="Style"
            options={GENDERS}
            value={config.gender}
            onChange={(v) => set("gender", v)}
            render={(v) => <span className="wizard-text-swatch">{v === "male" ? "Male" : "Female"}</span>}
          />

          <SwatchRow<SkinTone>
            label="Skin Tone"
            options={SKIN_TONES}
            value={config.skinTone}
            onChange={(v) => set("skinTone", v)}
          />

          <SwatchRow<HairStyle>
            label="Hair Style"
            options={HAIR_STYLES}
            value={config.hairStyle}
            onChange={(v) => set("hairStyle", v)}
            render={(v) => <span className="wizard-text-swatch">{HAIR_LABELS[v]}</span>}
          />

          <SwatchRow<HairColor>
            label="Hair Color"
            options={HAIR_COLORS}
            value={config.hairColor}
            onChange={(v) => set("hairColor", v)}
          />

          <SwatchRow<ShirtColor>
            label="Shirt"
            options={SHIRT_COLORS}
            value={config.shirtColor}
            onChange={(v) => set("shirtColor", v)}
          />

          <SwatchRow<Expression>
            label="Expression"
            options={EXPRESSIONS}
            value={config.expression}
            onChange={(v) => set("expression", v)}
            render={(v) => <span className="wizard-text-swatch">{v === "grin" ? "😁" : v === "smile" ? "😊" : v === "focused" ? "😐" : "🙂"}</span>}
          />

          <div className="wizard-row">
            <div className="wizard-label">Glasses</div>
            <div className="wizard-swatches">
              <button
                className={`wizard-swatch ${config.glasses ? "active" : ""}`}
                onClick={() => set("glasses", true)}
              >
                <span className="wizard-text-swatch">On</span>
              </button>
              <button
                className={`wizard-swatch ${!config.glasses ? "active" : ""}`}
                onClick={() => set("glasses", false)}
              >
                <span className="wizard-text-swatch">Off</span>
              </button>
            </div>
          </div>
        </div>

        <div className="wizard-footer">
          <button className="wizard-save" onClick={() => { onSave(config); onClose(); }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
