import { type FC } from 'react';

interface AnchorMarkerProps {
  /** 标记位置（相对于视口或容器的 top 值） */
  top: number;
  /** 是否显示 tooltip */
  showTooltip?: boolean;
  /** tooltip 内容 */
  tooltip?: string;
  /** 点击标记 */
  onClick?: () => void;
}

export const AnchorMarker: FC<AnchorMarkerProps> = ({ top, showTooltip, tooltip, onClick }) => {
  return (
    <div
      className="absolute right-0 z-10 cursor-pointer group"
      style={{ top }}
      onClick={onClick}
    >
      <div
        className="w-1 h-6 rounded-l-sm transition-all duration-200 group-hover:w-1.5 group-hover:h-7"
        style={{
          background: '#d97757',
          boxShadow: '-2px 0 6px rgba(217, 119, 87, 0.25)',
        }}
      />
      {showTooltip && tooltip && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded-md bg-neutral-900 text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  );
};
