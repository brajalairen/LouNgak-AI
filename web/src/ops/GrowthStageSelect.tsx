/** A growth-stage dropdown that follows the chosen crop, with "Other (type it)" for anything the list
 *  does not cover. Choosing nothing saves no stage: the field is optional and nobody is made to guess.
 *  Give it `key={crop}` so a change of crop starts it afresh. */

import { useState } from "react";
import { fieldClass } from "./ui";
import { isListedStage, OTHER_STAGE, stageGroups, type StageAudience } from "./growthStages";

export function GrowthStageSelect({ crop, audience, value, onChange }: {
  crop: string;
  audience: StageAudience;
  value: string | null;
  onChange: (stage: string | null) => void;
}) {
  const groups = stageGroups(crop, audience);
  const [typing, setTyping] = useState(value !== null && !isListedStage(crop, audience, value));

  const pick = (choice: string) => {
    setTyping(choice === OTHER_STAGE);
    onChange(choice === OTHER_STAGE || choice === "" ? null : choice);
  };

  return (
    <>
      <select className={fieldClass} value={typing ? OTHER_STAGE : value ?? ""} onChange={(e) => pick(e.target.value)}>
        <option value="">Choose (optional)</option>
        {groups.map((g) =>
          g.phase ? (
            <optgroup key={g.phase} label={g.phase}>
              {g.stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          ) : (
            g.stages.map((s) => <option key={s} value={s}>{s}</option>)
          ),
        )}
        <option value={OTHER_STAGE}>Other (type it)</option>
      </select>
      {typing && (
        <input
          className={`${fieldClass} mt-2`}
          maxLength={80}
          autoFocus
          aria-label="Growth stage, typed"
          placeholder="Type the growth stage"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() ? e.target.value : null)}
        />
      )}
    </>
  );
}
