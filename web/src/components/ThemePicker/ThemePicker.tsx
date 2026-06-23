import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../../theme/useTheme';
import {
  themeListBackground,
  themePreviewTextColor,
  type ThemeMode,
  type ThemePreset,
} from '../../theme/themes';
import styles from './ThemePicker.module.css';
import { registerTheme } from '../../analytics';

function Swatches({
  colors,
  mode,
}: {
  colors: ThemePreset['swatches'];
  mode: ThemeMode;
}) {
  return (
    <span className={styles.swatchRow} aria-hidden="true">
      {colors.slice(1).map((color) => (
        <span
          key={color}
          className={`${styles.swatch} ${styles[`swatch_${mode}`]}`}
          style={{ background: color }}
        />
      ))}
    </span>
  );
}

function ThemeOption({
  preset,
  selected,
  onSelect,
}: {
  preset: ThemePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const primary = preset.swatches[1];

  return (
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-checked={selected}
        className={`${styles.option} ${styles[`option_${preset.mode}`]}`}
        style={{
          background: themeListBackground(preset),
          color: themePreviewTextColor(preset.mode),
          boxShadow: selected ? `inset 0 0 0 2px ${primary}` : undefined,
        }}
        onClick={onSelect}
      >
        <Swatches colors={preset.swatches} mode={preset.mode} />
        {preset.label}
      </button>
    </li>
  );
}

export function ThemePicker() {
  const { themeId, setTheme, presets } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = presets.find((p) => p.id === themeId) ?? presets[0];

  useEffect(() => { registerTheme(themeId); }, [themeId]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function pick(id: ThemePreset['id']) {
    setTheme(id);
    setOpen(false);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${styles[`trigger_${active.mode}`]}`}
        style={{
          background: active.swatches[0],
          color: themePreviewTextColor(active.mode),
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Swatches colors={active.swatches} mode={active.mode} />
        Theme
      </button>

      {open ? (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Colour palette"
          className={styles.menu}
        >
          {presets.map((preset) => (
            <ThemeOption
              key={preset.id}
              preset={preset}
              selected={preset.id === themeId}
              onSelect={() => pick(preset.id)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
