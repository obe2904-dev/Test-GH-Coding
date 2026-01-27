interface ColorDefinition {
  color: string;
  name: string;
  usage: string;
}

interface ColorPaletteProps {
  colors: ColorDefinition[];
}

export function ColorPalette({ colors }: ColorPaletteProps) {
  if (!colors || colors.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-3">
      {colors.map((color, index) => (
        <div key={index} className="flex-1 min-w-0">
          <div
            className="w-full h-16 rounded-lg border border-gray-200 shadow-sm"
            style={{ backgroundColor: color.color }}
            title={color.name}
          />
          <div className="mt-2 text-center">
            <div className="text-xs font-medium text-gray-900">{color.name}</div>
            <div className="text-xs text-gray-500">{color.color}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
