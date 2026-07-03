import { Tag } from "antd";
import { useAppContext } from "../context/useAppContext";
import { genres } from "../constants/genres";

const { CheckableTag } = Tag;

function Tags() {
  const { selectedGenres, toggleGenre } = useAppContext();

  return (
    <div
      role="group"
      aria-label="Genre filters"
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        padding: "12px 16px",
      }}
    >
      {genres.map((genre) => {
        const selected = selectedGenres.includes(genre.id);
        return (
          <CheckableTag
            key={genre.id}
            checked={selected}
            onChange={() => toggleGenre(genre.id)}
            aria-pressed={selected}
            style={{
              fontSize: 13,
              padding: "4px 12px",
              borderRadius: 50,
              border: selected ? "1px solid #f5c518" : "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer",
            }}
          >
            {genre.name}
          </CheckableTag>
        );
      })}
    </div>
  );
}

export default Tags;
