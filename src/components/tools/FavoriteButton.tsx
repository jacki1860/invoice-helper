import { Star } from 'lucide-react';
import type { ToolId } from '../../features/tools/catalog';

export function FavoriteButton({
  tool,
  selected,
  onToggle,
}: {
  tool: { id: ToolId; label: string };
  selected: boolean;
  onToggle: (id: ToolId) => void;
}) {
  return (
    <button
      type="button"
      className="favorite-button"
      aria-label={`${selected ? '取消常用' : '加入常用'}：${tool.label}`}
      aria-pressed={selected}
      title={selected ? '取消常用' : '加入常用'}
      onClick={() => onToggle(tool.id)}
    >
      <Star
        size={19}
        strokeWidth={1.6}
        fill={selected ? 'currentColor' : 'none'}
        aria-hidden="true"
      />
    </button>
  );
}
