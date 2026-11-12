import logoFull from "../assets/raccoons-logo.png";
import logoSmall from "../assets/raccoons-logo-small.png";

// Vereinslogo: "full" fuer den Beamer (900 px hoch), "small" fuer Handy-Ansichten
// (192 px hoch). Das Original-SVG (13 MB, nachgezeichnet) liegt nur als Quelle
// unter brand-source/ und wird nicht ausgeliefert.
export function Logo({ variant, className }: { variant: "full" | "small"; className?: string }) {
  return <img src={variant === "full" ? logoFull : logoSmall} alt="Bedburg Raccoons" className={["rq-logo", className].filter(Boolean).join(" ")} draggable={false} />;
}
