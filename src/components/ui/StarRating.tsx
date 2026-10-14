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
      // Star size and gap shrink on narrow phones (App.css), so ten stars stay on one line.
      className="star-rating"
      style={{ color: RATING_GOLD }}
    />
  );
}
