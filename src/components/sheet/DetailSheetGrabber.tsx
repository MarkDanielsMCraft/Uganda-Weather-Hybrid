import type { DragControls } from "framer-motion";

/** The grabber. It is the affordance that says "this can be moved" without a label,
    and it drags from any scroll position, which the card body deliberately does not.
    `touch-none` hands the gesture to the drag handler instead of letting the browser
    scroll the card under it. */
export function DetailSheetGrabber({
  dragControls,
}: {
  dragControls: DragControls;
}) {
  return (
    <div
      onPointerDown={(event) => dragControls.start(event)}
      className="-mx-6 -mt-3 mb-1 flex cursor-grab touch-none justify-center px-6 pb-2 pt-2 active:cursor-grabbing"
      aria-hidden="true"
    >
      <span className="h-1 w-9 rounded-full bg-white/30" />
    </div>
  );
}
