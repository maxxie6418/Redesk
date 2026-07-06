import { type FC, useState } from 'react';

interface CommentDotProps {
  /** 评论内容摘要 */
  content: string;
  /** 点击圆点 */
  onClick?: () => void;
}

export const CommentDot: FC<CommentDotProps> = ({ content, onClick }) => {
  const [hover, setHover] = useState(false);

  return (
    <span
      className="relative inline-block align-middle ml-0.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <span
        className="inline-block w-1 h-1 rounded-full bg-neutral-900 cursor-pointer"
      />
      {hover && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 text-white text-xs max-w-[200px] whitespace-normal leading-relaxed shadow-lg z-20">
          {content.length > 60 ? content.slice(0, 60) + '…' : content}
          <span
            className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-neutral-900 rotate-45"
            style={{ marginTop: -4 }}
          />
        </span>
      )}
    </span>
  );
};
