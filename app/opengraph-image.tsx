import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Ludle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Matches header wordmark in `components/Game.tsx` (Outfit extrabold, two-tone). */
export default async function Image() {
  const outfit = await fetch(
    "https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4bCyC4E.ttf"
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111110",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 200,
            fontFamily: "Outfit",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            textTransform: "lowercase",
          }}
        >
          <span style={{ color: "#E8E4DF" }}>lud</span>
          <span style={{ color: "#A09A94" }}>le</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Outfit",
          data: outfit,
          style: "normal",
          weight: 800,
        },
      ],
    }
  );
}
