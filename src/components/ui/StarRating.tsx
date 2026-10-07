import { Rate } from "antd";
import { RATING_GOLD } from "../../constants/ui";

interface Props {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}

export function StarRating({ value, onChange, max = 10 }: Props) {
  return (
    <Rate
      count={max}
      value={value}
      onChange={onChange}
      style={{ fontSize: 22, color: RATING_GOLD }}
    />
  );
}
