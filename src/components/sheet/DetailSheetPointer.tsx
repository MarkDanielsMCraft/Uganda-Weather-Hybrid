import { DIAMOND_SIZE, type DetailSheetLayout } from "@/components/sheet/detailSheetLayout";

export function DetailSheetPointer({
  layout,
  glassBackground,
  glassBackdropFilter,
}: {
  layout: DetailSheetLayout;
  glassBackground: string;
  glassBackdropFilter: string;
}) {
  return (
    <div
      className="absolute rounded-[6px] border border-white/[0.18]"
      style={{
        width: DIAMOND_SIZE,
        height: DIAMOND_SIZE,
        transform: "rotate(45deg)",
        background: glassBackground,
        backdropFilter: glassBackdropFilter,
        WebkitBackdropFilter: glassBackdropFilter,
        ...(layout.side === "top"
          ? { top: -DIAMOND_SIZE / 2, left: layout.pointerOffset - DIAMOND_SIZE / 2 }
          : layout.side === "left"
            ? { right: -DIAMOND_SIZE / 2, top: layout.pointerOffset - DIAMOND_SIZE / 2 }
            : { left: -DIAMOND_SIZE / 2, top: layout.pointerOffset - DIAMOND_SIZE / 2 }),
      }}
    />
  );
}
