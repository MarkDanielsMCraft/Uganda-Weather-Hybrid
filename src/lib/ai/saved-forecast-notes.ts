/** Lines of the offline saved forecast summary that only make sense inside
    the app. Kept in this small module so the SMS helpers used by the low data
    /lite page can recognise them without loading the AI code. */
export const OFFLINE_NOTICE_EN =
  "This phone cannot run the AI advisor without internet, so here is a summary of your saved forecast.";
export const OFFLINE_NOTICE_LG =
  "Toli ku mutimbagano kati. Essimu eno tesobola kukozesa muwi w'amagezi owa AI awatali yintaneeti, kale buno bwe bufunze bw'obudde obwaterekebwa.";
export const AI_UNAVAILABLE_NOTICE_EN =
  "The AI advisor could not answer just now, so here is a summary of the forecast.";
export const AI_UNAVAILABLE_NOTICE_LG =
  "Omuwi w'amagezi tali mwetegefu kati. Buno bwe bufunze bw'obudde obwaterekebwa.";
const SAVED_NOTE_ENDINGS = ["without AI.", "tebukozesezza AI."];

/** True for the lines that only make sense inside the app (the offline and AI
    unavailable notices and the saved forecast footer), so sharing by SMS can leave them out and
    keep the message short. */
export function isSavedForecastAppNote(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  return (
    trimmed === OFFLINE_NOTICE_EN ||
    trimmed === OFFLINE_NOTICE_LG ||
    trimmed === AI_UNAVAILABLE_NOTICE_EN ||
    trimmed === AI_UNAVAILABLE_NOTICE_LG ||
    SAVED_NOTE_ENDINGS.some((ending) => trimmed.endsWith(ending))
  );
}
