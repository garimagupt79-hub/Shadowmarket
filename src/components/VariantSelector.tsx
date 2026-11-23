type VariantSelectorProps = {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
};

export function VariantSelector({
  label,
  options,
  selected,
  onSelect,
}: VariantSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-platinum">
        {label}
        {selected && (
          <span className="ml-2 normal-case tracking-normal text-platinum/70">
            {selected}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-all duration-300 ease-in-out ${
                active
                  ? 'border-[#00E676] text-[#00E676] bg-[#00E676]/10'
                  : 'border-[#1F1F24] text-platinum hover:border-platinum/50 hover:text-white'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
