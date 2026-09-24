import type { CatDefinition } from "./engine";

const CAT_PIXELS = [
  "  11    11  ",
  "  12111121  ",
  "  11111111  ",
  "  11311311  ",
  "  11141111  ",
  "   155551   ",
  "  11111111  ",
  " 1111111111 ",
  "11111111111 ",
  "11 11  11   ",
];

const COATS: Record<
  CatDefinition["coat"],
  { body: string; light: string; ear: string }
> = {
  ginger: { body: "#d99554", light: "#f9dfb2", ear: "#ebb5a0" },
  cream: { body: "#f1e6cd", light: "#fff8e9", ear: "#e4b5ac" },
  charcoal: { body: "#526068", light: "#bac1b8", ear: "#c39294" },
  calico: { body: "#e5dcca", light: "#fff5df", ear: "#dfaa99" },
};

/** The same code-drawn cat appears in the game and its workshop cover. */
export function PixelCat({
  coat = "ginger",
  size = 36,
  sleeping = false,
}: {
  coat?: CatDefinition["coat"];
  size?: number;
  sleeping?: boolean;
}) {
  const palette = COATS[coat];
  const colors: Record<string, string> = {
    "1": palette.body,
    "2": palette.ear,
    "3": "#263d36",
    "4": "#b66c67",
    "5": palette.light,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -2 14 14"
      aria-hidden="true"
      className="cat-pixel-sprite"
      shapeRendering="crispEdges"
    >
      <ellipse cx="6" cy="10.2" rx="5.2" ry="1" fill="#203e3820" />
      {CAT_PIXELS.flatMap((row, y) =>
        Array.from(row).map((pixel, x) =>
          pixel === " " ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={pixel === "3" && sleeping ? 0.4 : 1}
              fill={
                coat === "calico" &&
                pixel === "1" &&
                ((x < 5 && y < 3) || (x > 7 && y > 5))
                  ? "#b8794d"
                  : colors[pixel]
              }
            />
          ),
        ),
      )}
      {coat === "ginger" && (
        <g fill="#af713e">
          <rect x="5" y="1" width="1" height="1" />
          <rect x="7" y="1" width="1" height="1" />
          <rect x="3" y="6" width="2" height="1" />
          <rect x="8" y="7" width="2" height="1" />
        </g>
      )}
    </svg>
  );
}
