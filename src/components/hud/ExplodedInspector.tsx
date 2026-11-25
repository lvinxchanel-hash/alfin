import { Layers, X } from 'lucide-react';
import { CAMERA_PRESETS, getLayersByComponent } from '../../data/componentsData';
import { FocusTarget } from '../../types/paSystem';

interface ExplodedInspectorProps {
  focusTarget: Exclude<FocusTarget, 'overview'>;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onClose: () => void;
}

export function ExplodedInspector({
  focusTarget,
  selectedLayerId,
  onSelectLayer,
  onClose,
}: ExplodedInspectorProps) {
  const layers = getLayersByComponent(focusTarget);
  const activeLayer = layers.find((l) => l.id === selectedLayerId) ?? layers[0];
  const preset = CAMERA_PRESETS[focusTarget];

  return (
    <aside
      aria-label="Bedah Komponen Exploded View"
      className="pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/92 p-4 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400">
            <Layers className="h-3.5 w-3.5" />
            <span>Bedah Komponen (Exploded View)</span>
          </div>
          <h2 className="mt-0.5 font-display text-sm font-semibold text-slate-100">
            {preset.label}
          </h2>
          <p className="text-[11px] text-slate-400">{preset.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Kembali ke Tampilan Ruangan"
          className="cursor-pointer rounded-md border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Layer Selection Buttons */}
      <div className="pa-scroll flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
        {layers.map((layer) => {
          const isSelected = activeLayer?.id === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onSelectLayer(layer.id)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                isSelected
                  ? 'border-cyan-400/60 bg-cyan-500/15 font-semibold text-cyan-100'
                  : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className="truncate">{layer.shortLabel}</span>
              <span
                className="ml-2 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: layer.accentColor }}
              />
            </button>
          );
        })}
      </div>

      {/* Selected Layer Technical Breakdown */}
      {activeLayer && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/85 p-3">
          <div className="text-xs font-semibold text-slate-100">{activeLayer.name}</div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            {activeLayer.description}
          </p>
          <div className="mt-2 border-t border-slate-800 pt-2 font-mono-tabular text-[11px] text-cyan-300">
            {activeLayer.specs}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Klik langsung lapisan pada model 3D atau daftar di atas untuk melihat detail teknis.
      </p>
    </aside>
  );
}
